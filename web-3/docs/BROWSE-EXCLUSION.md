# Browse Page Exclusion Feature

## Overview
The browse/swipe page now automatically excludes apartments that you've already liked or hidden, preventing you from seeing the same apartments multiple times.

## How It Works

### 1. Automatic Filtering
When you browse apartments:
- **Liked apartments** are automatically hidden from browse view
- **Hidden apartments** are automatically hidden from browse view
- You only see fresh apartments you haven't acted on yet

### 2. Implementation
- The `getApartments` API endpoint accepts an `excludeListTypes` parameter
- Browse page passes `['LIKED', 'HIDDEN']` to exclude these list types
- Server-side filtering ensures proper pagination

### 3. Benefits
- **No duplicates**: You won't see apartments you've already swiped on
- **Efficient browsing**: Focus only on new options
- **Clean experience**: Your liked/hidden choices are respected

## Technical Details

### API Parameter
```typescript
excludeListTypes: ['LIKED', 'HIDDEN', 'BOOKMARKED', 'FAVORITED']
```

### How Exclusion Works
1. System finds all your lists of specified types (LIKED, HIDDEN)
2. Collects all apartment IDs from those lists
3. Excludes those apartments from the browse results
4. Returns only apartments you haven't acted on

### Performance
- Exclusion happens server-side for efficiency
- Works seamlessly with pagination
- No impact on browse speed

## User Experience
- Swipe right → Apartment goes to "Liked" → Won't appear in browse again
- Swipe left → Apartment goes to "Hidden" → Won't appear in browse again
- Fresh apartments only in your browse queue