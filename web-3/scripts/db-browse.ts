#!/usr/bin/env tsx
/**
 * Lightweight database browser with pagination
 * Usage: npm run db:browse [table] [page] [limit]
 */

import { PrismaClient } from "@prisma/client";
import { parseArgs } from "util";

const prisma = new PrismaClient();

async function browse() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      table: { type: 'string', short: 't', default: 'apartment' },
      page: { type: 'string', short: 'p', default: '1' },
      limit: { type: 'string', short: 'l', default: '10' },
      count: { type: 'boolean', short: 'c', default: false },
    }
  });

  const table = values.table || 'apartment';
  const page = parseInt(values.page || '1');
  const limit = parseInt(values.limit || '10');
  const skip = (page - 1) * limit;

  try {
    switch (table.toLowerCase()) {
      case 'apartment':
        if (values.count) {
          const count = await prisma.apartment.count();
          console.log(`Total apartments: ${count}`);
          return;
        }
        
        const apartments = await prisma.apartment.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            price: true,
            size: true,
            address: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' }
        });
        
        console.table(apartments);
        break;
        
      case 'list':
        if (values.count) {
          const count = await prisma.list.count();
          console.log(`Total lists: ${count}`);
          return;
        }
        
        const lists = await prisma.list.findMany({
          skip,
          take: limit,
          include: {
            _count: {
              select: { apartments: true }
            }
          },
          orderBy: { updatedAt: 'desc' }
        });
        
        console.table(lists.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          apartments: l._count.apartments,
          status: l.status,
          updatedAt: l.updatedAt
        })));
        break;
        
      case 'user':
        if (values.count) {
          const count = await prisma.user.count();
          console.log(`Total users: ${count}`);
          return;
        }
        
        const users = await prisma.user.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            _count: {
              select: { lists: true }
            }
          }
        });
        
        console.table(users.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          lists: u._count.lists,
          createdAt: u.createdAt
        })));
        break;
        
      default:
        console.error(`Unknown table: ${table}`);
        console.log('Available tables: apartment, list, user');
    }
    
    console.log(`\nPage ${page} (showing ${limit} items, skip ${skip})`);
    console.log(`Next page: npm run db:browse -- -t ${table} -p ${page + 1} -l ${limit}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

browse();