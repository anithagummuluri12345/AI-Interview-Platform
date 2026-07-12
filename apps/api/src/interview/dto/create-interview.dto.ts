import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsInt, IsIn, IsUUID } from 'class-validator';
import { InterviewType, InterviewMode, InterviewExperienceLevel, InterviewStatus, InterviewCompany } from '@repo/db';

export class CreateInterviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Target job role is required' })
  targetRole!: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsOptional()
  @IsEnum(InterviewCompany, { message: 'Invalid interview company' })
  company?: InterviewCompany;

  @IsEnum(InterviewType, { message: 'Invalid interview type' })
  type!: InterviewType;

  @IsEnum(InterviewMode, { message: 'Invalid interview mode' })
  mode!: InterviewMode;

  @IsEnum(InterviewExperienceLevel, { message: 'Invalid experience level' })
  experienceLevel!: InterviewExperienceLevel;

  @IsArray({ message: 'Skills must be an array of strings' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  @IsNotEmpty({ each: true, message: 'Skills must not be empty' })
  skills!: string[];

  @IsString()
  @IsOptional()
  jobDescription?: string;

  @IsInt({ message: 'Duration must be an integer' })
  @IsIn([15, 30, 45, 60], { message: 'Duration must be 15, 30, 45, or 60 minutes' })
  duration!: number;

  @IsUUID('4', { message: 'Invalid resume ID format' })
  @IsOptional()
  resumeId?: string;

  @IsOptional()
  @IsEnum(InterviewStatus, { message: 'Invalid interview status' })
  status?: InterviewStatus;
}
