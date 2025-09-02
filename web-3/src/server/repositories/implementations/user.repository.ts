import { Prisma, PrismaClient, User, UserPreference } from '@prisma/client';
import { PrismaBaseRepository } from '../base.repository';
import type { IUserRepository } from '../interfaces/user.repository.interface';
import type { UserWithPreferences, UpdateUserPreferencesInput, UpdateUserProfileInput } from '~/types/user';
import { TRPCError } from '@trpc/server';

export class UserRepository
  extends PrismaBaseRepository<
    User,
    Prisma.UserCreateInput,
    Prisma.UserUpdateInput,
    Prisma.UserWhereInput,
    Prisma.UserOrderByWithRelationInput
  >
  implements IUserRepository {
  
  constructor(prisma: PrismaClient) {
    super(prisma, 'user');
  }

  async findById(id: string, includePreferences = false): Promise<UserWithPreferences | null> {
    const user = await this.model.findUnique({
      where: { id },
      include: includePreferences ? { preferences: true } : undefined
    });

    if (!user) return null;

    // If not including preferences, ensure the type matches
    if (!includePreferences) {
      return { ...user, preferences: null };
    }

    return user as UserWithPreferences;
  }

  async findByEmail(email: string, includePreferences = false): Promise<UserWithPreferences | null> {
    const user = await this.model.findUnique({
      where: { email },
      include: includePreferences ? { preferences: true } : undefined
    });

    if (!user) return null;

    // If not including preferences, ensure the type matches
    if (!includePreferences) {
      return { ...user, preferences: null };
    }

    return user as UserWithPreferences;
  }

  async update(id: string, data: UpdateUserProfileInput): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.image !== undefined) updateData.image = data.image;

    return await super.update(id, updateData);
  }

  async getPreferences(userId: string): Promise<UserPreference | null> {
    return await this.prisma.userPreference.findUnique({
      where: { userId }
    });
  }

  async createPreferences(userId: string, data: UpdateUserPreferencesInput): Promise<UserPreference> {
    // Verify user exists
    const user = await this.findById(userId);
    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found'
      });
    }

    const createData: Prisma.UserPreferenceCreateInput = {
      user: { connect: { id: userId } }
    };

    if (data.maxCommute !== undefined) createData.maxCommute = data.maxCommute;
    if (data.preferredStations !== undefined) createData.preferredStations = data.preferredStations;
    if (data.priceRange !== undefined) createData.priceRange = data.priceRange;
    if (data.sizeRange !== undefined) createData.sizeRange = data.sizeRange;
    if (data.savedFilters !== undefined) createData.savedFilters = data.savedFilters;

    return await this.prisma.userPreference.create({
      data: createData
    });
  }

  async updatePreferences(userId: string, data: UpdateUserPreferencesInput): Promise<UserPreference> {
    // Check if preferences exist
    const existing = await this.getPreferences(userId);
    
    if (!existing) {
      // Create if doesn't exist
      return await this.createPreferences(userId, data);
    }

    const updateData: Prisma.UserPreferenceUpdateInput = {};

    if (data.maxCommute !== undefined) updateData.maxCommute = data.maxCommute;
    if (data.preferredStations !== undefined) updateData.preferredStations = data.preferredStations;
    if (data.priceRange !== undefined) updateData.priceRange = data.priceRange;
    if (data.sizeRange !== undefined) updateData.sizeRange = data.sizeRange;
    if (data.savedFilters !== undefined) updateData.savedFilters = data.savedFilters;

    return await this.prisma.userPreference.update({
      where: { userId },
      data: updateData
    });
  }

  async deletePreferences(userId: string): Promise<UserPreference> {
    return await this.prisma.userPreference.delete({
      where: { userId }
    });
  }

  async updateLastLogin(id: string): Promise<User> {
    return await this.update(id, {
      updatedAt: new Date() // This will automatically update
    });
  }

  async verifyEmail(id: string): Promise<User> {
    return await super.update(id, {
      emailVerified: new Date()
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    return await super.update(id, {
      password: hashedPassword
    });
  }

  async findMany(args?: {
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<User[]> {
    return await super.findMany(args);
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return await super.count(where);
  }
}