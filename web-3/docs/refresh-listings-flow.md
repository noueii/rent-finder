# Refresh Listings Process Flow

## Visual Flow Diagram

```mermaid
graph TD
    A[User clicks Refresh button<br/>in Liked Apartments page] --> B[Frontend: lists/page.tsx<br/>calls refreshAllApartments mutation]
    
    B --> C[Backend: list.ts router<br/>refreshAllApartments procedure]
    
    C --> D{Verify list ownership<br/>or admin access}
    D -->|Access Denied| E[Return error:<br/>List not found]
    D -->|Access Granted| F[Load list with all apartments<br/>from database]
    
    F --> G[Process each apartment<br/>in the list]
    
    G --> H{Check apartment data}
    H -->|Missing URL/Site| I[Skip: Add to<br/>missingData count]
    H -->|Apartment removed=true| J[Skip: Add to<br/>removedCount]
    H -->|Valid data| K[Check source site]
    
    K --> L{Map sourceSite to<br/>scraper type}
    L -->|realestate.co.jp| M[scraper: realestate]
    L -->|yolo-japan.com| N[scraper: yolo-japan]
    L -->|wagaya-japan.com| O[scraper: wagaya-japan]
    L -->|Unknown site| P[Skip: Add to<br/>unknownSource count]
    
    M --> Q[Group URLs by<br/>scraper type]
    N --> Q
    O --> Q
    
    Q --> R[Create job batches<br/>50 URLs per job]
    
    R --> S[Add jobs to queue:<br/>update-apartments-by-urls]
    
    S --> T[Return response:<br/>- Total: 222<br/>- Queued: 145<br/>- Skipped: 77]
    
    T --> U[Frontend shows<br/>success message]
    
    %% Job Processing Flow
    S --> V[Job Queue processes<br/>each job asynchronously]
    
    V --> W[Job Processor:<br/>processors.ts]
    
    W --> X[Create scraper instance<br/>for the source type]
    
    X --> Y[Call fetchApartmentsByUrls<br/>with progress callback]
    
    Y --> Z[For each URL in batch]
    
    Z --> AA{Fetch apartment<br/>detail page}
    AA -->|HTTP 404| AB[Mark as removed<br/>in database]
    AA -->|Success| AC[Extract apartment data<br/>using scraper logic]
    
    AC --> AD[Update apartment in DB<br/>via ApartmentUpdater]
    
    AB --> AE[Update timestamps:<br/>lastDetailCheck, updatedAt]
    AD --> AE
    
    AE --> AF[Progress callback<br/>updates job status]
    
    AF --> AG{More URLs?}
    AG -->|Yes| Z
    AG -->|No| AH[Job complete]
    
    %% Visual grouping
    style A fill:#e1f5fe
    style B fill:#e1f5fe
    style U fill:#e1f5fe
    
    style C fill:#fff3e0
    style F fill:#fff3e0
    style G fill:#fff3e0
    style Q fill:#fff3e0
    style R fill:#fff3e0
    style S fill:#fff3e0
    style T fill:#fff3e0
    
    style V fill:#f3e5f5
    style W fill:#f3e5f5
    style X fill:#f3e5f5
    style Y fill:#f3e5f5
    style AA fill:#f3e5f5
    style AC fill:#f3e5f5
    style AD fill:#f3e5f5
    
    style I fill:#ffebee
    style J fill:#ffebee
    style P fill:#ffebee
    style AB fill:#ffebee
```

## Detailed Process Breakdown

### 1. Frontend Initiation (Blue)
- User is on `/lists` page viewing their "Liked Apartments" list
- Clicks the refresh button which triggers `refreshAllApartments` mutation
- Shows loading state while processing

### 2. Backend Processing (Orange)
1. **Access Control**
   - Verifies user owns the list or is admin
   - Returns error if unauthorized

2. **Data Loading**
   - Loads complete list with all apartment references
   - Total example: 222 apartments

3. **Filtering & Grouping**
   - **Skip removed apartments**: `apartment.removed === true`
   - **Skip missing data**: No `sourceUrl` or `sourceSite`
   - **Skip unknown sources**: Can't map to scraper
   - **Group by scraper type**: Organize remaining URLs

4. **Job Creation**
   - Batches URLs (50 per job)
   - Creates background jobs for each batch
   - Returns summary to frontend

### 3. Asynchronous Job Processing (Purple)
1. **Job Execution**
   - Each job runs independently
   - Creates appropriate scraper instance
   - Processes URLs one by one

2. **Apartment Fetching**
   - Fetches detail page for each URL
   - Checks for removal (404 = removed)
   - Extracts updated data if available

3. **Database Updates**
   - Updates apartment details
   - Marks removed apartments
   - Updates timestamps (lastDetailCheck, updatedAt)
   - Tracks progress for UI updates

## Example Numbers (Your Case)

```
Initial State:
- Total apartments in list: 222
- Active apartments: 145
- Skipped apartments: 77

Breakdown of 77 skipped:
- Removed (already marked): ~40-50
- Missing sourceUrl/sourceSite: ~20-30
- Unknown source sites: ~5-10

Processing:
- 145 apartments → ~3 jobs (50 per job)
- Each job processes in parallel
- Updates complete in 1-3 minutes typically
```

## Key Points

1. **Only active listings are refreshed** - Removed apartments stay removed
2. **Batch processing** - Prevents overwhelming scrapers
3. **Asynchronous execution** - UI remains responsive
4. **Progress tracking** - Real-time updates via job queue
5. **Error handling** - Failed fetches don't stop the process

## Code References

- **Frontend trigger**: `src/app/lists/page.tsx`
- **Backend mutation**: `src/server/api/routers/list.ts:refreshAllApartments`
- **Job processor**: `src/lib/jobs/processors.ts:update-apartments-by-urls`
- **Scraper logic**: `src/lib/scrapers/apartment-scraper.ts:fetchApartmentsByUrls`
- **Update logic**: `src/lib/scrapers/utils/apartment-updater.ts`