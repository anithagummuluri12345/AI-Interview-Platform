import { IsString, IsOptional, IsEnum, IsArray, IsInt, IsIn, IsUUID, IsNotEmpty } from 'class-validator';
import { InterviewType, InterviewMode, InterviewExperienceLevel, InterviewStatus } from '@repo/db';

export class UpdateInterviewDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  targetRole?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsEnum(InterviewType, { message: 'Invalid interview type' })
  @IsOptional()
  type?: InterviewType;

  @IsEnum(InterviewMode, { message: 'Invalid interview mode' })
  @IsOptional()
  mode?: InterviewMode;

  @IsEnum(InterviewExperienceLevel, { message: 'Invalid experience level' })
  @IsOptional()
  experienceLevel?: InterviewExperienceLevel;

  @IsArray({ message: 'Skills must be an array of strings' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  @IsNotEmpty({ each: true, message: 'Skills must not be empty' })
  @IsOptional()
  skills?: string[];

  @IsString()
  @IsOptional()
  jobDescription?: string;

  @IsInt({ message: 'Duration must be an integer' })
  @IsIn([15, 30, 45, 60], { message: 'Duration must be 15, 30, 45, or 60 minutes' })
  @IsOptional()
  duration?: number;

  @IsUUID('4', { message: 'Invalid resume ID format' })
  @IsOptional()
  resumeId?: string;

  @IsOptional()
  @IsEnum(InterviewStatus, { message: 'Invalid interview status' })
  status?: InterviewStatus;
}
