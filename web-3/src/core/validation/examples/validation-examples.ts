/**
 * Examples of using the validation system
 * These examples show common patterns and best practices
 */

import { z } from 'zod';
import {
  createValidator,
  validateOrThrow,
  isValid,
  batchValidate,
  withTransform
} from '../validators';
import type { ValidationError } from '../validators';
import {
  apartmentFilterSchema,
  userPreferencesSchema,
  commuteSearchSchema,
  emailSchema,
  paginationSchema
} from '../schemas';
import type { ApartmentFilter, UserPreferences } from '../schemas';

/**
 * Example 1: Basic validation in an API route
 */
export async function apiRouteExample(req: any, res: any) {
  try {
    // Validate request body
    const filterValidator = createValidator(apartmentFilterSchema);
    const result = filterValidator.validate(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.errors,
      });
    }
    
    // Use validated data
    const apartments = await searchApartments(result.data);
    res.json({ apartments });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Example 2: Validate and throw pattern
 */
export function validateAndThrowExample(input: unknown) {
  // This will throw if validation fails
  const validData = validateOrThrow(
    userPreferencesSchema,
    input,
    'Invalid user preferences'
  );
  
  // TypeScript knows validData is UserPreferences
  console.log('Max commute:', validData.maxCommute);
  
  return validData;
}

/**
 * Example 3: Type guard validation
 */
export function processIfValid(data: unknown) {
  // Check if data is valid without throwing
  if (isValid(emailSchema, data)) {
    // TypeScript knows data is a valid email string
    sendEmail(data);
  } else {
    console.error('Invalid email provided');
  }
}

/**
 * Example 4: Batch validation
 */
export function batchValidationExample(items: unknown[]) {
  const validator = createValidator(apartmentFilterSchema);
  const { valid, invalid } = batchValidate(validator, items);
  
  console.log(`Valid items: ${valid.length}`);
  console.log(`Invalid items: ${invalid.length}`);
  
  // Process valid items
  valid.forEach(filter => {
    console.log('Processing filter:', filter);
  });
  
  // Log invalid items
  invalid.forEach(({ item, errors }) => {
    console.error('Invalid item:', item);
    console.error('Errors:', errors);
  });
}

/**
 * Example 5: Transform after validation
 */
export function transformExample() {
  // Create a validator that normalizes data after validation
  const normalizedEmailValidator = withTransform(
    createValidator(emailSchema),
    (email) => email.toLowerCase().trim()
  );
  
  const result = normalizedEmailValidator.validate('  USER@EXAMPLE.COM  ');
  if (result.success) {
    console.log(result.data); // "user@example.com"
  }
}

/**
 * Example 6: Extending schemas
 */
export function extendSchemaExample() {
  // Note: apartmentFilterSchema has refinements, so it cannot be extended directly
  // Instead, create a new schema that includes the base fields
  const customFilterSchema = z.object({
    // Include all fields from apartmentFilterSchema manually or use intersection
    priceMin: z.number().nonnegative().optional(),
    priceMax: z.number().nonnegative().optional(),
    sizeMin: z.number().nonnegative().optional(),
    sizeMax: z.number().nonnegative().optional(),
    // Add custom fields
    customField: z.string(),
    scoreThreshold: z.number().min(0).max(100),
  });
  
  const validator = createValidator(customFilterSchema);
  const result = validator.validate({
    priceMax: 150000,
    customField: 'special',
    scoreThreshold: 80,
  });
  
  return result;
}

/**
 * Example 7: Async validation with external checks
 */
export async function asyncValidationExample(input: unknown) {
  // Create a schema with async refinement
  const emailWithAvailabilityCheck = emailSchema.refine(
    async (email) => {
      // Check if email is already in use
      const exists = await checkEmailExists(email);
      return !exists;
    },
    { message: 'Email is already in use' }
  );
  
  const validator = createValidator(emailWithAvailabilityCheck);
  const result = await validator.validateAsync(input);
  
  return result;
}

/**
 * Example 8: Form validation with React Hook Form
 */
export function formValidationExample() {
  // Use with react-hook-form
  const formSchema = commuteSearchSchema;
  
  // Extract type for form data
  type FormData = z.infer<typeof formSchema>;
  
  // Use in your form component
  /*
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      maxCommuteMinutes: 30,
      filters: {},
    },
  });
  */
}

/**
 * Example 9: Partial validation for updates
 */
export function partialValidationExample(updates: unknown) {
  // Make all fields optional for partial updates
  const partialSchema = userPreferencesSchema.partial();
  const validator = createValidator(partialSchema);
  
  const result = validator.validate(updates);
  if (result.success) {
    // Only provided fields are validated
    updateUserPreferences(result.data);
  }
}

/**
 * Example 10: Custom error handling
 */
export function customErrorHandling(input: unknown) {
  const validator = createValidator(apartmentFilterSchema);
  const result = validator.validate(input);
  
  if (!result.success) {
    // Group errors by field
    const errorsByField = result.errors.reduce((acc, error) => {
      if (!acc[error.field]) {
        acc[error.field] = [];
      }
      acc[error.field]!.push(error.message);
      return acc;
    }, {} as Record<string, string[]>);
    
    // Create user-friendly error messages
    const friendlyErrors = Object.entries(errorsByField).map(
      ([field, messages]) => `${field}: ${messages.join(', ')}`
    );
    
    throw new Error(`Validation failed:\n${friendlyErrors.join('\n')}`);
  }
  
  return result.data;
}

/**
 * Example 11: Conditional validation
 */
export function conditionalValidationExample() {
  // Schema that changes based on a field value
  const conditionalSchema = z.object({
    type: z.enum(['standard', 'commute']),
    // Other fields depend on type
  }).passthrough().superRefine((data, ctx) => {
    if (data.type === 'commute') {
      // Validate commute-specific fields
      const commuteResult = commuteSearchSchema.safeParse(data);
      if (!commuteResult.success) {
        commuteResult.error.errors.forEach(err => {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err.message,
            path: err.path,
          });
        });
      }
    }
  });
  
  return createValidator(conditionalSchema);
}

/**
 * Example 12: Combining multiple schemas
 */
export function combineSchemas() {
  // Combine pagination with filters
  const searchRequestSchema = z.object({
    pagination: paginationSchema,
    filters: apartmentFilterSchema,
    includeStats: z.boolean().optional(),
  });
  
  return createValidator(searchRequestSchema);
}

// Helper functions (placeholders)
async function searchApartments(filter: ApartmentFilter): Promise<any[]> {
  return [];
}

function sendEmail(email: string): void {
  console.log('Sending email to:', email);
}

async function checkEmailExists(email: string): Promise<boolean> {
  return false;
}

function updateUserPreferences(prefs: Partial<UserPreferences>): void {
  console.log('Updating preferences:', prefs);
}