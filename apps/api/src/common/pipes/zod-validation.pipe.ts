import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const parsedValue = this.schema.safeParse(value);

    if (parsedValue.error) {
      throw new BadRequestException({
        statusCode: 400,
        message: parsedValue.error.issues,
        error: 'Validation Failed',
      });
    }

    return parsedValue.data;
  }
}
