// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdminRole(email) {
  if (!email) {
    console.error('Please provide an email address as argument');
    console.log('Usage: node set-admin.js user@example.com');
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
    
    console.log(`✅ Successfully set admin role for user: ${user.email}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Role: ${user.role}`);
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`❌ User with email "${email}" not found`);
    } else {
      console.error('❌ Error updating user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];
setAdminRole(email);