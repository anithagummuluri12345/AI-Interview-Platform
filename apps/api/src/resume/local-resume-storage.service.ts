import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ResumeStorageService } from './interfaces/resume-storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalResumeStorageService implements ResumeStorageService {
  private readonly uploadDir = path.join(__dirname, '..', '..', 'uploads', 'resumes');

  constructor() {
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to create resume upload directory: ${error.message}`);
    }
  }

  async saveFile(key: string, buffer: Buffer): Promise<void> {
    this.ensureDirectoryExists();
    const filePath = path.join(this.uploadDir, key);
    try {
      await fs.promises.writeFile(filePath, buffer);
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to save resume file to disk: ${error.message}`);
    }
  }

  async getFile(key: string): Promise<Buffer> {
    const filePath = path.join(this.uploadDir, key);
    try {
      if (!fs.existsSync(filePath)) {
        throw new InternalServerErrorException(`Resume file not found on disk at: ${filePath}`);
      }
      return await fs.promises.readFile(filePath);
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to read resume file from disk: ${error.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to delete resume file from disk: ${error.message}`);
    }
  }
}
