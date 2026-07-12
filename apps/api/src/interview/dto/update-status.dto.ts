import { IsEnum, IsNotEmpty } from 'class-validator';
import { InterviewStatus } from '@repo/db';

export class UpdateStatusDto {
  @IsEnum(InterviewStatus, { message: 'Invalid interview status' })
  @IsNotEmpty({ message: 'Status is required' })
  status!: InterviewStatus;
}
