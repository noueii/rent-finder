# Validation Schema Migration Guide

This guide helps you migrate from scattered validation schemas to the centralized validation system.

## Overview

All validation schemas have been extracted and centralized in `src/core/validation/schemas/`. This provides:

- ✅ Consistent validation across the application
- ✅ Reusable schema components
- ✅ Type-safe validation with proper error handling
- ✅ Better maintainability and discoverability

## Migration Steps

### 1. Update Your Imports

**Before:**
```typescript
// In various files
const apartmentFilterSchema = z.object({
  priceMin: z.number().min(0).optional(),
  // ... defined inline
});
```

**After:**
```typescript
import { apartmentFilterSchema } from '@/core/validation/schemas';
// or more specifically
import { apartmentFilterSchema } from '@/core/validation/schemas/apartment';
```

### 2. Common Import Patterns

```typescript
// Import specific schemas
import { 
  emailSchema,
  paginationSchema,
  apartmentFilterSchema,
  userPreferencesSchema 
} from '@/core/validation/schemas';

// Import schema collections
import { apartmentSchemas, userSchemas } from '@/core/validation/schemas';

// Import pre-built form schemas
import { formSchemas } from '@/core/validation/schemas';
const registrationData = formSchemas.registration.parse(input);

// Import API schemas
import { apiSchemas } from '@/core/validation/schemas';
const paginatedRequest = apiSchemas.pagination.parse(req.query);
```

### 3. Using Validators

```typescript
import { createValidator, validateOrThrow } from '@/core/validation';
import { apartmentCreateSchema } from '@/core/validation/schemas';

// Create a validator
const apartmentValidator = createValidator(apartmentCreateSchema);

// Validate data
const result = apartmentValidator.validate(input);
if (!result.success) {
  console.error('Validation errors:', result.errors);
  return;
}

// Or validate and throw
const validData = validateOrThrow(apartmentCreateSchema, input);
```

### 4. Schema Mapping

| Old Location | New Import |
|--------------|-----------|
| `src/lib/validation/forms.ts` | `@/core/validation/schemas/user` |
| `src/lib/scrapers/validation.ts` | `@/core/validation/schemas/scraper` |
| Router inline schemas | `@/core/validation/schemas/*` |

#### Specific Schemas

**Apartment Schemas:**
- `apartmentFilterSchema` - Filtering apartments
- `apartmentCreateSchema` - Creating new apartments
- `apartmentUpdateSchema` - Updating apartments
- `apartmentStationSchema` - Station data
- `apartmentImageSchema` - Image data
- `apartmentFeesSchema` - Fee structure

**User Schemas:**
- `userRegistrationSchema` - User registration
- `userLoginSchema` - User login
- `userPreferencesSchema` - User preferences
- `scoreWeightsSchema` - Scoring weights
- `createListSchema` - Creating lists
- `reportIssueSchema` - Issue reporting

**Search Schemas:**
- `standardSearchSchema` - Standard search
- `commuteSearchSchema` - Commute-based search
- `stationSearchSchema` - Station search
- `apartmentSortSchema` - Sorting options

**Common Schemas:**
- `emailSchema` - Email validation
- `urlSchema` - URL validation
- `paginationSchema` - Pagination params
- `coordinatesSchema` - Lat/lng coordinates
- `priceRangeSchema` - Price ranges

### 5. Extending Schemas

```typescript
import { apartmentBaseSchema } from '@/core/validation/schemas';

// Extend existing schema
const myCustomSchema = apartmentBaseSchema.extend({
  customField: z.string(),
  anotherField: z.number(),
});

// Make all fields optional
const partialSchema = apartmentCreateSchema.partial();

// Pick specific fields
const priceOnlySchema = apartmentCreateSchema.pick({
  price: true,
  priceMin: true,
  priceMax: true,
});
```

### 6. Creating Custom Validators

```typescript
import { createValidator, withCustomErrors } from '@/core/validation';
import { z } from 'zod';

// Create custom schema
const customSchema = z.object({
  specialField: z.string().regex(/^[A-Z]+$/),
});

// Create validator with custom errors
const validator = withCustomErrors(
  createValidator(customSchema),
  {
    'invalid_string': 'Field must contain only uppercase letters',
  }
);
```

## Best Practices

1. **Import What You Need**: Import specific schemas rather than everything
2. **Use Schema Types**: Export types are provided for all schemas
3. **Validate Early**: Validate at API boundaries and form submissions
4. **Handle Errors**: Always handle validation errors appropriately
5. **Extend Don't Duplicate**: Extend existing schemas rather than creating new ones

## Example Migration

### Before (in router file):
```typescript
// src/server/api/routers/apartment.ts
const filterSchema = z.object({
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  // ... many lines of schema definition
});

export const apartmentRouter = createTRPCRouter({
  search: publicProcedure
    .input(filterSchema)
    .query(async ({ input }) => {
      // ...
    }),
});
```

### After:
```typescript
// src/server/api/routers/apartment.ts
import { apartmentFilterSchema } from '@/core/validation/schemas';

export const apartmentRouter = createTRPCRouter({
  search: publicProcedure
    .input(apartmentFilterSchema)
    .query(async ({ input }) => {
      // ...
    }),
});
```

## Need Help?

- Check `src/core/validation/schemas/` for available schemas
- Look at type definitions in each schema file
- Use TypeScript autocomplete to discover schemas
- Refer to examples in `src/core/validation/examples/`

Remember: The goal is consistency and reusability. When in doubt, check if a schema already exists before creating a new one!