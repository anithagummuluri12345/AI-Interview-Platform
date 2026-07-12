import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    let dbStatus = 'unhealthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'healthy';
    } catch {
      dbStatus = 'unhealthy';
    }

    return {
      status: dbStatus === 'healthy' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        redis: 'initialized',
      },
    };
  }
}
