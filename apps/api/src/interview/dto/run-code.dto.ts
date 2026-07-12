import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ProgrammingLanguage } from '@repo/db';

export class RunCodeDto {
  @IsEnum(ProgrammingLanguage, { message: 'Invalid programming language' })
  language!: ProgrammingLanguage;

  @IsString()
  @IsNotEmpty({ message: 'Source code must not be empty' })
  sourceCode!: string;
}
