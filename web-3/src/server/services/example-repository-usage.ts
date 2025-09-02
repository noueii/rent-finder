import { PrismaClient } from '@prisma/client';
import { Session } from 'next-auth';
import { RepositoryFactory } from '../repositories';

/**
 * Example showing how to use the repositories in services
 * This demonstrates the pattern for migrating from direct Prisma usage to repository pattern
 */
export class ExampleService {
  private repositories;

  constructor(
    private db: PrismaClient,
    private session: Session
  ) {
    // Create all repositories at once
    this.repositories = RepositoryFactory.createRepositories(db);
  }

  /**
   * Example: Get user's lists using repository
   */
  async getUserLists() {
    // Instead of: this.db.list.findMany({ where: { userId: this.session.user.id } })
    return await this.repositories.list.findByUserId(this.session.user.id);
  }

  /**
   * Example: Create a new list using repository
   */
  async createList(name: string) {
    // Instead of: this.db.list.create({ data: { name, userId: this.session.user.id, type: 'BOOKMARKED' } })
    return await this.repositories.list.create(this.session.user.id, {
      name,
      type: 'BOOKMARKED'
    });
  }

  /**
   * Example: Search apartments using repository
   */
  async searchApartments(minPrice: number, maxPrice: number) {
    // Instead of complex Prisma query with includes
    return await this.repositories.apartment.search(
      {
        priceMin: minPrice,
        priceMax: maxPrice
      },
      {
        page: 1,
        limit: 20
      }
    );
  }

  /**
   * Example: Update user preferences using repository
   */
  async updateUserPreferences(maxCommute: number) {
    // Instead of: this.db.userPreference.upsert({ where: { userId }, create: {...}, update: {...} })
    return await this.repositories.user.updatePreferences(
      this.session.user.id,
      { maxCommute }
    );
  }

  /**
   * Example: Add apartment to list using repository with validation
   */
  async addApartmentToList(listId: string, apartmentId: string) {
    // Verify apartment exists
    const apartment = await this.repositories.apartment.findById(apartmentId, false);
    if (!apartment) {
      throw new Error('Apartment not found');
    }

    // Add to list
    return await this.repositories.list.addApartment(listId, apartmentId);
  }

  /**
   * Example: Get stations by search using repository
   */
  async searchStations(query: string) {
    // Instead of complex search with scoring logic
    return await this.repositories.station.search(query, 10);
  }

  /**
   * Example: Transaction using repository
   */
  async createListWithApartments(name: string, apartmentIds: string[]) {
    // Using transaction support from base repository
    return await this.repositories.list.transaction(async (tx) => {
      // Create list
      const list = await tx.list.create({
        data: {
          name,
          userId: this.session.user.id,
          type: 'BOOKMARKED'
        }
      });

      // Add apartments
      if (apartmentIds.length > 0) {
        await tx.apartmentList.createMany({
          data: apartmentIds.map(apartmentId => ({
            listId: list.id,
            apartmentId
          }))
        });
      }

      return list;
    });
  }
}