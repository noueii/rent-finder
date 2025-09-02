import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMocks } from '~/infrastructure/testing/mocks/prisma';
import { UserRepository } from '../implementations/user.repository';
import { TRPCError } from '@trpc/server';

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(() => {
    resetPrismaMocks();
    repository = new UserRepository(prismaMock as any);
  });

  describe('findById', () => {
    it('should find user by id with preferences', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {
          id: 'pref1',
          userId: '1',
          maxCommute: 30
        }
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await repository.findById('1', true);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { preferences: true }
      });
      expect(result).toEqual(mockUser);
    });

    it('should find user by id without preferences', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User'
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await repository.findById('1', false);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: undefined
      });
      expect(result).toEqual({ ...mockUser, preferences: null });
    });
  });

  describe('preferences management', () => {
    it('should create preferences for user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      const mockPreferences = {
        id: 'pref1',
        userId: '1',
        maxCommute: 30,
        preferredStations: ['station1']
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.userPreference.create.mockResolvedValue(mockPreferences as any);

      const result = await repository.createPreferences('1', {
        maxCommute: 30,
        preferredStations: ['station1']
      });

      expect(prismaMock.userPreference.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: '1' } },
          maxCommute: 30,
          preferredStations: ['station1']
        }
      });
      expect(result).toEqual(mockPreferences);
    });

    it('should throw error when creating preferences for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        repository.createPreferences('1', { maxCommute: 30 })
      ).rejects.toThrow(TRPCError);
    });

    it('should update existing preferences', async () => {
      const mockExisting = { id: 'pref1', userId: '1', maxCommute: 30 };
      const mockUpdated = { ...mockExisting, maxCommute: 45 };

      prismaMock.userPreference.findUnique.mockResolvedValue(mockExisting as any);
      prismaMock.userPreference.update.mockResolvedValue(mockUpdated as any);

      const result = await repository.updatePreferences('1', { maxCommute: 45 });

      expect(prismaMock.userPreference.update).toHaveBeenCalledWith({
        where: { userId: '1' },
        data: { maxCommute: 45 }
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should create preferences if they do not exist on update', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      const mockPreferences = { id: 'pref1', userId: '1', maxCommute: 30 };

      prismaMock.userPreference.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.userPreference.create.mockResolvedValue(mockPreferences as any);

      const result = await repository.updatePreferences('1', { maxCommute: 30 });

      expect(prismaMock.userPreference.create).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('auth operations', () => {
    it('should update password', async () => {
      const mockUser = { id: '1', email: 'test@example.com', password: 'new-hash' };
      
      prismaMock.user.update.mockResolvedValue(mockUser as any);

      const result = await repository.updatePassword('1', 'new-hash');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { password: 'new-hash' }
      });
      expect(result).toEqual(mockUser);
    });

    it('should verify email', async () => {
      const mockUser = { 
        id: '1', 
        email: 'test@example.com', 
        emailVerified: new Date() 
      };
      
      prismaMock.user.update.mockResolvedValue(mockUser as any);

      const result = await repository.verifyEmail('1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { emailVerified: expect.any(Date) }
      });
      expect(result).toEqual(mockUser);
    });
  });
});