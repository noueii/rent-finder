# List Visibility Toggles

## Overview
The list page now includes toggles to control which apartments are visible based on their presence in your special lists (Liked, Hidden, Bookmarked, Favorited).

## Default Behavior
By default:
- **Liked** ✅ - Shown
- **Hidden** ❌ - Not shown (hidden by default)
- **Bookmarked** ✅ - Shown
- **Favorited** ✅ - Shown

This means apartments you've explicitly hidden won't appear unless you turn on the "Hidden" toggle.

## How It Works

### 1. Toggle Controls
Located below the sort controls, you'll find switches for each list type:
- 🤍 **Liked** - Apartments you've liked
- 👁️ **Hidden** - Apartments you've hidden
- 🔖 **Bookmarked** - Apartments you've bookmarked
- ⭐ **Favorited** - Apartments you've favorited

### 2. Filtering Logic
When a toggle is OFF, apartments in that list type are excluded from view:
- Turn OFF "Hidden" → Hidden apartments won't show
- Turn OFF "Liked" → Liked apartments won't show
- And so on...

### 3. Use Cases

#### Viewing Fresh Apartments Only
Turn OFF all toggles to see only apartments you haven't acted on:
- Liked: OFF
- Hidden: OFF
- Bookmarked: OFF
- Favorited: OFF

#### Reviewing Hidden Apartments
Sometimes you might want to reconsider hidden apartments:
- Hidden: ON (turn it on to see them)

#### Focus on Favorites
See only your top picks:
- Turn OFF everything except Favorited

## Technical Implementation

### API Enhancement
The `getApartments` endpoint now accepts `excludeListTypes`:
```typescript
excludeListTypes: ['LIKED', 'HIDDEN', 'BOOKMARKED', 'FAVORITED']
```

### Server-Side Filtering
1. Finds user's lists of specified types
2. Collects apartment IDs from those lists
3. Excludes them from results using `notIn`
4. Works with pagination

### Performance
- Filtering happens server-side
- Efficient database queries
- No client-side filtering needed

## Benefits
- **Customizable views** - See exactly what you want
- **No duplicates** - Hidden stays hidden by default
- **Easy recovery** - Can always turn on Hidden to review
- **Clean browsing** - Focus on what matters