export interface ResumeStorageService {
  saveFile(key: string, buffer: Buffer): Promise<void>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}
