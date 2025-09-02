import { db } from '~/server/db';
import type { Apartment } from '@prisma/client';

export interface RemovalCheckResult {
  isRemoved: boolean;
  reason?: string;
  confidence: 'high' | 'medium' | 'low';
}

export class ApartmentRemovalHandler {
  /**
   * Mark apartments as removed in the database
   * @param apartmentIds Array of apartment IDs to mark as removed
   * @param reason Optional reason for removal
   * @returns Number of apartments updated
   */
  static async markApartmentsAsRemoved(
    apartmentIds: string[],
    reason?: string
  ): Promise<number> {
    if (apartmentIds.length === 0) return 0;

    try {
      const result = await db.apartment.updateMany({
        where: {
          id: { in: apartmentIds },
          removed: false, // Only update apartments not already marked as removed
        },
        data: {
          removed: true,
          availability: 'unavailable',
          updatedAt: new Date(),
        },
      });

      console.log(`Marked ${result.count} apartments as removed. Reason: ${reason || 'Not specified'}`);
      return result.count;
    } catch (error) {
      console.error('Error marking apartments as removed:', error);
      throw error;
    }
  }

  /**
   * Mark a single apartment as removed by external ID and source
   * @param externalId External ID of the apartment
   * @param sourceSite Source website
   * @param reason Optional reason for removal
   * @returns True if apartment was updated
   */
  static async markApartmentAsRemovedByExternalId(
    externalId: string,
    sourceSite: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const apartment = await db.apartment.findFirst({
        where: {
          externalId,
          sourceSite,
          removed: false,
        },
      });

      if (!apartment) {
        console.log(`Apartment not found or already removed: ${externalId} from ${sourceSite}`);
        return false;
      }

      await db.apartment.update({
        where: { id: apartment.id },
        data: {
          removed: true,
          availability: 'unavailable',
          updatedAt: new Date(),
        },
      });

      console.log(`Marked apartment ${externalId} from ${sourceSite} as removed. Reason: ${reason || 'Not specified'}`);
      return true;
    } catch (error) {
      console.error(`Error marking apartment ${externalId} as removed:`, error);
      throw error;
    }
  }

  /**
   * Check and update apartment availability based on scraping results
   * @param externalId External ID of the apartment
   * @param sourceSite Source website
   * @param removalCheck Result from checkIfListingRemoved
   * @returns True if apartment was marked as removed
   */
  static async handleRemovalCheck(
    externalId: string,
    sourceSite: string,
    removalCheck: RemovalCheckResult
  ): Promise<boolean> {
    if (!removalCheck.isRemoved) {
      return false;
    }

    // Only mark as removed if confidence is high or medium
    if (removalCheck.confidence === 'low') {
      console.warn(
        `Low confidence removal detection for ${externalId} from ${sourceSite}: ${removalCheck.reason}`
      );
      return false;
    }

    return await this.markApartmentAsRemovedByExternalId(
      externalId,
      sourceSite,
      removalCheck.reason
    );
  }

  /**
   * Restore apartments that were marked as removed
   * Useful when apartments become available again
   * @param apartmentIds Array of apartment IDs to restore
   * @returns Number of apartments restored
   */
  static async restoreApartments(apartmentIds: string[]): Promise<number> {
    if (apartmentIds.length === 0) return 0;

    try {
      const result = await db.apartment.updateMany({
        where: {
          id: { in: apartmentIds },
          removed: true,
        },
        data: {
          removed: false,
          availability: 'available',
          updatedAt: new Date(),
        },
      });

      console.log(`Restored ${result.count} apartments`);
      return result.count;
    } catch (error) {
      console.error('Error restoring apartments:', error);
      throw error;
    }
  }

  /**
   * Get statistics about removed apartments
   * @returns Statistics object
   */
  static async getRemovedApartmentsStats(): Promise<{
    totalRemoved: number;
    removedBySource: Record<string, number>;
    recentlyRemoved: number;
  }> {
    const [totalRemoved, removedBySource, recentlyRemoved] = await Promise.all([
      // Total removed
      db.apartment.count({
        where: { removed: true },
      }),
      
      // Removed by source
      db.apartment.groupBy({
        by: ['sourceSite'],
        where: { removed: true },
        _count: true,
      }),
      
      // Recently removed (last 7 days)
      db.apartment.count({
        where: {
          removed: true,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const bySource = removedBySource.reduce((acc, item) => {
      acc[item.sourceSite] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRemoved,
      removedBySource: bySource,
      recentlyRemoved,
    };
  }
}