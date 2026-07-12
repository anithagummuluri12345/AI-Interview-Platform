import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { DatabaseModule } from '../database/database.module';
import { GeminiService } from './gemini.service';
import { AudioGateway } from './audio.gateway';
import { LocalCodeExecutor } from './code-executor/local-code-executor.service';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret') || 'super-secret-access-key',
      }),
    }),
  ],
  controllers: [InterviewController],
  providers: [
    InterviewService,
    AudioGateway,
    {
      provide: 'AiProvider',
      useClass: GeminiService,
    },
    {
      provide: 'CodeExecutionProvider',
      useClass: LocalCodeExecutor,
    },
  ],
  exports: [InterviewService, 'AiProvider', 'CodeExecutionProvider'],
})
export class InterviewModule {}
