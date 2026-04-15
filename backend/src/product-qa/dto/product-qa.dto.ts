import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class AskQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  question: string;
}

export class AnswerQuestionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  answer: string;
}

export class QAQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
