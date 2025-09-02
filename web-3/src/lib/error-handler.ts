import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: unknown): TRPCError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        return new TRPCError({
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          cause: error
        });
      
      case 'P2025':
        // Record not found
        return new TRPCError({
          code: 'NOT_FOUND',
          message: 'Record not found',
          cause: error
        });
      
      case 'P2003':
        // Foreign key constraint violation
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid reference to related record',
          cause: error
        });
      
      case 'P2014':
        // Required relation violation
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Required relation is missing',
          cause: error
        });
      
      case 'P2016':
        // Query interpretation error
        return new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          cause: error
        });
      
      default:
        // Other known Prisma errors
        return new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Database error: ${error.code}`,
          cause: error
        });
    }
  }
  
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid data provided',
      cause: error
    });
  }
  
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database connection error',
      cause: error
    });
  }
  
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database initialization error',
      cause: error
    });
  }
  
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unknown database error',
      cause: error
    });
  }

  // If it's already a TRPCError, just return it
  if (error instanceof TRPCError) {
    return error;
  }

  // Generic error
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    cause: error
  });
}

// Utility function to wrap async operations with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw handlePrismaError(error);
  }
}