import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/rentfinder_test';

  console.log('🚀 Setting up integration test environment...');

  try {
    // Run migrations on test database
    console.log('📦 Running database migrations...');
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });

    // Verify database connection
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$disconnect();

    console.log('✅ Integration test environment ready!');
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}