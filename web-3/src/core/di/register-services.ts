/**
 * Service Registration
 * 
 * Register all services with the DI container
 */

import type { IContainer } from './types';
import { 
  PrismaClientToken,
  ApartmentServiceToken,
  UserServiceToken,
  SearchServiceToken,
  ListServiceToken
} from './tokens';
import {
  ApartmentService,
  UserService,
  SearchService,
  ListService
} from '~/application/services';

/**
 * Register all application services
 */
export function registerServices(container: IContainer, prismaClient: any): void {
  // Register PrismaClient as a singleton
  container.registerSingleton(PrismaClientToken, () => prismaClient);

  // Register services as singletons
  container.registerSingleton(ApartmentServiceToken, (c) => new ApartmentService(c));
  container.registerSingleton(UserServiceToken, (c) => new UserService(c));
  container.registerSingleton(SearchServiceToken, (c) => new SearchService(c));
  container.registerSingleton(ListServiceToken, (c) => new ListService(c));
}