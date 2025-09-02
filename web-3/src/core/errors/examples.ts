/**
 * Example usage of the error handling system
 * This file demonstrates best practices for using the error handler
 */

import {
  errorHandler,
  handleError,
  BaseError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  withErrorHandler,
  assert,
  withRetry,
  ErrorWithCause
} from './index';

/**
 * Example 1: Basic error handling in an API route
 */
export async function apiRouteExample(req: any, res: any) {
  try {
    // Your business logic here
    const userId = req.params.id;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const user = await getUserById(userId);
    
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    res.json({ user });
  } catch (error) {
    // Handle error and send response
    const errorResponse = handleError(error, {
      userId: req.user?.id,
      requestId: req.id,
      operation: 'getUser',
    });

    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Example 2: Using error handler in a service
 */
export class UserService {
  async updateUserEmail(userId: string, newEmail: string): Promise<void> {
    // Validate input
    if (!this.isValidEmail(newEmail)) {
      throw new ValidationError('Invalid email format', {
        field: 'email',
        value: newEmail,
      });
    }

    // Check if user exists
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Check if email is already taken
    const existingUser = await this.getUserByEmail(newEmail);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError(
        'Email address is already in use',
        'email'
      );
    }

    // Update email
    await this.updateUser(userId, { email: newEmail });
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async getUserById(id: string): Promise<any> {
    // Database query
    return null; // Placeholder
  }

  private async getUserByEmail(email: string): Promise<any> {
    // Database query
    return null; // Placeholder
  }

  private async updateUser(id: string, data: any): Promise<void> {
    // Database update
  }
}

/**
 * Example 3: Using assertions for invariants
 */
export function calculateDiscount(price: number, discountPercent: number): number {
  assert(price >= 0, 'Price must be non-negative');
  assert(
    discountPercent >= 0 && discountPercent <= 100,
    'Discount percent must be between 0 and 100'
  );

  return price * (1 - discountPercent / 100);
}

/**
 * Example 4: Wrapping external API calls with error handling
 */
export const fetchUserFromExternalAPI = withErrorHandler(
  async (userId: string) => {
    const response = await fetch(`https://api.example.com/users/${userId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError('External user', userId);
      }
      throw new BaseError(
        'EXTERNAL_API_ERROR',
        response.status,
        true,
        `External API returned ${response.status}`
      );
    }

    return response.json();
  },
  // Transform any network errors
  (error) => {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new BaseError(
        'NETWORK_ERROR',
        503,
        true,
        'Failed to connect to external API'
      );
    }
    return error as BaseError;
  }
);

/**
 * Example 5: Using retry logic for flaky operations
 */
export async function uploadFileWithRetry(file: File): Promise<string> {
  return withRetry(
    async () => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new BaseError(
          'UPLOAD_FAILED',
          response.status,
          response.status >= 500, // Retry on server errors
          `Upload failed with status ${response.status}`
        );
      }

      const result = await response.json();
      return result.url;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      shouldRetry: (error) => {
        // Retry on server errors or network issues
        if (error instanceof BaseError) {
          return error.isOperational && error.statusCode >= 500;
        }
        return error instanceof TypeError; // Network errors
      },
    }
  );
}

/**
 * Example 6: Error chaining with cause
 */
export async function processUserData(userId: string): Promise<void> {
  try {
    const userData = await fetchUserData(userId);
    await validateUserData(userData);
    await saveUserData(userData);
  } catch (error) {
    // Wrap the error with additional context
    throw new ErrorWithCause(
      `Failed to process user data for user ${userId}`,
      'USER_PROCESSING_ERROR',
      500,
      error,
      false // This is a programming error if it fails
    );
  }
}

/**
 * Example 7: Authorization checks
 */
export function requirePermission(
  user: any,
  resource: string,
  action: string
): void {
  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  const hasPermission = checkUserPermission(user, resource, action);
  
  if (!hasPermission) {
    throw new ForbiddenError(action, resource);
  }
}

// Helper functions (placeholders)
async function getUserById(id: string): Promise<any> {
  return null;
}

async function fetchUserData(userId: string): Promise<any> {
  return {};
}

async function validateUserData(data: any): Promise<void> {
  // Validation logic
}

async function saveUserData(data: any): Promise<void> {
  // Save logic
}

function checkUserPermission(user: any, resource: string, action: string): boolean {
  return false;
}

/**
 * Example 8: Global error handler for Next.js API routes
 */
export function createAPIHandler(handler: any) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      const errorResponse = handleError(error, {
        userId: req.session?.userId,
        metadata: {
          method: req.method,
          url: req.url,
        },
      });

      // Set additional headers for rate limiting
      if (error instanceof BaseError && error.code === 'RATE_LIMIT') {
        const retryAfter = (error as any).retryAfter;
        if (retryAfter) {
          res.setHeader('Retry-After', retryAfter);
        }
      }

      res.status(errorResponse.statusCode).json(errorResponse);
    }
  };
}