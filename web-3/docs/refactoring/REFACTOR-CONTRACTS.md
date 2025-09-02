# Interface Contracts

**Version**: 1.0.0
**Last Updated**: 2025-01-24
**Status**: DRAFT

> **Important**: All interfaces in this document are contracts between modules. Breaking changes require version bump and migration plan.

## 🎯 Core Contracts (Owner: DO)

### Error Handling
```typescript
// src/core/errors/types.ts
export interface ErrorHandler {
  handle(error: unknown, context?: ErrorContext): ErrorResponse;
  log(error: unknown, context?: ErrorContext): void;
  isOperational(error: Error): boolean;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  stack?: string; // Only in development
}

export class BaseError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public isOperational: boolean = true,
    message?: string
  ) {
    super(message);
  }
}
```

### Validation
```typescript
// src/core/validation/types.ts
export interface Validator<T> {
  validate(data: unknown): ValidationResult<T>;
  validateAsync(data: unknown): Promise<ValidationResult<T>>;
}

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### Dependency Injection
```typescript
// src/core/di/types.ts
export interface Container {
  register<T>(token: InjectionToken<T>, factory: Factory<T>): void;
  registerSingleton<T>(token: InjectionToken<T>, factory: Factory<T>): void;
  resolve<T>(token: InjectionToken<T>): T;
  createScope(): Container;
}

export interface InjectionToken<T> {
  name: string;
  type?: T;
}

export type Factory<T> = (container: Container) => T;
```

## 🗃️ Data Contracts (Owner: BE)

### Repository Pattern
```typescript
// src/domain/repositories/base.ts
export interface BaseRepository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findMany(filter: Filter<T>, options?: QueryOptions): Promise<PaginatedResult<T>>;
  findOne(filter: Filter<T>): Promise<T | null>;
  create(data: CreateInput<T>): Promise<T>;
  update(id: string, data: UpdateInput<T>): Promise<T>;
  delete(id: string): Promise<void>;
  exists(filter: Filter<T>): Promise<boolean>;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  orderBy?: OrderBy;
  include?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export type Filter<T> = Partial<T> & {
  where?: WhereCondition<T>;
};

export type OrderBy = Record<string, 'asc' | 'desc'>;
```

### Apartment Repository
```typescript
// src/domain/repositories/apartment.ts
export interface ApartmentRepository extends BaseRepository<Apartment> {
  findByUrl(url: string): Promise<Apartment | null>;
  findNearStation(stationId: string, radiusKm: number): Promise<Apartment[]>;
  findByCommuteTime(params: CommuteSearchParams): Promise<Apartment[]>;
  markAsRemoved(id: string): Promise<void>;
  updatePrices(id: string, prices: PriceUpdate): Promise<void>;
}

export interface CommuteSearchParams {
  targetStationId: string;
  maxMinutes: number;
  priceRange?: { min?: number; max?: number };
  roomTypes?: string[];
}
```

### Service Interfaces
```typescript
// src/domain/services/types.ts
export interface ApartmentService {
  search(params: SearchParams): Promise<SearchResult>;
  getDetails(id: string): Promise<ApartmentDetails>;
  calculateScore(apartmentId: string, weights: ScoreWeights): Promise<number>;
  refreshData(id: string): Promise<void>;
}

export interface UserService {
  authenticate(credentials: Credentials): Promise<AuthResult>;
  updatePreferences(userId: string, prefs: UserPreferences): Promise<void>;
  getScoreWeights(userId: string): Promise<ScoreWeights>;
}
```

## 🕷️ Scraper Contracts (Owner: SC)

### Scraping Strategy
```typescript
// src/infrastructure/scrapers/types.ts
export interface ScrapingStrategy {
  name: string;
  canHandle(url: string): boolean;
  scrape(url: string, options?: ScrapingOptions): Promise<ScrapedData>;
  scrapeList(url: string, options?: ScrapingOptions): Promise<ScrapedData[]>;
  validate(data: unknown): data is ScrapedData;
}

export interface ScrapingOptions {
  proxy?: ProxyConfig;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  rateLimit?: number;
}

export interface ScrapedData {
  url: string;
  title: string;
  price: number;
  address: string;
  nearestStation?: string;
  walkingMinutes?: number;
  roomLayout?: string;
  size?: number;
  floor?: number;
  age?: number;
  images?: string[];
  description?: string;
  scrapedAt: Date;
  raw?: Record<string, unknown>;
}
```

### Proxy Management
```typescript
// src/infrastructure/scrapers/proxy/types.ts
export interface ProxyManager {
  getProxy(): Promise<ProxyConfig | null>;
  reportSuccess(proxy: ProxyConfig): void;
  reportFailure(proxy: ProxyConfig, reason?: string): void;
  blacklist(proxy: ProxyConfig, duration?: number): void;
  getStats(): ProxyStats;
}

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  auth?: {
    username: string;
    password: string;
  };
}
```

## 🎨 UI Contracts (Owner: FE)

### Component Props
```typescript
// src/presentation/components/types.ts
export interface ApartmentCardProps {
  apartment: ApartmentSummary;
  onSelect?: (id: string) => void;
  highlighted?: boolean;
  className?: string;
}

export interface ApartmentSummary {
  id: string;
  title: string;
  price: number;
  mainImage?: string;
  address: string;
  nearestStation: string;
  walkingMinutes: number;
  roomLayout: string;
  size: number;
}

export interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  initialValues?: Partial<SearchParams>;
  loading?: boolean;
}

export interface ScoreDisplayProps {
  score: number;
  breakdown?: ScoreBreakdown;
  size?: 'sm' | 'md' | 'lg';
}
```

### Hook Interfaces
```typescript
// src/presentation/hooks/types.ts
export interface UseApartmentSearchResult {
  apartments: Apartment[];
  loading: boolean;
  error: Error | null;
  pagination: PaginationState;
  search: (params: SearchParams) => Promise<void>;
  loadMore: () => Promise<void>;
}

export interface UseAuthResult {
  user: User | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
}
```

## 🔌 Integration Contracts (Owner: IN)

### External Services
```typescript
// src/infrastructure/external/types.ts
export interface TransitService {
  calculateRoute(from: Coordinates, to: Coordinates): Promise<Route>;
  findNearestStation(location: Coordinates): Promise<Station>;
  getReachableStations(stationId: string, maxMinutes: number): Promise<string[]>;
}

export interface GeocodingService {
  geocode(address: string): Promise<Coordinates | null>;
  reverseGeocode(coordinates: Coordinates): Promise<string | null>;
  parseAddress(text: string): Promise<ParsedAddress>;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
}
```

### Performance Monitoring
```typescript
// src/infrastructure/monitoring/types.ts
export interface PerformanceMonitor {
  startTimer(operation: string): () => void;
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  recordError(error: Error, context?: Record<string, unknown>): void;
  getReport(timeRange: TimeRange): Promise<PerformanceReport>;
}
```

## 📐 Common Types

```typescript
// src/core/types/common.ts
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export type ID = string;
export type Timestamp = Date;
export type URL = string;
```

## 🔄 Version History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| 1.0.0 | 2025-01-24 | Initial contracts | System |

## ⚠️ Breaking Change Protocol

1. **Propose Change**: Create issue with breaking change proposal
2. **Impact Analysis**: Document all affected modules
3. **Version Bump**: Increment major version
4. **Migration Plan**: Provide upgrade path
5. **Deprecation**: Mark old interface as deprecated
6. **Grace Period**: Maintain both versions for 1 sprint
7. **Removal**: Remove deprecated version

## 🧪 Contract Testing

```typescript
// Example contract test
describe('ApartmentRepository Contract', () => {
  it('should implement all required methods', () => {
    const repo = new PrismaApartmentRepository();
    expect(repo.findById).toBeDefined();
    expect(repo.findMany).toBeDefined();
    // ... etc
  });
});
```

---
*These contracts define the boundaries between modules. Respect them!*