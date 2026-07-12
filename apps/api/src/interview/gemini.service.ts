import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './interfaces/ai-provider.interface';

@Injectable()
export class GeminiService implements AiProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('gemini.apiKey');
    this.model = this.configService.get<string>('gemini.model') || 'gemini-2.5-flash';
  }

  async generateStructured<T>(prompt: string, responseSchema: any, timeoutMs?: number): Promise<T> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'AI Provider configuration error: GEMINI_API_KEY is not configured on the server.'
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    };

    const finalTimeout = timeoutMs ?? 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore
        }
        throw new InternalServerErrorException(
          `Gemini API returned status ${response.status}: ${errorBody}`
        );
      }

      const resData = await response.json();
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new InternalServerErrorException('Empty text content received from Gemini API.');
      }

      const parsed = JSON.parse(text) as T;
      return parsed;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new InternalServerErrorException(`AI generation request timed out after ${finalTimeout / 1000} seconds.`);
      }
      throw error instanceof InternalServerErrorException
        ? error
        : new InternalServerErrorException(`AI generation failed: ${error.message}`);
    }
  }
}
