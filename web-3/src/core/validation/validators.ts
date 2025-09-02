/**
 * Validation utilities and helpers
 * Implements the Validator interface from contracts
 */

import { z } from 'zod';
import type { Validator, ValidationResult, ValidationError } from './types';

// Re-export ValidationError for convenience
export type { ValidationError } from './types';

/**
 * Create a validator from a Zod schema
 */
export function createValidator<T>(schema: z.ZodSchema<T>): Validator<T> {
  return {
    validate(data: unknown): ValidationResult<T> {
      const result = schema.safeParse(data);
      
      if (result.success) {
        return { success: true, data: result.data };
      }
      
      return {
        success: false,
        errors: formatZodErrors(result.error),
      };
    },

    async validateAsync(data: unknown): Promise<ValidationResult<T>> {
      const result = await schema.safeParseAsync(data);
      
      if (result.success) {
        return { success: true, data: result.data };
      }
      
      return {
        success: false,
        errors: formatZodErrors(result.error),
      };
    },
  };
}

/**
 * Format Zod errors to our ValidationError format
 */
function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Combine multiple validators
 */
export function combineValidators<T>(...validators: Validator<T>[]): Validator<T> {
  return {
    validate(data: unknown): ValidationResult<T> {
      const errors: ValidationError[] = [];
      let validData: T | undefined;

      for (const validator of validators) {
        const result = validator.validate(data);
        
        if (!result.success) {
          errors.push(...result.errors);
        } else {
          validData = result.data;
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: validData! };
    },

    async validateAsync(data: unknown): Promise<ValidationResult<T>> {
      const errors: ValidationError[] = [];
      let validData: T | undefined;

      for (const validator of validators) {
        const result = await validator.validateAsync(data);
        
        if (!result.success) {
          errors.push(...result.errors);
        } else {
          validData = result.data;
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, data: validData! };
    },
  };
}

/**
 * Create a validator with custom error messages
 */
export function withCustomErrors<T>(
  validator: Validator<T>,
  errorMap: Record<string, string>
): Validator<T> {
  return {
    validate(data: unknown): ValidationResult<T> {
      const result = validator.validate(data);
      
      if (!result.success) {
        return {
          success: false,
          errors: result.errors.map(err => ({
            ...err,
            message: errorMap[err.code] || err.message,
          })),
        };
      }
      
      return result;
    },

    async validateAsync(data: unknown): Promise<ValidationResult<T>> {
      const result = await validator.validateAsync(data);
      
      if (!result.success) {
        return {
          success: false,
          errors: result.errors.map(err => ({
            ...err,
            message: errorMap[err.code] || err.message,
          })),
        };
      }
      
      return result;
    },
  };
}

/**
 * Create a validator that transforms data after validation
 */
export function withTransform<T, U>(
  validator: Validator<T>,
  transform: (data: T) => U
): Validator<U> {
  return {
    validate(data: unknown): ValidationResult<U> {
      const result = validator.validate(data);
      
      if (!result.success) {
        return result;
      }
      
      try {
        return { success: true, data: transform(result.data) };
      } catch (error) {
        return {
          success: false,
          errors: [{
            field: '',
            message: `Transform error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'transform_error',
          }],
        };
      }
    },

    async validateAsync(data: unknown): Promise<ValidationResult<U>> {
      const result = await validator.validateAsync(data);
      
      if (!result.success) {
        return result;
      }
      
      try {
        return { success: true, data: transform(result.data) };
      } catch (error) {
        return {
          success: false,
          errors: [{
            field: '',
            message: `Transform error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'transform_error',
          }],
        };
      }
    },
  };
}

/**
 * Validate data against a schema and throw on error
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = formatZodErrors(result.error);
    const message = errorMessage || `Validation failed: ${errors.map(e => e.message).join(', ')}`;
    throw new Error(message);
  }
  
  return result.data;
}

/**
 * Check if data is valid without throwing
 */
export function isValid<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): data is T {
  return schema.safeParse(data).success;
}

/**
 * Create a partial validator (all fields optional)
 */
export function createPartialValidator<T>(
  schema: z.ZodObject<any>
): Validator<Partial<T>> {
  const partialSchema = schema.partial();
  return createValidator(partialSchema as any);
}

/**
 * Create a strict validator (no extra fields allowed)
 */
export function createStrictValidator<T>(
  schema: z.ZodObject<any>
): Validator<T> {
  const strictSchema = schema.strict();
  return createValidator(strictSchema as any);
}

/**
 * Batch validate multiple items
 */
export function batchValidate<T>(
  validator: Validator<T>,
  items: unknown[]
): { valid: T[]; invalid: Array<{ item: unknown; errors: ValidationError[] }> } {
  const valid: T[] = [];
  const invalid: Array<{ item: unknown; errors: ValidationError[] }> = [];

  for (const item of items) {
    const result = validator.validate(item);
    
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ item, errors: result.errors });
    }
  }

  return { valid, invalid };
}

/**
 * Create a conditional validator
 */
export function createConditionalValidator<T>(
  condition: (data: unknown) => boolean,
  trueValidator: Validator<T>,
  falseValidator: Validator<T>
): Validator<T> {
  return {
    validate(data: unknown): ValidationResult<T> {
      const validator = condition(data) ? trueValidator : falseValidator;
      return validator.validate(data);
    },

    async validateAsync(data: unknown): Promise<ValidationResult<T>> {
      const validator = condition(data) ? trueValidator : falseValidator;
      return validator.validateAsync(data);
    },
  };
}