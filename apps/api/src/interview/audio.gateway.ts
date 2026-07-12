import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as url from 'url';

@WebSocketGateway({
  path: '/api/v1/interviews/voice',
})
export class AudioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private chunkCount = 0;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: WebSocket, request: any) {
    console.log('[AudioGateway] WebSocket connection handshake initiated.');
    const reqUrl = request.url ? request.url : '';
    const parsed = url.parse(reqUrl, true);
    const token = parsed.query.token as string;
    const interviewId = parsed.query.interviewId as string;

    if (!token) {
      console.log('[AudioGateway] Connection rejected: token query parameter is missing.');
      client.close(4001, 'Missing token');
      return;
    }
    if (!interviewId) {
      console.log('[AudioGateway] Connection rejected: interviewId query parameter is missing.');
      client.close(4001, 'Missing interviewId');
      return;
    }

    try {
      console.log('[AudioGateway] Verifying incoming client JWT credentials...');
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      console.log('[AudioGateway] JWT signature verified successfully for User ID:', userId);

      console.log('[AudioGateway] Querying interview metadata for ID:', interviewId);
      const interview = await this.prisma.interview.findUnique({
        where: { id: interviewId },
      });

      if (!interview) {
        console.log('[AudioGateway] Connection rejected: Interview not found in PostgreSQL.');
        client.close(4040, 'Interview not found');
        return;
      }

      if (interview.userId !== userId) {
        console.log('[AudioGateway] Connection rejected: Candidate does not own this interview.');
        client.close(4003, 'Forbidden');
        return;
      }

      const apiKey = this.configService.get<string>('gemini.apiKey');
      console.log(`[AudioGateway] Gemini API key present: ${!!apiKey}`);
      if (!apiKey) {
        console.log('[AudioGateway] Connection rejected: Server lacks GEMINI_API_KEY config.');
        client.close(4005, 'Gemini API key not configured on server');
        return;
      }

      console.log('[AudioGateway] Handshake checks cleared. Initializing Gemini Live WebSocket connection...');
      const liveModel = this.configService.get<string>('gemini.liveModel') || 'gemini-2.5-flash-native-audio-latest';
      const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      console.log('[AudioGateway] Gemini Live URL: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=***');

      console.log('[AudioGateway] Creating upstream Gemini WebSocket...');
      const geminiSocket = new WebSocket(geminiWsUrl);
      console.log('[AudioGateway] Gemini socket CONNECTING');

      const connectionTimeout = setTimeout(() => {
        if (geminiSocket.readyState !== WebSocket.OPEN) {
          console.log('[AudioGateway] Connection timeout: Gemini Live API did not open within 10 seconds.');
          geminiSocket.close();
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event: 'error', message: 'Gemini upstream connection timeout' }));
            client.close(4504, 'Upstream timeout');
          }
        }
      }, 10000);

      geminiSocket.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('[AudioGateway] Gemini socket OPEN');
        
        console.log('[AudioGateway] Sending Gemini setup message');
        const setupMessage = {
          setup: {
            model: `models/${liveModel}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Kore',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: `You are an expert AI technical recruiter conducting an interview for the role of ${interview.targetRole}.
Company context: ${interview.companyName || 'N/A'}.
Experience level: ${interview.experienceLevel}.
Skills requirements: ${interview.skills.join(', ')}.

Keep your questions short and conversational. Only ask ONE question at a time.
Do not output extremely long answers. Wait for the candidate to respond before asking follow-up questions.`,
                },
              ],
            },
          },
        };
        geminiSocket.send(JSON.stringify(setupMessage));
      });

      geminiSocket.on('message', (data: any) => {
        try {
          const raw = JSON.parse(data.toString());
          
          if (raw.setupComplete) {
            console.log('[AudioGateway] Gemini setup acknowledged');
            console.log('[AudioGateway] Gemini Live session READY');
            
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ event: 'ready' }));
            }
            
            const initPrompt = {
              clientContent: {
                turns: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `The candidate has joined the interview. Please greet the candidate briefly and ask the first question for the role of ${interview.targetRole}.`
                      }
                    ]
                  }
                ],
                turnComplete: true
              }
            };
            console.log('[AudioGateway] Triggering first question from Gemini...');
            geminiSocket.send(JSON.stringify(initPrompt));
            return;
          }

          if (raw.serverContent) {
            console.log('[AudioGateway] Gemini message received: serverContent');
            const { modelTurn } = raw.serverContent;
            if (modelTurn && modelTurn.parts) {
              modelTurn.parts.forEach((p: any) => {
                if (p.text) {
                  console.log('[AudioGateway] Gemini transcript received');
                }
                if (p.inlineData && p.inlineData.data) {
                  const audioBytes = Buffer.from(p.inlineData.data, 'base64').length;
                  console.log(`[AudioGateway] Gemini audio received: bytes=${audioBytes}`);
                  console.log('[AudioGateway] Forwarding model audio to browser');
                }
              });
            }
          } else {
            const msgKeys = Object.keys(raw).join(', ');
            console.log(`[AudioGateway] Gemini message received: ${msgKeys}`);
          }
        } catch {
          // ignore
        }

        if (client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      });

      geminiSocket.on('error', (err: any) => {
        clearTimeout(connectionTimeout);
        console.log('[AudioGateway] Gemini socket ERROR:', err?.message || err);
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ event: 'error', message: 'Gemini upstream connection error' }));
        }
        client.close(4500, 'Gemini connection error');
      });

      geminiSocket.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        const reasonStr = reason ? reason.toString() : 'none';
        console.log(`[AudioGateway] Gemini socket CLOSED: code=${code} reason=${reasonStr}`);
        client.close(4500, 'Gemini connection closed');
      });

      (client as any).geminiSocket = geminiSocket;

    } catch (err: any) {
      console.log('[AudioGateway] Connection rejected: Exception thrown during validation.', err?.message || err);
      client.close(4001, 'Unauthorized or Invalid connection parameters');
    }
  }

  handleDisconnect(client: WebSocket) {
    const geminiSocket = (client as any).geminiSocket;
    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.close();
    }
  }

  @SubscribeMessage('realtimeInput')
  handleRealtimeInput(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any,
  ) {
    const geminiSocket = (client as any).geminiSocket;
    const mediaChunks = data?.mediaChunks || [];
    let bytesLen = 0;
    if (mediaChunks.length > 0 && mediaChunks[0].data) {
      bytesLen = Buffer.from(mediaChunks[0].data, 'base64').length;
    }

    this.chunkCount++;
    if (this.chunkCount % 50 === 0) {
      console.log(`[AudioGateway] Received candidate audio chunk: bytes=${bytesLen}`);
    }

    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify({ realtimeInput: data }));
      if (this.chunkCount % 50 === 0) {
        console.log(`[AudioGateway] Forwarded audio chunk to Gemini: bytes=${bytesLen}`);
      }
    }
  }

  @SubscribeMessage('clientContent')
  handleClientContent(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any,
  ) {
    const geminiSocket = (client as any).geminiSocket;
    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.send(JSON.stringify({ clientContent: data }));
    }
  }

  @SubscribeMessage('saveTurn')
  async handleSaveTurn(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() payload: { questionText: string; answerText: string; interviewId: string },
  ) {
    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id: payload.interviewId },
        include: { rounds: true },
      });

      if (!interview) return;

      let round = interview.rounds.find((r) => r.sequence === 1);
      if (!round) {
        round = await this.prisma.interviewRound.create({
          data: {
            interviewId: payload.interviewId,
            sequence: 1,
            type: interview.type as any,
            status: 'IN_PROGRESS',
          },
        });
      }

      const questionsCount = await this.prisma.question.count({
        where: { interviewRoundId: round.id },
      });

      await this.prisma.$transaction(async (tx) => {
        const question = await tx.question.create({
          data: {
            interviewRoundId: round.id,
            sequence: questionsCount + 1,
            topic: 'Voice Turn',
            difficulty: 'MEDIUM',
            questionText: payload.questionText,
            expectedConcepts: [],
          },
        });

        await tx.answer.create({
          data: {
            questionId: question.id,
            answerText: payload.answerText,
            responseDurationSeconds: 0,
          },
        });
      });
    } catch (err) {
      console.error('Error saving voice turn:', err);
    }
  }
}
