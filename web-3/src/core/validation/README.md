# Core Validation Module

This module provides centralized validation schemas and utilities for the entire application.

## Purpose

- **Centralize** all validation logic in one place
- **Standardize** validation patterns across the codebase
- **Provide** reusable validation schemas
- **Ensure** consistent error handling
- **Support** both sync and async validation

## Structure

```
src/core/validation/
├── schemas/
│   ├── common.ts      # Common reusable schemas
│   ├── apartment.ts   # Apartment-related schemas
│   ├── user.ts        # User & auth schemas
│   ├── search.ts      # Search parameter schemas
│   ├── scraper.ts     # Scraper validation schemas
│   ├── admin.ts       # Admin panel schemas
│   └── index.ts       # Central exports
├── validators.ts      # Validation utilities
├── types.ts          # TypeScript interfaces
├── examples/         # Usage examples
├── MIGRATION.md      # Migration guide
└── README.md        # This file
```

## Quick Start

### Basic Usage

```typescript
import { createValidator, apartmentFilterSchema } from '@/core/validation';

// Create a validator
const validator = createValidator(apartmentFilterSchema);

// Validate data
const result = validator.validate(userInput);

if (result.success) {
  // Use validated data
  console.log(result.data);
} else {
  // Handle errors
  console.error(result.errors);
}
```

### Common Imports

```typescript
// Import specific schemas
import { 
  emailSchema, 
  paginationSchema,
  apartmentFilterSchema 
} from '@/core/validation/schemas';

// Import validators
import { 
  createValidator, 
  validateOrThrow,
  isValid 
} from '@/core/validation';

// Import pre-built collections
import { formSchemas, apiSchemas } from '@/core/validation/schemas';
```

## Available Schemas

### Common Schemas (`schemas/common.ts`)
- `emailSchema` - Email validation
- `urlSchema` - URL validation
- `cuidSchema` - CUID validation
- `paginationSchema` - Pagination parameters
- `coordinatesSchema` - Geographic coordinates
- `priceRangeSchema` - Price min/max ranges
- `timeRangeSchema` - Date/time ranges

### Apartment Schemas (`schemas/apartment.ts`)
- `apartmentFilterSchema` - Search filters
- `apartmentCreateSchema` - Creation validation
- `apartmentUpdateSchema` - Update validation
- `apartmentStationSchema` - Station info
- `apartmentFeesSchema` - Japanese fee structure

### User Schemas (`schemas/user.ts`)
- `userRegistrationSchema` - User signup
- `userLoginSchema` - User signin
- `userPreferencesSchema` - User preferences
- `scoreWeightsSchema` - Scoring configuration
- `createListSchema` - List creation

### Search Schemas (`schemas/search.ts`)
- `standardSearchSchema` - Basic search
- `commuteSearchSchema` - Commute-based search
- `stationSearchSchema` - Station search
- `quickSearchSchema` - Autocomplete search

## Validation Utilities

### Creating Validators

```typescript
// From Zod schema
const validator = createValidator(schema);

// With custom errors
const validatorWithErrors = withCustomErrors(validator, {
  'too_small': 'Value is too small',
  'invalid_type': 'Invalid data type',
});

// With transformation
const transformingValidator = withTransform(
  validator,
  (data) => ({ ...data, normalized: true })
);
```

### Validation Methods

```typescript
// Validate and get result
const result = validator.validate(data);

// Validate and throw
const validData = validateOrThrow(schema, data);

// Check validity
if (isValid(schema, data)) {
  // data is valid
}

// Batch validation
const { valid, invalid } = batchValidate(validator, items);
```

## Best Practices

1. **Use Existing Schemas**: Check if a schema exists before creating new ones
2. **Extend When Needed**: Use `.extend()` to add fields to existing schemas
3. **Keep Schemas Pure**: Don't include business logic in schemas
4. **Document Complex Schemas**: Add comments for non-obvious validations
5. **Use Type Inference**: Let TypeScript infer types from schemas

## Examples

### API Route Validation

```typescript
export const apartmentRouter = createTRPCRouter({
  search: publicProcedure
    .input(apartmentFilterSchema)
    .query(async ({ input }) => {
      // input is fully typed and validated
      return searchApartments(input);
    }),
});
```

### Form Validation

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userPreferencesSchema } from '@/core/validation/schemas';

type FormData = z.infer<typeof userPreferencesSchema>;

function PreferencesForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(userPreferencesSchema),
  });
  // ...
}
```

### Custom Validation

```typescript
// Extend existing schema
const customApartmentSchema = apartmentCreateSchema.extend({
  customField: z.string(),
  tags: z.array(z.string()),
});

// Conditional validation
const conditionalSchema = z.object({
  type: z.enum(['basic', 'advanced']),
  // ... other fields
}).superRefine((data, ctx) => {
  if (data.type === 'advanced') {
    // Additional validation for advanced type
  }
});
```

## Migration

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions from old validation patterns.

## Performance

- Schemas are compiled once and reused
- Validation is synchronous by default (fast)
- Async validation available for external checks
- Use `partial()` for update operations to avoid validating all fields

## Error Handling

All validation errors follow this format:

```typescript
interface ValidationError {
  field: string;    // Dot-notation path to field
  message: string;  // Human-readable error
  code: string;     // Zod error code
}
```

## Owner: DO (DevOps Agent)

This module is maintained by the DevOps agent. For questions or modifications, please coordinate through the refactoring progress tracker.