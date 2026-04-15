import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Pipe that parses a value to an integer, returning a default value
 * if the input is null, undefined, or empty string.
 * Throws BadRequestException if the value is present but not a valid integer.
 *
 * Usage:
 *   @Query('page', new ParseIntWithDefaultPipe(1)) page: number
 *   @Query('limit', new ParseIntWithDefaultPipe(20)) limit: number
 */
@Injectable()
export class ParseIntWithDefaultPipe implements PipeTransform<string, number> {
  private readonly defaultValue: number;

  constructor(defaultValue: number) {
    this.defaultValue = defaultValue;
  }

  transform(value: string): number {
    if (value === null || value === undefined || value === '') {
      return this.defaultValue;
    }

    const parsed = parseInt(value, 10);

    if (isNaN(parsed)) {
      throw new BadRequestException(
        `Validation failed: "${value}" is not a valid integer`,
      );
    }

    return parsed;
  }
}
