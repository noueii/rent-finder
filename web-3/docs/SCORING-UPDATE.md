# Scoring System Update - January 2025

## Changes Made

### 1. Removed Score Toggle
- Scores are now **always visible** across the entire app
- Default sorting is now "Best Match" (by score)
- No need to manually enable scores

### 2. Improved Score Display
- New clean badge showing "X% match" 
- Color-coded based on score:
  - 90%+ = Green
  - 75-89% = Emerald  
  - 60-74% = Blue
  - 40-59% = Amber
  - Below 40% = Gray
- Consistent display across all pages

### 3. Where Scores Appear
- **Apartment Cards**: Top-right corner with "X% match" badge
- **List View**: Every apartment shows its match percentage
- **Browse/Swipe Mode**: Match score shown in card details
- **Apartment Details Page**: Score badge next to the title
- **Search Results**: Always sorted by Best Match by default

### 4. Server-Side Sorting
- Scores are sorted on the server for proper pagination
- All apartments in the list are considered, not just visible ones
- "Best Match" sorting shows highest scoring apartments first

### 5. Always-On Calculation
- Scores automatically calculate when viewing a list
- "Calculate All" button remains available to force recalculation
- Scores are cached for 24 hours

## How It Works Now

1. **When you view a list**: Scores are automatically calculated for visible apartments
2. **Click "Calculate All"**: Calculates scores for ALL apartments in the list
3. **Sorting**: "Best Match" properly sorts all apartments by score (server-side)
4. **Display**: Clean "X% match" badges on every apartment

## Recommended Target Values

If all apartments show 100%, your targets are too lenient. Try these competitive values:
- **Price**: ¥70,000 or less (only top 25% of apartments)
- **Size**: 28m² or more (only top 25% of apartments)  
- **Commute**: 15 minutes or less (only top 10% of routes)

Update in Settings → Preferences.