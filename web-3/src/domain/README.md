# Domain Layer

This layer contains the core business logic and domain models of the Tokyo Apartment Finder application. It is designed to be completely independent of any infrastructure or framework concerns.

## Structure

```
domain/
├── entities/          # Domain entities (pure data models)
├── repositories/      # Repository interfaces (data access contracts)
├── services/         # Domain services (business logic) - TODO
└── types/           # Shared domain types
```

## Key Principles

1. **No External Dependencies**: The domain layer has no imports from infrastructure, frameworks, or external libraries
2. **Pure Interfaces**: All repositories are interfaces, not implementations
3. **Business Logic**: Complex business rules belong in domain services
4. **Type Safety**: Strong typing throughout with no `any` types

## Entities

### Apartment
The core entity representing a rental property listing with:
- Basic information (title, URL, description)
- Location data (address, coordinates, nearest station)
- Property details (price, size, layout, age)
- Metadata (availability, scraping info)

### User
Represents an application user with:
- Authentication data (email, verification status)
- Preferences (search defaults, score weights)
- Role-based permissions

### List
User-created collections of apartments with:
- Privacy settings (public/private, share tokens)
- Customization (color, icon, sort order)
- Apartment relationships with notes

### Station
Train/subway stations in the Tokyo transit system with:
- Location coordinates
- Line connections
- Multi-language names

## Repository Interfaces

All repositories extend `BaseRepository<T>` which provides standard CRUD operations:

### BaseRepository<T>
- `findById(id)` - Find by ID
- `findMany(filter, options)` - Find with pagination
- `findOne(filter)` - Find single match
- `create(data)` - Create new entity
- `update(id, data)` - Update existing
- `delete(id)` - Delete entity
- `exists(filter)` - Check existence
- `count(filter)` - Count matches
- `transaction(work)` - Transactional operations

### ApartmentRepository
Extends base with apartment-specific methods:
- `findByUrl(url)` - Find by listing URL
- `findNearStation(stationId, radius)` - Geographic search
- `findByCommuteTime(params)` - Commute-based search
- `markAsRemoved(id)` - Mark unavailable
- `updatePrices(id, prices)` - Update pricing
- `findSimilar(id, criteria, limit)` - Find similar apartments
- `getPriceStats(params)` - Area price statistics

### UserRepository
User-specific data access:
- `findByEmail(email)` - Find by email
- `updatePreferences(id, prefs)` - Update preferences
- `updateScoreWeights(id, weights)` - Update scoring
- `verifyEmail(id, timestamp)` - Email verification
- `getStats(id)` - User activity stats

### ListRepository
List management operations:
- `findByUser(userId, includePrivate)` - User's lists
- `findByShareToken(token)` - Shared list access
- `addApartment(listId, apartmentId)` - Add to list
- `removeApartment(listId, apartmentId)` - Remove from list
- `reorderApartments(listId, order)` - Reorder items
- `duplicate(listId, userId, name)` - Copy list

### StationRepository
Transit station data access:
- `findByName(name)` - Search by name
- `findByLine(line)` - Stations on a line
- `findNearby(center, radius)` - Geographic search
- `findNearest(location)` - Nearest station
- `getTransferStations()` - Multi-line stations

## Usage Example

```typescript
// In infrastructure layer (implements the interface)
class PrismaApartmentRepository implements ApartmentRepository {
  async findById(id: string): Promise<Apartment | null> {
    const data = await this.prisma.apartment.findUnique({
      where: { id }
    });
    return data ? this.toDomain(data) : null;
  }
  
  private toDomain(data: PrismaApartment): Apartment {
    // Map Prisma model to domain entity
  }
}

// In application/service layer
class ApartmentService {
  constructor(
    private apartmentRepo: ApartmentRepository,
    private stationRepo: StationRepository
  ) {}
  
  async searchByCommute(params: CommuteSearchParams) {
    // Use repository interfaces, not implementations
    const apartments = await this.apartmentRepo.findByCommuteTime(params);
    // Business logic here
    return apartments;
  }
}
```

## Design Decisions

1. **Repository Pattern**: Provides a clean abstraction over data access, making it easy to swap implementations
2. **Rich Domain Models**: Entities contain behavior, not just data
3. **Interface Segregation**: Specific repositories extend the base with only the methods they need
4. **No Anemic Models**: Business logic lives in the domain, not scattered across the application

## Next Steps

- [ ] Implement domain services for complex business logic
- [ ] Add value objects for complex types (Money, Address, etc.)
- [ ] Define domain events for important state changes
- [ ] Add aggregate roots for consistency boundaries