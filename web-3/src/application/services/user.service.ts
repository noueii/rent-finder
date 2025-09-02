/**
 * User Service Implementation
 * 
 * Handles user-related business logic including preferences
 */

import type { IUserService } from "./interfaces";
import type { User, UserPreference } from "@prisma/client";
import type { IContainer } from "~/core/di/types";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export class UserService implements IUserService {
  private db: PrismaClient;

  constructor(container: IContainer) {
    this.db = container.resolve({ name: 'PrismaClient' }) as PrismaClient;
  }

  async getPreferences(userId: string): Promise<UserPreference> {
    const preference = await this.db.userPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      // Create default preferences if they don't exist
      return await this.createInitialPreferences(userId);
    }

    return preference;
  }

  async createInitialPreferences(userId: string): Promise<UserPreference> {
    // Check if preferences already exist
    const existingPreferences = await this.db.userPreference.findUnique({
      where: { userId },
    });
    
    if (existingPreferences) {
      return existingPreferences;
    }
    
    // Create default preferences
    return this.db.userPreference.create({
      data: {
        userId,
        maxCommute: 30, // Default 30 minutes
        preferredStations: [],
        priceRange: { min: 50000, max: 150000 }, // Default price range
        sizeRange: { min: 20, max: 50 }, // Default size range in m²
        scoreWeights: {
          commuteTimeWeight: 25,
          priceWeight: 25,
          sizeWeight: 20,
          ageWeight: 10,
          floorWeight: 10,
          walkTimeWeight: 10,
        },
        targetValues: {
          targetPrice: 100000,
          targetSize: 40,
          targetCommute: 30,
          targetAge: 10,
          targetFloor: 3,
          targetWalkTime: 5,
        },
      },
    });
  }

  async getCurrentUser(userId: string): Promise<User & {
    preferences: UserPreference | null;
    _count: {
      lists: number;
      searchSessions: number;
    };
  }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        _count: {
          select: {
            lists: true,
            searchSessions: true,
          },
        },
      },
    });
    
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    
    return user;
  }

  async updatePreferences(
    userId: string,
    data: Partial<UserPreference>
  ): Promise<UserPreference> {
    // Ensure preferences exist
    const existing = await this.db.userPreference.findUnique({
      where: { userId },
    });
    
    if (!existing) {
      // Create with provided data
      return this.db.userPreference.create({
        data: {
          userId,
          maxCommute: data.maxCommute ?? 30,
          preferredStations: data.preferredStations ?? [],
          priceRange: data.priceRange ?? { min: 50000, max: 150000 },
          sizeRange: data.sizeRange ?? { min: 20, max: 50 },
          scoreWeights: data.scoreWeights ?? {
            commuteTimeWeight: 25,
            priceWeight: 25,
            sizeWeight: 20,
            ageWeight: 10,
            floorWeight: 10,
            walkTimeWeight: 10,
          },
          targetValues: data.targetValues ?? {
            targetPrice: 100000,
            targetSize: 40,
            targetCommute: 30,
            targetAge: 10,
            targetFloor: 3,
            targetWalkTime: 5,
          },
        },
      });
    }
    
    // Update existing preferences
    const updated = await this.db.userPreference.update({
      where: { userId },
      data: {
        ...(data.maxCommute !== undefined && { maxCommute: data.maxCommute }),
        ...(data.preferredStations !== undefined && { preferredStations: data.preferredStations }),
        ...(data.priceRange !== undefined && { priceRange: data.priceRange as any }),
        ...(data.sizeRange !== undefined && { sizeRange: data.sizeRange as any }),
        ...(data.scoreWeights !== undefined && { scoreWeights: data.scoreWeights as any }),
        ...(data.targetValues !== undefined && { targetValues: data.targetValues as any }),
      },
    });
    
    // Invalidate all existing scores when preferences change
    if (data.scoreWeights !== undefined || data.targetValues !== undefined) {
      await this.db.apartmentScore.deleteMany({
        where: { userId },
      });
    }
    
    return updated;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; image?: string }
  ): Promise<User> {
    return this.db.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.image !== undefined && { image: data.image }),
      },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    // Delete user and all related data (cascading deletes handle relations)
    await this.db.user.delete({
      where: { id: userId },
    });
  }

  async getScoreWeights(userId: string): Promise<{
    commuteTimeWeight: number;
    priceWeight: number;
    sizeWeight: number;
    ageWeight: number;
    floorWeight: number;
    walkTimeWeight: number;
  }> {
    const preferences = await this.getPreferences(userId);
    
    // Extract score weights from preferences
    const scoreWeights = preferences.scoreWeights as any;
    
    return {
      commuteTimeWeight: scoreWeights?.commuteTimeWeight ?? 25,
      priceWeight: scoreWeights?.priceWeight ?? 25,
      sizeWeight: scoreWeights?.sizeWeight ?? 20,
      ageWeight: scoreWeights?.ageWeight ?? 10,
      floorWeight: scoreWeights?.floorWeight ?? 10,
      walkTimeWeight: scoreWeights?.walkTimeWeight ?? 10,
    };
  }
}