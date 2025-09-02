/**
 * Tests for validation utilities
 */

import { z } from 'zod';
import {
  createValidator,
  combineValidators,
  withCustomErrors,
  withTransform,
  validateOrThrow,
  isValid,
  createPartialValidator,
  createStrictValidator,
  batchValidate,
  createConditionalValidator
} from '../validators';

describe('Validation Utilities', () => {
  // Test schema
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(0).max(150),
    email: z.string().email(),
  });

  describe('createValidator', () => {
    it('should create a working validator', () => {
      const validator = createValidator(testSchema);
      
      const validData = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
      };
      
      const result = validator.validate(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should return errors for invalid data', () => {
      const validator = createValidator(testSchema);
      
      const invalidData = {
        name: '',
        age: -5,
        email: 'not-an-email',
      };
      
      const result = validator.validate(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors.find(e => e.field === 'name')).toBeDefined();
        expect(result.errors.find(e => e.field === 'age')).toBeDefined();
        expect(result.errors.find(e => e.field === 'email')).toBeDefined();
      }
    });

    it('should support async validation', async () => {
      const asyncSchema = z.string().refine(
        async (val) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return val.length > 5;
        },
        { message: 'String must be longer than 5 characters' }
      );
      
      const validator = createValidator(asyncSchema);
      
      const result = await validator.validateAsync('short');
      expect(result.success).toBe(false);
      
      const result2 = await validator.validateAsync('long string');
      expect(result2.success).toBe(true);
    });
  });

  describe('combineValidators', () => {
    it('should combine multiple validators', () => {
      const validator1 = createValidator(z.object({ a: z.string(), b: z.number() }));
      const validator2 = createValidator(z.object({ a: z.string(), b: z.number() }));
      
      const combined = combineValidators(validator1, validator2);
      
      const result = combined.validate({ a: 'test', b: 123 });
      expect(result.success).toBe(true);
    });

    it('should collect all errors from combined validators', () => {
      const validator1 = createValidator(z.object({ a: z.string().min(5), b: z.number() }));
      const validator2 = createValidator(z.object({ a: z.string(), b: z.number().positive() }));
      
      const combined = combineValidators(validator1, validator2);
      
      const result = combined.validate({ a: 'hi', b: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(2);
      }
    });
  });

  describe('withCustomErrors', () => {
    it('should replace error messages', () => {
      const validator = createValidator(z.string().min(5));
      const customValidator = withCustomErrors(validator, {
        'too_small': 'String is too short!',
      });
      
      const result = customValidator.validate('hi');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe('String is too short!');
      }
    });
  });

  describe('withTransform', () => {
    it('should transform valid data', () => {
      const validator = createValidator(z.string());
      const upperValidator = withTransform(
        validator,
        (str) => str.toUpperCase()
      );
      
      const result = upperValidator.validate('hello');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('HELLO');
      }
    });

    it('should handle transform errors', () => {
      const validator = createValidator(z.any());
      const errorValidator = withTransform(validator, () => {
        throw new Error('Transform failed');
      });
      
      const result = errorValidator.validate('test');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.code).toBe('transform_error');
      }
    });
  });

  describe('validateOrThrow', () => {
    it('should return valid data', () => {
      const data = { name: 'John', age: 30, email: 'john@example.com' };
      const result = validateOrThrow(testSchema, data);
      expect(result).toEqual(data);
    });

    it('should throw on invalid data', () => {
      const data = { name: '', age: -5, email: 'invalid' };
      expect(() => validateOrThrow(testSchema, data)).toThrow();
    });

    it('should use custom error message', () => {
      const data = { invalid: true };
      expect(() => 
        validateOrThrow(testSchema, data, 'Custom error')
      ).toThrow('Custom error');
    });
  });

  describe('isValid', () => {
    it('should return true for valid data', () => {
      const data = { name: 'John', age: 30, email: 'john@example.com' };
      expect(isValid(testSchema, data)).toBe(true);
    });

    it('should return false for invalid data', () => {
      const data = { name: '', age: -5, email: 'invalid' };
      expect(isValid(testSchema, data)).toBe(false);
    });

    it('should work as type guard', () => {
      const data: unknown = { name: 'John', age: 30, email: 'john@example.com' };
      
      if (isValid(testSchema, data)) {
        // TypeScript should know data is valid here
        expect(data.name).toBe('John');
      }
    });
  });

  describe('createPartialValidator', () => {
    it('should make all fields optional', () => {
      const validator = createPartialValidator(testSchema);
      
      const result1 = validator.validate({});
      expect(result1.success).toBe(true);
      
      const result2 = validator.validate({ name: 'John' });
      expect(result2.success).toBe(true);
      
      const result3 = validator.validate({ name: 'John', age: 30 });
      expect(result3.success).toBe(true);
    });
  });

  describe('createStrictValidator', () => {
    it('should reject extra fields', () => {
      const validator = createStrictValidator(testSchema);
      
      const result = validator.validate({
        name: 'John',
        age: 30,
        email: 'john@example.com',
        extra: 'field',
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('batchValidate', () => {
    it('should separate valid and invalid items', () => {
      const validator = createValidator(z.number().positive());
      
      const items = [1, 2, -3, 4, -5, 6];
      const { valid, invalid } = batchValidate(validator, items);
      
      expect(valid).toEqual([1, 2, 4, 6]);
      expect(invalid).toHaveLength(2);
      expect(invalid[0]?.item).toBe(-3);
      expect(invalid[1]?.item).toBe(-5);
    });
  });

  describe('createConditionalValidator', () => {
    it('should use different validators based on condition', () => {
      const evenValidator = createValidator(z.number().refine(n => n % 2 === 0));
      const oddValidator = createValidator(z.number().refine(n => n % 2 === 1));
      
      const conditional = createConditionalValidator(
        (data) => typeof data === 'number' && data % 2 === 0,
        evenValidator,
        oddValidator
      );
      
      const result1 = conditional.validate(4);
      expect(result1.success).toBe(true);
      
      const result2 = conditional.validate(3);
      expect(result2.success).toBe(true);
      
      const result3 = conditional.validate(2.5);
      expect(result3.success).toBe(false);
    });
  });
});