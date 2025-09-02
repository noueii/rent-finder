import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

const prisma = new PrismaClient();

interface ImportData {
  metadata: {
    exportedAt: string;
    version: string;
    counts: Record<string, number>;
  };
  data: {
    users: any[];
    userPreferences: any[];
    stations: any[];
    trainLines: any[];
    stationLines: any[];
    scrapingSources: any[];
    apartments: any[];
    apartmentImages: any[];
    apartmentStations: any[];
    routes: any[];
    lists: any[];
    apartmentLists: any[];
    apartmentScores: any[];
    searchSessions: any[];
    accounts: any[];
    sessions: any[];
    verificationTokens: any[];
  };
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function importData() {
  console.log('🚀 Starting database import...');
  
  try {
    // Check if export file exists
    const exportPath = path.join('.db-sync', 'data-export.json');
    try {
      await fs.access(exportPath);
    } catch {
      console.error('❌ Export file not found at:', exportPath);
      console.log('💡 Run "npm run db:export" first to create an export');
      process.exit(1);
    }
    
    // Read the export file
    console.log('📖 Reading export file...');
    const fileContent = await fs.readFile(exportPath, 'utf-8');
    const importData: ImportData = JSON.parse(fileContent);
    
    // Show metadata
    console.log('\n📊 Export Information:');
    console.log(`   Exported at: ${new Date(importData.metadata.exportedAt).toLocaleString()}`);
    console.log(`   Version: ${importData.metadata.version}`);
    console.log('\n📊 Record counts:');
    Object.entries(importData.metadata.counts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   ${table}: ${count} records`);
      }
    });
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will DELETE all existing data!');
    const confirmed = await askConfirmation('Do you want to continue?');
    
    if (!confirmed) {
      console.log('❌ Import cancelled');
      process.exit(0);
    }
    
    console.log('\n🗑️  Clearing existing data...');
    
    // Clear data in reverse order of dependencies
    await prisma.$transaction([
      // Clear dependent tables first
      prisma.apartmentScore.deleteMany(),
      prisma.apartmentList.deleteMany(),
      prisma.searchSession.deleteMany(),
      prisma.route.deleteMany(),
      prisma.apartmentStation.deleteMany(),
      prisma.apartmentImage.deleteMany(),
      prisma.stationLine.deleteMany(),
      prisma.userPreference.deleteMany(),
      prisma.list.deleteMany(),
      prisma.apartment.deleteMany(),
      prisma.station.deleteMany(),
      prisma.trainLine.deleteMany(),
      prisma.scrapingSource.deleteMany(),
      // NextAuth tables
      prisma.verificationToken.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      // Finally users
      prisma.user.deleteMany(),
    ]);
    
    console.log('✅ Existing data cleared');
    console.log('\n📥 Importing new data...');
    
    // Import in order of dependencies
    const importSteps = [
      { name: 'users', data: importData.data.users, model: prisma.user },
      { name: 'stations', data: importData.data.stations, model: prisma.station },
      { name: 'trainLines', data: importData.data.trainLines, model: prisma.trainLine },
      { name: 'scrapingSources', data: importData.data.scrapingSources, model: prisma.scrapingSource },
    ];
    
    // Import independent entities
    for (const step of importSteps) {
      if (step.data.length > 0) {
        console.log(`   Importing ${step.name}...`);
        await step.model.createMany({ data: step.data });
      }
    }
    
    // Import junction tables
    if (importData.data.stationLines.length > 0) {
      console.log('   Importing stationLines...');
      await prisma.stationLine.createMany({ data: importData.data.stationLines });
    }
    
    if (importData.data.userPreferences.length > 0) {
      console.log('   Importing userPreferences...');
      await prisma.userPreference.createMany({ data: importData.data.userPreferences });
    }
    
    // Import apartments
    if (importData.data.apartments.length > 0) {
      console.log('   Importing apartments...');
      await prisma.apartment.createMany({ data: importData.data.apartments });
    }
    
    // Import apartment relations
    const apartmentRelations = [
      { name: 'apartmentImages', data: importData.data.apartmentImages, model: prisma.apartmentImage },
      { name: 'apartmentStations', data: importData.data.apartmentStations, model: prisma.apartmentStation },
      { name: 'routes', data: importData.data.routes, model: prisma.route },
    ];
    
    for (const relation of apartmentRelations) {
      if (relation.data.length > 0) {
        console.log(`   Importing ${relation.name}...`);
        await relation.model.createMany({ data: relation.data });
      }
    }
    
    // Import lists and related data
    if (importData.data.lists.length > 0) {
      console.log('   Importing lists...');
      await prisma.list.createMany({ data: importData.data.lists });
    }
    
    if (importData.data.apartmentLists.length > 0) {
      console.log('   Importing apartmentLists...');
      await prisma.apartmentList.createMany({ data: importData.data.apartmentLists });
    }
    
    if (importData.data.apartmentScores.length > 0) {
      console.log('   Importing apartmentScores...');
      await prisma.apartmentScore.createMany({ data: importData.data.apartmentScores });
    }
    
    if (importData.data.searchSessions.length > 0) {
      console.log('   Importing searchSessions...');
      await prisma.searchSession.createMany({ data: importData.data.searchSessions });
    }
    
    // Import NextAuth tables (if any)
    if (importData.data.accounts.length > 0) {
      console.log('   Importing accounts...');
      await prisma.account.createMany({ data: importData.data.accounts });
    }
    
    if (importData.data.sessions.length > 0) {
      console.log('   Importing sessions...');
      await prisma.session.createMany({ data: importData.data.sessions });
    }
    
    if (importData.data.verificationTokens.length > 0) {
      console.log('   Importing verificationTokens...');
      await prisma.verificationToken.createMany({ data: importData.data.verificationTokens });
    }
    
    // Verify import
    console.log('\n✅ Import completed successfully!');
    console.log('\n📊 Verification:');
    
    const counts = {
      users: await prisma.user.count(),
      apartments: await prisma.apartment.count(),
      stations: await prisma.station.count(),
      lists: await prisma.list.count(),
      routes: await prisma.route.count(),
    };
    
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} records`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importData();