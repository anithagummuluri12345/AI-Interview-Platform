export interface AiProvider {
  generateStructured<T>(prompt: string, responseSchema: any, timeoutMs?: number): Promise<T>;
}
