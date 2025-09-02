/**
 * Test database setup and utilities
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { vi } from './';

/**
 * Create a test database URL
 */
export function createTestDatabaseUrl(name?: string): string {
  const dbName = name || `test_${randomBytes(8).toString('hex')}`;
  const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost/postgres';
  
  // Parse the base URL and replace the database name
  const url = new URL(baseUrl);
  url.pathname = `/${dbName}`;
  
  return url.toString();
}

/**
 * Test database client
 */
export class TestDatabase {
  private prisma: PrismaClient;
  private databaseUrl: string;
  private databaseName: string;

  constructor(name?: string) {
    this.databaseName = name || `test_${randomBytes(8).toString('hex')}`;
    this.databaseUrl = createTestDatabaseUrl(this.databaseName);
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.databaseUrl,
        },
      },
    });
  }

  /**
   * Get the Prisma client
   */
  get client(): PrismaClient {
    return this.prisma;
  }

  /**
   * Setup the test database
   */
  async setup(): Promise<void> {
    // Create the database
    await this.createDatabase();
    
    // Run migrations
    await this.migrate();
    
    // Connect to the database
    await this.prisma.$connect();
  }

  /**
   * Teardown the test database
   */
  async teardown(): Promise<void> {
    // Disconnect from the database
    await this.prisma.$disconnect();
    
    // Drop the database
    await this.dropDatabase();
  }

  /**
   * Clear all data from the database
   */
  async clear(): Promise<void> {
    // Get all table names
    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma_%'
    `;

    // Truncate all tables
    for (const { tablename } of tables) {
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${tablename}" CASCADE`
      );
    }
  }

  /**
   * Create the test database
   */
  private async createDatabase(): Promise<void> {
    const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost/postgres';
    const adminClient = new PrismaClient({
      datasources: {
        db: { url: baseUrl },
      },
    });

    try {
      await adminClient.$connect();
      await adminClient.$executeRawUnsafe(
        `CREATE DATABASE "${this.databaseName}"`
      );
    } catch (error) {
      // Database might already exist
      if (!(error instanceof Error) || !error.message.includes('already exists')) {
        throw error;
      }
    } finally {
      await adminClient.$disconnect();
    }
  }

  /**
   * Drop the test database
   */
  private async dropDatabase(): Promise<void> {
    const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost/postgres';
    const adminClient = new PrismaClient({
      datasources: {
        db: { url: baseUrl },
      },
    });

    try {
      await adminClient.$connect();
      await adminClient.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${this.databaseName}"`
      );
    } finally {
      await adminClient.$disconnect();
    }
  }

  /**
   * Run migrations on the test database
   */
  private async migrate(): Promise<void> {
    const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
    
    execSync(
      `DATABASE_URL="${this.databaseUrl}" npx prisma migrate deploy --schema="${schemaPath}"`,
      {
        env: {
          ...process.env,
          DATABASE_URL: this.databaseUrl,
        },
      }
    );
  }

  /**
   * Seed the database with test data
   */
  async seed(seeder: (prisma: PrismaClient) => Promise<void>): Promise<void> {
    await seeder(this.prisma);
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}

/**
 * Create a test database instance for each test
 */
export function setupTestDatabase(): {
  db: TestDatabase;
  beforeAll: () => Promise<void>;
  afterAll: () => Promise<void>;
  beforeEach: () => Promise<void>;
} {
  const db = new TestDatabase();

  return {
    db,
    beforeAll: async () => {
      await db.setup();
    },
    afterAll: async () => {
      await db.teardown();
    },
    beforeEach: async () => {
      await db.clear();
    },
  };
}

/**
 * Mock Prisma client for unit tests
 */
export function createMockPrismaClient(): PrismaClient {
  const mockClient = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((fn) => fn(mockClient)),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    
    // Add mock models as needed
    user: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    apartment: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    station: {
      create: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as PrismaClient;

  return mockClient;
}

/**
 * Database test utilities
 */
export const dbTestUtils = {
  /**
   * Wait for a database operation
   */
  async waitForDb<T>(
    operation: () => Promise<T>,
    options: { retries?: number; delay?: number } = {}
  ): Promise<T> {
    const { retries = 3, delay = 100 } = options;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Database operation failed');
  },

  /**
   * Assert database state
   */
  async assertDatabaseState(
    prisma: PrismaClient,
    assertions: Array<{
      model: keyof PrismaClient;
      where?: Record<string, any>;
      count?: number;
      exists?: boolean;
    }>
  ): Promise<void> {
    for (const assertion of assertions) {
      const model = prisma[assertion.model] as any;
      
      if (assertion.count !== undefined) {
        const count = await model.count({ where: assertion.where });
        expect(count).toBe(assertion.count);
      }
      
      if (assertion.exists !== undefined) {
        const record = await model.findFirst({ where: assertion.where });
        expect(!!record).toBe(assertion.exists);
      }
    }
  },

  /**
   * Create a database snapshot
   */
  async createSnapshot(
    prisma: PrismaClient,
    models: Array<keyof PrismaClient>
  ): Promise<Record<string, any[]>> {
    const snapshot: Record<string, any[]> = {};
    
    for (const modelName of models) {
      const model = prisma[modelName] as any;
      snapshot[modelName as string] = await model.findMany();
    }
    
    return snapshot;
  },

  /**
   * Compare database snapshots
   */
  compareSnapshots(
    before: Record<string, any[]>,
    after: Record<string, any[]>
  ): {
    added: Record<string, any[]>;
    removed: Record<string, any[]>;
    unchanged: Record<string, any[]>;
  } {
    const added: Record<string, any[]> = {};
    const removed: Record<string, any[]> = {};
    const unchanged: Record<string, any[]> = {};
    
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of allKeys) {
      const beforeItems = before[key] || [];
      const afterItems = after[key] || [];
      
      const beforeIds = new Set(beforeItems.map(item => item.id));
      const afterIds = new Set(afterItems.map(item => item.id));
      
      added[key] = afterItems.filter(item => !beforeIds.has(item.id));
      removed[key] = beforeItems.filter(item => !afterIds.has(item.id));
      unchanged[key] = afterItems.filter(item => beforeIds.has(item.id));
    }
    
    return { added, removed, unchanged };
  },
};