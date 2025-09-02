#!/usr/bin/env tsx
/**
 * Run custom queries safely with automatic pagination
 */

import { PrismaClient } from "@prisma/client";
import { parseArgs } from "util";

const prisma = new PrismaClient();

const queries = {
  'recent-apartments': {
    description: 'Show recently added apartments',
    run: async (limit: number) => {
      const results = await prisma.apartment.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          price: true,
          size: true,
          address: true,
          createdAt: true,
        }
      });
      console.table(results);
    }
  },
  'expensive-apartments': {
    description: 'Show most expensive apartments',
    run: async (limit: number) => {
      const results = await prisma.apartment.findMany({
        take: limit,
        orderBy: { price: 'desc' },
        select: {
          title: true,
          price: true,
          size: true,
          address: true,
        }
      });
      console.table(results);
    }
  },
  'user-lists': {
    description: 'Show all user lists with apartment counts',
    run: async (limit: number) => {
      const results = await prisma.list.findMany({
        take: limit,
        include: {
          user: {
            select: { email: true }
          },
          _count: {
            select: { apartments: true }
          }
        }
      });
      console.table(results.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        user: l.user.email,
        apartments: l._count.apartments,
        status: l.status,
      })));
    }
  },
  'apartments-without-routes': {
    description: 'Count apartments missing route calculations',
    run: async () => {
      const total = await prisma.apartment.count();
      const withRoutes = await prisma.apartment.count({
        where: {
          routes: {
            some: {}
          }
        }
      });
      console.log(`Total apartments: ${total}`);
      console.log(`With routes: ${withRoutes}`);
      console.log(`Without routes: ${total - withRoutes} (${((total - withRoutes) / total * 100).toFixed(1)}%)`);
    }
  },
  'apartments-by-layout': {
    description: 'Show apartment distribution by layout',
    run: async () => {
      const results = await prisma.apartment.groupBy({
        by: ['layout'],
        _count: true,
        orderBy: {
          _count: {
            layout: 'desc'
          }
        }
      });
      console.table(results.map(r => ({
        layout: r.layout || 'Unknown',
        count: r._count
      })));
    }
  }
};

async function runQuery() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      query: { type: 'string', short: 'q' },
      limit: { type: 'string', short: 'l', default: '20' },
      list: { type: 'boolean', short: 'L', default: false },
    }
  });

  try {
    if (values.list || !values.query) {
      console.log('Available queries:\n');
      Object.entries(queries).forEach(([key, query]) => {
        console.log(`  ${key}: ${query.description}`);
      });
      console.log('\nUsage: npm run db:query -- -q <query-name> [-l <limit>]');
      return;
    }

    const query = queries[values.query as keyof typeof queries];
    if (!query) {
      console.error(`Unknown query: ${values.query}`);
      console.log('Use --list to see available queries');
      return;
    }

    const limit = parseInt(values.limit || '20');
    console.log(`Running query: ${values.query}\n`);
    await query.run(limit);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runQuery();