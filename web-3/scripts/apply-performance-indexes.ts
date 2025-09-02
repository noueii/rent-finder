#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function applyIndexes() {
  console.log('Applying performance indexes...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      process.cwd(),
      'prisma/migrations/20250718_add_performance_indexes/migration.sql'
    );
    
    const sql = await fs.readFile(migrationPath, 'utf-8');
    
    // Split into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} index statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✓ Statement ${i + 1} completed`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists')) {
          console.log(`✓ Statement ${i + 1} - index already exists`);
        } else {
          console.error(`✗ Statement ${i + 1} failed:`, error.message);
        }
      }
    }
    
    console.log('\nAnalyzing tables to update statistics...');
    await prisma.$executeRaw`ANALYZE`;
    
    console.log('\n✅ Performance indexes applied successfully!');
    
    // Show current indexes
    console.log('\nCurrent indexes on Apartment table:');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'Apartment'
      ORDER BY indexname;
    `;
    
    console.table(indexes);
    
  } catch (error) {
    console.error('Error applying indexes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyIndexes();