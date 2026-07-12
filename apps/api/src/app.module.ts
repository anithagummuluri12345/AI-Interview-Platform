import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { InterviewModule } from './interview/interview.module';
import { ResumeModule } from './resume/resume.module';
import { AnalyticsModule } from './analytics/analytics.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      load: [configuration],
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    ProfileModule,
    InterviewModule,
    ResumeModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}