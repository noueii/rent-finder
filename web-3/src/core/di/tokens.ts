/**
 * Dependency Injection Tokens
 * 
 * Define all injection tokens used in the application
 */

import { createToken } from './types';
import type { PrismaClient } from '@prisma/client';
import type { 
  IApartmentService, 
  IUserService, 
  ISearchService, 
  IListService 
} from '~/application/services/interfaces';

// Database
export const PrismaClientToken = createToken<PrismaClient>('PrismaClient');

// Services
export const ApartmentServiceToken = createToken<IApartmentService>('ApartmentService');
export const UserServiceToken = createToken<IUserService>('UserService');
export const SearchServiceToken = createToken<ISearchService>('SearchService');
export const ListServiceToken = createToken<IListService>('ListService');