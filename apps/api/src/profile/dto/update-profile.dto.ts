import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ExperienceLevel } from '@repo/db';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  headline?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEnum(ExperienceLevel, { message: 'Invalid experience level' })
  @IsOptional()
  experienceLevel?: ExperienceLevel;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetRoles?: string[];
}
