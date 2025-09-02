import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

interface ExportData {
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
    // NextAuth models (minimal, no sensitive data)
    accounts: any[];
    sessions: any[];
    verificationTokens: any[];
  };
}

async function exportData() {
  console.log('🚀 Starting database export...');
  
  try {
    // Ensure .db-sync directory exists
    await fs.mkdir('.db-sync', { recursive: true });
    
    // Export all data with proper relations
    console.log('📊 Fetching data from database...');
    
    const [
      users,
      userPreferences,
      stations,
      trainLines,
      stationLines,
      scrapingSources,
      apartments,
      apartmentImages,
      apartmentStations,
      routes,
      lists,
      apartmentLists,
      apartmentScores,
      searchSessions,
      accounts,
      sessions,
      verificationTokens
    ] = await Promise.all([
      // Users without sensitive data
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          // Exclude password field
        }
      }),
      prisma.userPreference.findMany(),
      prisma.station.findMany(),
      prisma.trainLine.findMany(),
      prisma.stationLine.findMany(),
      prisma.scrapingSource.findMany(),
      // Apartments without including relations to avoid circular refs
      prisma.apartment.findMany(),
      prisma.apartmentImage.findMany(),
      prisma.apartmentStation.findMany(),
      prisma.route.findMany(),
      prisma.list.findMany(),
      prisma.apartmentList.findMany(),
      prisma.apartmentScore.findMany(),
      prisma.searchSession.findMany(),
      // NextAuth models (exclude sensitive tokens)
      prisma.account.findMany({
        select: {
          id: true,
          userId: true,
          type: true,
          provider: true,
          providerAccountId: true,
          // Exclude tokens
        }
      }),
      prisma.session.findMany({
        select: {
          id: true,
          userId: true,
          expires: true,
          // Exclude sessionToken
        }
      }),
      prisma.verificationToken.findMany({
        select: {
          identifier: true,
          expires: true,
          // Exclude token
        }
      })
    ]);
    
    // Create export object
    const exportData: ExportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        counts: {
          users: users.length,
          userPreferences: userPreferences.length,
          stations: stations.length,
          trainLines: trainLines.length,
          stationLines: stationLines.length,
          scrapingSources: scrapingSources.length,
          apartments: apartments.length,
          apartmentImages: apartmentImages.length,
          apartmentStations: apartmentStations.length,
          routes: routes.length,
          lists: lists.length,
          apartmentLists: apartmentLists.length,
          apartmentScores: apartmentScores.length,
          searchSessions: searchSessions.length,
          accounts: accounts.length,
          sessions: sessions.length,
          verificationTokens: verificationTokens.length,
        }
      },
      data: {
        users,
        userPreferences,
        stations,
        trainLines,
        stationLines,
        scrapingSources,
        apartments,
        apartmentImages,
        apartmentStations,
        routes,
        lists,
        apartmentLists,
        apartmentScores,
        searchSessions,
        accounts,
        sessions,
        verificationTokens,
      }
    };
    
    // Write to file
    const exportPath = path.join('.db-sync', 'data-export.json');
    console.log('💾 Writing to file...');
    await fs.writeFile(
      exportPath,
      JSON.stringify(exportData, null, 2),
      'utf-8'
    );
    
    // Write metadata separately for quick checks
    const metadataPath = path.join('.db-sync', 'export-metadata.json');
    await fs.writeFile(
      metadataPath,
      JSON.stringify(exportData.metadata, null, 2),
      'utf-8'
    );
    
    // Calculate file size
    const stats = await fs.stat(exportPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('✅ Export completed successfully!');
    console.log(`📁 File: ${exportPath} (${fileSizeMB} MB)`);
    console.log('\n📊 Export Summary:');
    Object.entries(exportData.metadata.counts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   ${table}: ${count} records`);
      }
    });
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the export
exportData();