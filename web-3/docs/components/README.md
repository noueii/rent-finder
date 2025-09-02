# Component Library Documentation

## Overview

The Tokyo Apartment Finder component library is a collection of reusable React components built with TypeScript, Tailwind CSS, and Framer Motion. The library follows a modular design pattern with clear separation between UI components, forms, and apartment-specific components.

## Architecture

The component library is organized into three main categories:

```
src/presentation/components/
├── ui/          # Core UI components (Card, Badge, Score, etc.)
├── forms/       # Form components and utilities
└── apartment/   # Apartment-specific composite components
```

## Component Categories

### 1. UI Components

Core building blocks for the application interface.

#### Card Component
A flexible container component with optional hover effects and click handlers.

```tsx
import { Card } from '@/presentation/components/ui';

<Card
  hover={true}
  onClick={() => console.log('clicked')}
  className="p-4"
>
  Card content
</Card>
```

**Props:**
- `children`: React.ReactNode - Card content
- `hover?`: boolean - Enable hover effects (default: false)
- `onClick?`: () => void - Click handler
- `className?`: string - Additional CSS classes

#### Badge Component
Display status or category information with color variants.

```tsx
import { Badge } from '@/presentation/components/ui';

<Badge variant="success">Available</Badge>
<Badge variant="warning">Low Availability</Badge>
<Badge variant="error">Unavailable</Badge>
```

**Props:**
- `children`: React.ReactNode - Badge text
- `variant?`: 'default' | 'success' | 'warning' | 'error' | 'info'
- `className?`: string - Additional CSS classes

#### Score Component
Display numeric scores with optional maximum value and color coding.

```tsx
import { Score } from '@/presentation/components/ui';

<Score value={85} max={100} showMax={true} />
<Score value={4.5} max={5} precision={1} />
```

**Props:**
- `value`: number - Score value
- `max?`: number - Maximum score (default: 100)
- `showMax?`: boolean - Show maximum value (default: false)
- `precision?`: number - Decimal precision (default: 0)
- `size?`: 'sm' | 'md' | 'lg' - Size variant
- `className?`: string - Additional CSS classes

#### Price Component
Format and display monetary values with currency symbols.

```tsx
import { Price } from '@/presentation/components/ui';

<Price amount={150000} currency="JPY" />
<Price amount={1500} currency="USD" showCurrency={true} />
```

**Props:**
- `amount`: number - Price amount
- `currency?`: string - Currency code (default: 'JPY')
- `showCurrency?`: boolean - Show currency symbol
- `className?`: string - Additional CSS classes

#### ImageGallery Component
Display multiple images with navigation and modal view.

```tsx
import { ImageGallery } from '@/presentation/components/ui';

<ImageGallery
  images={[
    { url: '/image1.jpg', alt: 'Living room' },
    { url: '/image2.jpg', alt: 'Bedroom' }
  ]}
  defaultImage="/placeholder.jpg"
/>
```

**Props:**
- `images`: Array<{url: string, alt: string}> - Image data
- `defaultImage?`: string - Fallback image URL
- `className?`: string - Additional CSS classes

#### ActionBar Component
Horizontal bar with action buttons for user interactions.

```tsx
import { ActionBar } from '@/presentation/components/ui';

<ActionBar
  actions={[
    { label: 'Save', icon: <BookmarkIcon />, onClick: handleSave },
    { label: 'Share', icon: <ShareIcon />, onClick: handleShare }
  ]}
  position="bottom"
/>
```

**Props:**
- `actions`: Array<{label: string, icon?: ReactNode, onClick: () => void}>
- `position?`: 'top' | 'bottom' - Bar position
- `className?`: string - Additional CSS classes

### 2. Form Components

A comprehensive set of form components with built-in validation and consistent styling.

#### Form Component
Base form wrapper with card styling and animation support.

```tsx
import { Form } from '@/presentation/components/forms';

<Form
  onSubmit={handleSubmit}
  header="User Registration"
  footer={<p>Already have an account? <a href="/login">Login</a></p>}
>
  {/* Form fields */}
</Form>
```

**Props:**
- `children`: React.ReactNode - Form content
- `onSubmit`: (e: FormEvent) => void - Submit handler
- `header?`: React.ReactNode - Form header
- `footer?`: React.ReactNode - Form footer
- `className?`: string - Additional CSS classes

#### FormField Component
Field wrapper with label, error, and description support.

```tsx
import { FormField } from '@/presentation/components/forms';

<FormField
  label="Email"
  error={errors.email}
  description="We'll never share your email"
  required
>
  <input type="email" {...register('email')} />
</FormField>
```

**Props:**
- `children`: React.ReactNode - Input element
- `label?`: string - Field label
- `error?`: string - Error message
- `description?`: string - Help text
- `required?`: boolean - Required indicator

#### FormInput Component
Styled input with integrated FormField wrapper.

```tsx
import { FormInput } from '@/presentation/components/forms';

<FormInput
  label="Username"
  placeholder="Enter username"
  error={errors.username}
  {...register('username')}
/>
```

**Props:**
- Extends all HTML input props
- `label?`: string - Field label
- `error?`: string - Error message
- `description?`: string - Help text

#### FormTextarea Component
Styled textarea with auto-resize and FormField integration.

```tsx
import { FormTextarea } from '@/presentation/components/forms';

<FormTextarea
  label="Description"
  rows={4}
  maxLength={500}
  error={errors.description}
  {...register('description')}
/>
```

**Props:**
- Extends all HTML textarea props
- `label?`: string - Field label
- `error?`: string - Error message
- `description?`: string - Help text

#### FormSelect Component
Styled select dropdown with FormField integration.

```tsx
import { FormSelect } from '@/presentation/components/forms';

<FormSelect
  label="Country"
  error={errors.country}
  {...register('country')}
>
  <option value="">Select country</option>
  <option value="JP">Japan</option>
  <option value="US">United States</option>
</FormSelect>
```

**Props:**
- Extends all HTML select props
- `label?`: string - Field label
- `error?`: string - Error message
- `description?`: string - Help text

#### FormSlider Component
Range slider with value display and FormField integration.

```tsx
import { FormSlider } from '@/presentation/components/forms';

<FormSlider
  label="Max Commute Time"
  min={0}
  max={120}
  step={5}
  value={commuteTime}
  onChange={setCommuteTime}
  unit="minutes"
/>
```

**Props:**
- `label?`: string - Field label
- `min`: number - Minimum value
- `max`: number - Maximum value
- `step?`: number - Step increment
- `value`: number - Current value
- `onChange`: (value: number) => void - Change handler
- `unit?`: string - Value unit display

#### FormSubmit Component
Submit button with loading state and consistent styling.

```tsx
import { FormSubmit } from '@/presentation/components/forms';

<FormSubmit loading={isSubmitting}>
  Create Account
</FormSubmit>
```

**Props:**
- `children`: React.ReactNode - Button text
- `loading?`: boolean - Loading state
- `disabled?`: boolean - Disabled state
- `className?`: string - Additional CSS classes

#### useForm Hook
Form state management with Zod validation.

```tsx
import { useForm } from '@/presentation/components/forms';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const { register, handleSubmit, errors } = useForm(schema);
```

### 3. Apartment Components

Specialized components for displaying apartment information.

#### ApartmentCard Component
Main card component for apartment listings.

```tsx
import { ApartmentCard } from '@/presentation/components/apartment';

<ApartmentCard
  apartment={apartmentData}
  commuteTime={25}
  onLike={handleLike}
  onBookmark={handleBookmark}
  onView={handleView}
/>
```

**Props:**
- `apartment`: Apartment data object
- `commuteTime?`: number - Commute time in minutes
- `onLike?`: () => void - Like handler
- `onBookmark?`: () => void - Bookmark handler
- `onView?`: () => void - View handler

#### ApartmentPrice Component
Display apartment rent and fees.

```tsx
import { ApartmentPrice } from '@/presentation/components/apartment';

<ApartmentPrice
  rent={150000}
  managementFee={5000}
  keyMoney={150000}
  deposit={150000}
/>
```

**Props:**
- `rent`: number - Monthly rent
- `managementFee?`: number - Monthly management fee
- `keyMoney?`: number - Key money (reikin)
- `deposit?`: number - Security deposit

#### ApartmentScore Component
Display apartment quality score.

```tsx
import { ApartmentScore } from '@/presentation/components/apartment';

<ApartmentScore
  overallScore={85}
  breakdown={{
    location: 90,
    value: 80,
    quality: 85,
    amenities: 88
  }}
/>
```

**Props:**
- `overallScore`: number - Overall score (0-100)
- `breakdown?`: Score breakdown object
- `showBreakdown?`: boolean - Show detailed breakdown

#### ApartmentImages Component
Image gallery for apartment photos.

```tsx
import { ApartmentImages } from '@/presentation/components/apartment';

<ApartmentImages
  images={apartmentImages}
  apartmentTitle="2LDK in Shibuya"
/>
```

**Props:**
- `images`: Array of image objects
- `apartmentTitle`: string - Apartment title for alt text

#### ApartmentActions Component
Action buttons for apartment interactions.

```tsx
import { ApartmentActions } from '@/presentation/components/apartment';

<ApartmentActions
  isLiked={true}
  isBookmarked={false}
  onLike={handleLike}
  onBookmark={handleBookmark}
  onShare={handleShare}
  onReport={handleReport}
/>
```

**Props:**
- `isLiked?`: boolean - Like state
- `isBookmarked?`: boolean - Bookmark state
- `onLike?`: () => void - Like handler
- `onBookmark?`: () => void - Bookmark handler
- `onShare?`: () => void - Share handler
- `onReport?`: () => void - Report handler

## State Management

The component library integrates with three context providers for state management:

### SearchContext
Manages search filters and commute search state.

```tsx
import { useSearch } from '@/contexts/SearchContext';

const { filters, updateFilter, resetFilters } = useSearch();
```

### UserPreferencesContext
Manages user preferences with localStorage persistence.

```tsx
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

const { preferences, updatePreference } = useUserPreferences();
```

### ListManagementContext
Centralized apartment actions (like, bookmark, view).

```tsx
import { useListManagement } from '@/contexts/ListManagementContext';

const { likedApartments, toggleLike } = useListManagement();
```

## Best Practices

### 1. Component Composition
Prefer composition over inheritance. Build complex components by combining simpler ones.

```tsx
// Good: Composed component
<Card>
  <ApartmentImages images={images} />
  <ApartmentPrice rent={rent} />
  <ActionBar actions={actions} />
</Card>

// Avoid: Monolithic component
<ApartmentListingCard {...everything} />
```

### 2. Type Safety
Always provide proper TypeScript types for props.

```tsx
interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
}
```

### 3. Accessibility
Ensure all interactive components are keyboard accessible.

```tsx
<button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  tabIndex={0}
  aria-label="Save apartment"
>
```

### 4. Performance
Use React.memo for components that receive stable props.

```tsx
export const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});
```

### 5. Error Handling
Provide meaningful error states and messages.

```tsx
{error && (
  <div className="text-red-500" role="alert">
    {error.message || 'An error occurred'}
  </div>
)}
```

## Testing

All components include comprehensive test suites. Run tests with:

```bash
npm run test:react
```

Test files are located alongside components in `__tests__` directories.

## Migration Guide

### Updating from Inline Components

1. Identify inline components in your pages
2. Import the equivalent from the component library
3. Update props to match the new interface
4. Remove inline styles in favor of className props

Example migration:

```tsx
// Before
<div className="bg-white p-4 rounded-lg shadow">
  <h3>{apartment.title}</h3>
  <p>¥{apartment.rent}</p>
</div>

// After
import { Card, ApartmentPrice } from '@/presentation/components';

<Card className="p-4">
  <h3>{apartment.title}</h3>
  <ApartmentPrice rent={apartment.rent} />
</Card>
```

## Future Enhancements

- Storybook integration for component playground
- Dark mode support
- Animation variants
- Additional form components (DatePicker, FileUpload)
- Accessibility improvements (ARIA labels, keyboard navigation)

## Contributing

When adding new components:

1. Place in the appropriate directory (ui/, forms/, apartment/)
2. Export from the directory's index.ts
3. Add TypeScript interfaces for all props
4. Include a test file in __tests__/
5. Update this documentation

For questions or support, refer to the main project documentation.