import { PrismaClient, type User, type Apartment, type List, type ApartmentScore } from "@prisma/client";
import { TargetedApartmentScorer, type ApartmentWithFullRelations } from "~/lib/scoring/targeted-apartment-scorer";
import type { Route, NearestStation, Station } from "@prisma/client";

interface ScoreCalculationOptions {
  userId: string;
  apartmentIds: string[];
  listId?: string;
  targetStationId?: string;
  forceRecalculate?: boolean;
}

interface ApartmentWithRelations extends Apartment {
  routes?: Route[];
  nearestStations?: (NearestStation & { station: Station })[];
}

export class ApartmentScoreService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  /**
   * Verify that a user owns a list
   */
  async verifyListOwnership(listId: string, userId: string): Promise<List | null> {
    return await this.prisma.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });
  }
  
  /**
   * Verify that a user can access a list (owns it or it's public)
   */
  async verifyListAccess(listId: string, userId: string): Promise<List | null> {
    return await this.prisma.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId },
          { isPublic: true },
        ],
      },
    });
  }

  /**
   * Calculate and store scores for multiple apartments
   */
  async calculateAndStoreScores(options: ScoreCalculationOptions): Promise<ApartmentScore[]> {
    const { userId, apartmentIds, listId, targetStationId, forceRecalculate = false } = options;

    // Get user preferences
    const userPreference = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!userPreference) {
      throw new Error("User preferences not found. Please set your preferences first.");
    }

    // Check for existing scores if not forcing recalculation
    if (!forceRecalculate) {
      const existingScores = await this.prisma.apartmentScore.findMany({
        where: {
          userId,
          apartmentId: { in: apartmentIds },
          listId: listId || null,
        },
      });

      // If we have all scores and they're recent (less than 24 hours old), return them
      if (existingScores.length === apartmentIds.length) {
        const oldestScore = existingScores.reduce((oldest, score) => 
          score.calculatedAt < oldest.calculatedAt ? score : oldest
        );
        
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (oldestScore.calculatedAt > dayAgo) {
          return existingScores;
        }
      }
    }

    // Fetch apartments with their relations
    const apartments = await this.prisma.apartment.findMany({
      where: { id: { in: apartmentIds } },
      include: {
        routes: targetStationId ? {
          where: { toStationId: targetStationId }
        } : true,
        nearestStations: {
          include: { station: true },
          orderBy: { walkingMinutes: 'asc' },
          take: 3,
        },
      },
    });

    // Create scorer from user preferences
    const scorer = TargetedApartmentScorer.fromUserPreferences(userPreference, {
      targetStationId,
    });

    // Calculate scores
    const scoredApartments = apartments.map(apt => 
      scorer.calculateScore(apt as ApartmentWithFullRelations)
    );

    // Prepare score records for database
    const scoreData = scoredApartments.map(apt => ({
      userId,
      apartmentId: apt.id,
      listId: listId || null,
      score: apt.score || 0,
    }));

    // Use upsert to avoid unique constraint violations
    const scores = await this.prisma.$transaction(async (tx) => {
      // Upsert scores - this will update existing or create new ones atomically
      const upserted = await Promise.all(
        scoreData.map(data =>
          tx.apartmentScore.upsert({
            where: {
              userId_apartmentId_listId: {
                userId: data.userId,
                apartmentId: data.apartmentId,
                listId: data.listId,
              },
            },
            update: {
              score: data.score,
              calculatedAt: new Date(),
            },
            create: data,
          })
        )
      );

      return upserted;
    });

    return scores;
  }

  /**
   * Get scores for apartments (with caching)
   */
  async getScores(
    userId: string,
    apartmentIds: string[],
    listId?: string
  ): Promise<Map<string, ApartmentScore>> {
    const scores = await this.prisma.apartmentScore.findMany({
      where: {
        userId,
        apartmentId: { in: apartmentIds },
        listId: listId || null,
      },
    });

    // Create a map for easy lookup
    const scoreMap = new Map<string, ApartmentScore>();
    scores.forEach(score => {
      scoreMap.set(score.apartmentId, score);
    });

    return scoreMap;
  }

  /**
   * Get top scored apartments for a user
   */
  async getTopScoredApartments(
    userId: string,
    limit: number = 10,
    listId?: string
  ): Promise<(Apartment & { score: ApartmentScore })[]> {
    const scores = await this.prisma.apartmentScore.findMany({
      where: {
        userId,
        listId: listId || null,
      },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        apartment: {
          include: {
            images: {
              orderBy: { order: 'asc' },
            },
            nearestStations: {
              include: { station: true },
              orderBy: { walkingMinutes: 'asc' },
              take: 3,
            },
          },
        },
      },
    });

    return scores.map(score => ({
      ...score.apartment,
      score,
    }));
  }

  /**
   * Invalidate scores when user preferences change
   */
  async invalidateUserScores(userId: string): Promise<void> {
    await this.prisma.apartmentScore.deleteMany({
      where: { userId },
    });
  }

  /**
   * Batch calculate scores for all apartments in a list
   */
  async calculateListScores(userId: string, listId: string): Promise<void> {
    // Get all apartment IDs in the list
    const apartmentLists = await this.prisma.apartmentList.findMany({
      where: { listId },
      select: { apartmentId: true },
    });

    const apartmentIds = apartmentLists.map(al => al.apartmentId);

    // Get list details to check for target station
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
    });

    let targetStationId: string | undefined;
    if (list?.searchParams && typeof list.searchParams === 'object' && 'workplaceStationId' in list.searchParams) {
      targetStationId = (list.searchParams as any).workplaceStationId;
    }

    // Calculate scores in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < apartmentIds.length; i += batchSize) {
      const batch = apartmentIds.slice(i, i + batchSize);
      await this.calculateAndStoreScores({
        userId,
        apartmentIds: batch,
        listId,
        targetStationId,
        forceRecalculate: true,
      });
    }
  }

  /**
   * Get score statistics for a list
   */
  async getListScoreStats(userId: string, listId: string) {
    const stats = await this.prisma.apartmentScore.aggregate({
      where: {
        userId,
        listId,
      },
      _avg: { score: true },
      _min: { score: true },
      _max: { score: true },
      _count: true,
    });

    const distribution = await this.prisma.apartmentScore.groupBy({
      by: ['score'],
      where: {
        userId,
        listId,
      },
      _count: true,
      orderBy: { score: 'desc' },
    });

    return {
      average: stats._avg.score || 0,
      min: stats._min.score || 0,
      max: stats._max.score || 0,
      count: stats._count,
      distribution,
    };
  }
}