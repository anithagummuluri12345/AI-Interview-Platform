import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { LocalResumeStorageService } from './local-resume-storage.service';
import { DatabaseModule } from '../database/database.module';
import { InterviewModule } from '../interview/interview.module';

@Module({
  imports: [DatabaseModule, InterviewModule],
  controllers: [ResumesController],
  providers: [
    {
      provide: 'ResumeStorageService',
      useClass: LocalResumeStorageService,
    },
  ],
  exports: ['ResumeStorageService'],
})
export class ResumeModule {}
