import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.int().min(0),
  });

  const metadata: ArgumentMetadata = { type: 'body' };

  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(schema);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the parsed value for valid input', () => {
    const value = { name: 'MBTI Discussion', age: 30 };

    expect(pipe.transform(value, metadata)).toEqual(value);
  });

  it('throws BadRequestException with a 400 Validation Failed envelope for invalid input', () => {
    let exception: BadRequestException | undefined;
    try {
      pipe.transform({ name: '', age: -1 }, metadata);
    } catch (error) {
      exception = error as BadRequestException;
    }

    expect(exception).toBeInstanceOf(BadRequestException);

    const response = exception?.getResponse() as Record<string, unknown>;
    expect(response.statusCode).toBe(400);
    expect(response.error).toBe('Validation Failed');

    const message = response.message;
    expect(Array.isArray(message)).toBe(true);
    const issues = message as Array<Record<string, unknown>>;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatchObject({
      code: expect.any(String),
      path: expect.any(Array),
    });
  });
});
