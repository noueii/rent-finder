/**
 * Example implementations of concrete repositories
 * 
 * These demonstrate how to extend the base repository for specific entities
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaBaseRepository, SimplePrismaRepository } from './prisma-base-repository';
import type { 
  User as DomainUser,
  Apartment as DomainApartment,
  Station as DomainStation,
  List as DomainList
} from '~/domain/entities';
import type {
  User as PrismaUser,
  Apartment as PrismaApartment,
  Station as PrismaStation,
  List as PrismaList,
  UserPreference as PrismaUserPreference
} from '@prisma/client';
import type { PaginatedResult, QueryOptions } from '~/domain/repositories/base';

/**
 * User Repository - Complex mapping example
 * Maps Prisma User + UserPreference to Domain User
 */
export class UserRepositoryImpl extends PrismaBaseRepository<DomainUser, PrismaUser & { preferences?: PrismaUserPreference | null }> {
  protected readonly modelName = 'user' as Prisma.ModelName;

  protected toDomain(model: PrismaUser & { preferences?: PrismaUserPreference | null }): DomainUser {
    return {
      id: model.id,
      email: model.email,
      name: model.name || undefined,
      image: model.image || undefined,
      role: model.role as any,
      emailVerified: model.emailVerified || undefined,
      preferences: {
        defaultMaxCommute: model.preferences?.maxCommute || undefined,
        defaultStationId: model.preferences?.preferredStations?.[0],
        defaultPriceRange: model.preferences?.priceRange as any,
        scoreWeights: model.preferences?.scoreWeights as any || {
          commuteTime: 0.3,
          price: 0.3,
          size: 0.2,
          buildingAge: 0.1,
          stationDistance: 0.1
        },
        language: 'ja',
        currency: 'JPY',
        distanceUnit: 'km',
        emailNotifications: false,
        savedSearchAlerts: false,
        priceDropAlerts: false
      },
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      lastLogin: undefined,
      isActive: true
    } as DomainUser;
  }

  protected toPrisma(entity: Partial<DomainUser>): any {
    const { id, createdAt, updatedAt, preferences, emailVerified, ...userData } = entity;
    
    return {
      ...userData,
      emailVerified: emailVerified ? new Date(emailVerified) : undefined,
      // Note: preferences would be handled separately through UserPreference model
    };
  }

  /**
   * Override findById to include preferences by default
   */
  async findById(id: string): Promise<DomainUser | null> {
    try {
      const result = await this.model.findUnique({
        where: { id },
        include: { preferences: true }
      });

      return result ? this.toDomain(result) : null;
    } catch (error) {
      throw this.handlePrismaError(error, 'findById');
    }
  }

  /**
   * Custom method to find user by email
   */
  async findByEmail(email: string): Promise<DomainUser | null> {
    try {
      const result = await this.model.findUnique({
        where: { email },
        include: { preferences: true }
      });

      return result ? this.toDomain(result) : null;
    } catch (error) {
      throw this.handlePrismaError(error, 'findByEmail');
    }
  }
}

/**
 * Apartment Repository - JSON field handling example
 */
export class ApartmentRepositoryImpl extends PrismaBaseRepository<DomainApartment, PrismaApartment> {
  protected readonly modelName = 'apartment' as Prisma.ModelName;

  protected toDomain(model: PrismaApartment): DomainApartment {
    // This is just an example - actual mapping would be more complex
    return {
      id: model.id,
      title: model.title,
      url: model.sourceUrl,
      description: model.description || undefined,
      address: model.address || '',
      latitude: model.latitude || undefined,
      longitude: model.longitude || undefined,
      price: model.price,
      managementFee: model.feesTotal || undefined,
      depositMonths: undefined,
      keyMoneyMonths: undefined,
      roomLayout: model.layout || '',
      size: model.size,
      floor: model.floor || undefined,
      totalFloors: model.totalFloors || undefined,
      age: model.buildingAge || undefined,
      features: model.amenities,
      images: [],
      source: model.sourceSite,
      isAvailable: model.availability === 'available',
      lastScraped: model.scrapedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  protected toPrisma(entity: Partial<DomainApartment>): any {
    const { 
      id, 
      createdAt, 
      updatedAt, 
      lastScraped,
      managementFee,
      depositMonths,
      keyMoneyMonths,
      roomLayout,
      age,
      features,
      images,
      source,
      isAvailable,
      ...data 
    } = entity;

    return {
      ...data,
      // Map domain fields to database fields
      sourceUrl: entity.url,
      sourceSite: source,
      layout: roomLayout,
      buildingAge: age,
      amenities: features || [],
      availability: isAvailable ? 'available' : 'occupied',
      scrapedAt: lastScraped,
      feesTotal: managementFee
    };
  }

  /**
   * Find apartments within price range
   */
  async findByPriceRange(min: number, max: number): Promise<DomainApartment[]> {
    const result = await this.findMany({
      where: {
        price: {
          gte: min,
          lte: max
        }
      }
    }, {
      orderBy: { price: 'asc' }
    });

    return result.data;
  }

  /**
   * Find apartments near a station
   */
  async findNearStation(stationId: string, maxWalkingMinutes: number = 15): Promise<DomainApartment[]> {
    // This would require a join with ApartmentStation table
    // For now, returning empty array as example
    return [];
  }
}

/**
 * Station Repository - Simple 1:1 mapping example
 */
export class StationRepositoryImpl extends SimplePrismaRepository<DomainStation> {
  protected readonly modelName = 'station' as Prisma.ModelName;
  constructor(prisma: PrismaClient) {
    super(prisma, 'station' as Prisma.ModelName);
  }

  /**
   * Find stations by name (fuzzy search)
   */
  async searchByName(query: string): Promise<DomainStation[]> {
    const result = await this.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { nameEnglish: { contains: query } }
        ]
      }
    });

    return result.data;
  }
}

/**
 * List Repository - Enum handling example
 */
export class ListRepositoryImpl extends PrismaBaseRepository<DomainList, PrismaList> {
  protected readonly modelName = 'list' as Prisma.ModelName;

  protected toDomain(model: PrismaList): DomainList {
    return {
      id: model.id,
      userId: model.userId,
      name: model.name,
      isPublic: model.isPublic,
      description: model.description || undefined,
      apartmentCount: 0, // Would need to be fetched separately
      viewCount: 0, // Would need to be fetched separately
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  protected toPrisma(entity: Partial<DomainList>): any {
    const { id, createdAt, updatedAt, ...data } = entity;
    return data;
  }

  /**
   * Find all lists for a user
   */
  async findByUser(userId: string): Promise<DomainList[]> {
    const result = await this.findMany({
      where: { userId }
    }, {
      orderBy: { updatedAt: 'desc' }
    });

    return result.data;
  }

  /**
   * Find public lists
   */
  async findPublic(options?: QueryOptions): Promise<PaginatedResult<DomainList>> {
    return this.findMany(
      { where: { isPublic: true } },
      options
    );
  }
}

/**
 * Factory function to create repositories
 */
export function createRepositories(prisma: PrismaClient) {
  return {
    user: new UserRepositoryImpl(prisma),
    apartment: new ApartmentRepositoryImpl(prisma),
    station: new StationRepositoryImpl(prisma),
    list: new ListRepositoryImpl(prisma),
  };
}

// Export for dependency injection
export type Repositories = ReturnType<typeof createRepositories>;