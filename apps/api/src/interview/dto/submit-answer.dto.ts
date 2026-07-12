import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID('4', { message: 'Invalid question ID format' })
  @IsNotEmpty({ message: 'Question ID is required' })
  questionId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Answer text is required' })
  answerText!: string;
}
