/**
 * Prisma test mocks
 */
import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Jest module mock for @prisma/client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => prismaMock),
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      meta?: Record<string, unknown>;
      clientVersion: string;
      
      constructor(message: string, { code, clientVersion, meta }: any) {
        super(message);
        this.name = 'PrismaClientKnownRequestError';
        this.code = code;
        this.clientVersion = clientVersion;
        this.meta = meta;
      }
    },
    PrismaClientUnknownRequestError: class PrismaClientUnknownRequestError extends Error {
      clientVersion: string;
      
      constructor(message: string, clientVersion: string) {
        super(message);
        this.name = 'PrismaClientUnknownRequestError';
        this.clientVersion = clientVersion;
      }
    },
    PrismaClientRustPanicError: class PrismaClientRustPanicError extends Error {
      clientVersion: string;
      
      constructor(message: string, clientVersion: string) {
        super(message);
        this.name = 'PrismaClientRustPanicError';
        this.clientVersion = clientVersion;
      }
    },
    PrismaClientInitializationError: class PrismaClientInitializationError extends Error {
      clientVersion: string;
      errorCode?: string;
      
      constructor(message: string, clientVersion: string, errorCode?: string) {
        super(message);
        this.name = 'PrismaClientInitializationError';
        this.clientVersion = clientVersion;
        this.errorCode = errorCode;
      }
    },
    PrismaClientValidationError: class PrismaClientValidationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'PrismaClientValidationError';
      }
    }
  }
}));

// Helper to reset all mocks
export const resetPrismaMocks = () => {
  mockReset(prismaMock);
};

// Export types
export type MockPrismaClient = typeof prismaMock;