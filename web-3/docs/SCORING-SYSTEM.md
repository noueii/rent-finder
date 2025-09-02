# Apartment Scoring System

## Overview
The apartment scoring system calculates personalized scores (0-100) for each apartment based on your preferences and target values.

## How Scoring Works

### 1. Target-Based Scoring
The system only penalizes apartments that are **worse** than your target values:
- **At or better than target** = 100% score for that factor
- **Worse than target** = Score reduced based on how far from target

### 2. Factors Considered
1. **Price** - Monthly rent
2. **Size** - Square meters
3. **Commute Time** - Minutes to your workplace/school
4. **Building Age** - Years since construction
5. **Floor Level** - Which floor the apartment is on
6. **Walking Time** - Minutes to nearest station

### 3. Weighted Calculation
Each factor has a weight (must total 100%):
- Default: Commute 25%, Price 25%, Size 20%, Age 10%, Floor 10%, Walk 10%
- You can adjust these in Settings

## When Scores Are Calculated

### Automatic Triggers

1. **When you enable the score toggle** (🎯 button)
   - If scores don't exist in the database, they're calculated automatically
   - Scores are cached for 24 hours

2. **When viewing a list with scores enabled**
   - The `useApartmentScores` hook checks if scores exist
   - If not, it triggers calculation for all visible apartments

3. **When your preferences change**
   - All existing scores are invalidated
   - New scores calculated on next view

### Manual Triggers

1. **Calculate Scores button** (when available)
   - Forces recalculation of all scores in a list
   - Useful after adding new apartments

2. **API Endpoints**
   ```typescript
   // Calculate scores for specific apartments
   api.score.calculateScores.mutate({
     apartmentIds: ["apt1", "apt2"],
     listId: "list123",
     forceRecalculate: true
   });

   // Calculate scores for entire list
   api.score.calculateListScores.mutate({
     listId: "list123"
   });
   ```

## Score Storage

Scores are stored in the `ApartmentScore` table:
- Linked to user, apartment, and optionally a list
- Only the final score value is stored (0-100)
- Cached for 24 hours or until preferences change
- Unique per user-apartment-list combination

## Performance Optimization

1. **Database Caching**
   - Scores are calculated once and stored
   - Reused across page loads
   - Batch calculation for efficiency

2. **Lazy Loading**
   - Scores only calculated when needed
   - Not calculated until score toggle is enabled

3. **Automatic Invalidation**
   - When preferences change, old scores are deleted
   - Ensures scores always reflect current preferences

## Troubleshooting

### All apartments showing 100%?
Your target values are too easy to meet. Try:
1. Run `npm run db:analyze-targets` to see apartment distribution
2. Use the "competitive" suggestions (only top 25% get 100%)
3. Adjust targets in Settings

### Scores not updating?
1. Check if you've saved your preference changes
2. Try the "Calculate Scores" button if available
3. Scores are cached for 24 hours - force recalculation if needed

### Scores not showing?
1. Make sure the score toggle is enabled
2. Check that you're logged in (scores are user-specific)
3. Ensure you've set target values in Settings