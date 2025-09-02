import { PrismaClient } from '@prisma/client';
import {
  ApartmentRepository,
  UserRepository,
  ListRepository,
  StationRepository
} from './implementations';
import type {
  IApartmentRepository,
  IUserRepository,
  IListRepository,
  IStationRepository
} from './interfaces';

export class RepositoryFactory {
  private static apartmentRepository: IApartmentRepository | null = null;
  private static userRepository: IUserRepository | null = null;
  private static listRepository: IListRepository | null = null;
  private static stationRepository: IStationRepository | null = null;

  static createApartmentRepository(prisma: PrismaClient): IApartmentRepository {
    if (!this.apartmentRepository) {
      this.apartmentRepository = new ApartmentRepository(prisma);
    }
    return this.apartmentRepository;
  }

  static createUserRepository(prisma: PrismaClient): IUserRepository {
    if (!this.userRepository) {
      this.userRepository = new UserRepository(prisma);
    }
    return this.userRepository;
  }

  static createListRepository(prisma: PrismaClient): IListRepository {
    if (!this.listRepository) {
      this.listRepository = new ListRepository(prisma);
    }
    return this.listRepository;
  }

  static createStationRepository(prisma: PrismaClient): IStationRepository {
    if (!this.stationRepository) {
      this.stationRepository = new StationRepository(prisma);
    }
    return this.stationRepository;
  }

  // Create all repositories at once
  static createRepositories(prisma: PrismaClient) {
    return {
      apartment: this.createApartmentRepository(prisma),
      user: this.createUserRepository(prisma),
      list: this.createListRepository(prisma),
      station: this.createStationRepository(prisma)
    };
  }

  // Reset all repositories (useful for testing)
  static reset() {
    this.apartmentRepository = null;
    this.userRepository = null;
    this.listRepository = null;
    this.stationRepository = null;
  }
}