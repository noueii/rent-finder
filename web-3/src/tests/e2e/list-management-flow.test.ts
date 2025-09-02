import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  createTestPrismaClient,
  clearDatabase,
  createTestTRPCClient,
  factories,
} from '~/infrastructure/testing/integration';
import type { PrismaClient } from '@prisma/client';

// Setup test environment
setupTestEnvironment();

describe('E2E: List Management Flow', () => {
  let prisma: PrismaClient;
  let trpc: ReturnType<typeof createTestTRPCClient>;
  let testUser: any;
  let testUser2: any;
  let testApartments: any[];
  let testStations: any[];

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    trpc = createTestTRPCClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    
    // Create test users
    testUser = await prisma.user.create({
      data: {
        ...factories.user(),
        email: 'user1@example.com',
        emailVerified: new Date(),
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        ...factories.user(),
        email: 'user2@example.com',
        emailVerified: new Date(),
      },
    });

    // Create test stations
    testStations = await Promise.all([
      prisma.station.create({
        data: {
          name: 'Shibuya Station',
          nameJa: '渋谷駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      }),
      prisma.station.create({
        data: {
          name: 'Shinjuku Station',
          nameJa: '新宿駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      }),
    ]);

    // Create test apartments
    testApartments = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.apartment.create({
          data: {
            title: `Test Apartment ${i + 1}`,
            rent: 80000 + i * 10000,
            size: 25 + i * 5,
            rooms: i < 2 ? '1K' : '1LDK',
            age: 5 - i,
            floor: i + 2,
            address: `${i % 2 === 0 ? 'Shibuya' : 'Shinjuku'}-ku, Tokyo`,
            nearbyStations: {
              create: [{
                station: { connect: { id: testStations[i % 2].id } },
                walkingTime: 5 + i * 2,
                distance: 400 + i * 100,
              }],
            },
          },
        })
      )
    );
  });

  describe('Complete List Management Journey', () => {
    it('should complete full list creation → add items → share → manage flow', async () => {
      // Step 1: Create a new list
      console.log('Step 1: Creating new list...');
      const newList = await trpc.lists.create.mutate({
        name: 'My Top Picks',
        description: 'Apartments I\'m seriously considering',
        isPublic: false,
      });

      expect(newList).toBeDefined();
      expect(newList.name).toBe('My Top Picks');
      expect(newList.isPublic).toBe(false);
      expect(newList.itemCount).toBe(0);

      // Step 2: Add apartments to the list
      console.log('Step 2: Adding apartments to list...');
      
      // Add first apartment with notes
      await trpc.lists.addApartment.mutate({
        listId: newList.id,
        apartmentId: testApartments[0].id,
        notes: 'Perfect location, great price',
        rating: 5,
      });

      // Add second apartment
      await trpc.lists.addApartment.mutate({
        listId: newList.id,
        apartmentId: testApartments[1].id,
        notes: 'Good backup option',
        rating: 4,
      });

      // Add third apartment
      await trpc.lists.addApartment.mutate({
        listId: newList.id,
        apartmentId: testApartments[2].id,
        notes: 'Needs more consideration',
        rating: 3,
      });

      // Verify list contents
      const updatedList = await trpc.lists.getById.query({
        id: newList.id,
      });

      expect(updatedList.apartments).toHaveLength(3);
      expect(updatedList.apartments[0].notes).toBe('Perfect location, great price');
      expect(updatedList.apartments[0].rating).toBe(5);

      // Step 3: Organize and sort list items
      console.log('Step 3: Organizing list items...');
      
      // Update item position/order
      await trpc.lists.updateItemOrder.mutate({
        listId: newList.id,
        items: [
          { apartmentId: testApartments[0].id, position: 1 },
          { apartmentId: testApartments[2].id, position: 2 },
          { apartmentId: testApartments[1].id, position: 3 },
        ],
      });

      // Update notes for an item
      await trpc.lists.updateItemNotes.mutate({
        listId: newList.id,
        apartmentId: testApartments[2].id,
        notes: 'Actually looks better after second viewing',
        rating: 4,
      });

      // Step 4: Share the list
      console.log('Step 4: Sharing the list...');
      
      // Generate share link
      const shareData = await trpc.lists.generateShareLink.mutate({
        listId: newList.id,
        expiresIn: 7, // 7 days
      });

      expect(shareData.shareUrl).toBeDefined();
      expect(shareData.shareCode).toBeDefined();
      expect(shareData.expiresAt).toBeDefined();

      // Access shared list (simulating another user)
      const sharedList = await trpc.lists.getByShareCode.query({
        shareCode: shareData.shareCode,
      });

      expect(sharedList).toBeDefined();
      expect(sharedList.id).toBe(newList.id);
      expect(sharedList.apartments).toHaveLength(3);

      // Step 5: Collaborate on the list
      console.log('Step 5: Adding collaborator...');
      
      // Add second user as collaborator
      await trpc.lists.addCollaborator.mutate({
        listId: newList.id,
        userEmail: testUser2.email,
        permission: 'edit',
      });

      // Second user adds an apartment
      const collaboratorContext = { session: { user: testUser2 } };
      await trpc.lists.addApartment.mutate({
        listId: newList.id,
        apartmentId: testApartments[3].id,
        notes: 'Added by collaborator - looks promising',
        rating: 4,
      });

      // Step 6: Manage list items
      console.log('Step 6: Managing list items...');
      
      // Remove an apartment
      await trpc.lists.removeApartment.mutate({
        listId: newList.id,
        apartmentId: testApartments[1].id,
      });

      // Archive the list
      await trpc.lists.archive.mutate({
        listId: newList.id,
      });

      const archivedList = await trpc.lists.getById.query({
        id: newList.id,
      });

      expect(archivedList.archived).toBe(true);

      // Restore the list
      await trpc.lists.restore.mutate({
        listId: newList.id,
      });

      // Step 7: Export list data
      console.log('Step 7: Exporting list...');
      
      const exportData = await trpc.lists.export.query({
        listId: newList.id,
        format: 'json',
      });

      expect(exportData).toBeDefined();
      expect(exportData.list.name).toBe('My Top Picks');
      expect(exportData.apartments).toHaveLength(3); // After removing one

      // CSV export
      const csvExport = await trpc.lists.export.query({
        listId: newList.id,
        format: 'csv',
      });

      expect(csvExport).toBeDefined();
      expect(csvExport).toContain('Title,Rent,Size,Location');

      console.log('✅ List management flow completed successfully!');
    });

    it('should handle multiple lists and folders', async () => {
      // Create folder structure
      const folder1 = await trpc.lists.createFolder.mutate({
        name: 'Shibuya Area',
      });

      const folder2 = await trpc.lists.createFolder.mutate({
        name: 'Budget Options',
      });

      // Create lists in folders
      const list1 = await trpc.lists.create.mutate({
        name: 'Shibuya Walking Distance',
        folderId: folder1.id,
      });

      const list2 = await trpc.lists.create.mutate({
        name: 'Under 100k',
        folderId: folder2.id,
      });

      const list3 = await trpc.lists.create.mutate({
        name: 'General Favorites',
        // No folder - root level
      });

      // Get all lists organized by folders
      const allLists = await trpc.lists.getAllOrganized.query();

      expect(allLists.folders).toHaveLength(2);
      expect(allLists.rootLists).toHaveLength(1);
      expect(allLists.folders[0].lists).toHaveLength(1);

      // Move list between folders
      await trpc.lists.moveToFolder.mutate({
        listId: list3.id,
        folderId: folder1.id,
      });

      // Rename folder
      await trpc.lists.renameFolder.mutate({
        folderId: folder1.id,
        name: 'Shibuya & Nearby',
      });

      const updatedFolders = await trpc.lists.getAllOrganized.query();
      expect(updatedFolders.folders.find(f => f.id === folder1.id)?.name).toBe('Shibuya & Nearby');
    });

    it('should handle list templates and duplication', async () => {
      // Create a template list
      const template = await trpc.lists.create.mutate({
        name: 'Apartment Evaluation Template',
        description: 'Standard criteria for evaluating apartments',
        isTemplate: true,
      });

      // Add evaluation criteria as "apartments" (in real app, might be different)
      await trpc.lists.addApartment.mutate({
        listId: template.id,
        apartmentId: testApartments[0].id,
        notes: 'Location Score: /10',
      });

      // Create new list from template
      const fromTemplate = await trpc.lists.createFromTemplate.mutate({
        templateId: template.id,
        name: 'March 2024 Apartment Hunt',
      });

      expect(fromTemplate).toBeDefined();
      expect(fromTemplate.apartments).toHaveLength(1);
      expect(fromTemplate.apartments[0].notes).toContain('Location Score');

      // Duplicate existing list
      const originalList = await trpc.lists.create.mutate({
        name: 'Original List',
      });

      await trpc.lists.addApartment.mutate({
        listId: originalList.id,
        apartmentId: testApartments[1].id,
      });

      const duplicated = await trpc.lists.duplicate.mutate({
        listId: originalList.id,
        name: 'Copy of Original List',
      });

      expect(duplicated.name).toBe('Copy of Original List');
      expect(duplicated.apartments).toHaveLength(1);
      expect(duplicated.id).not.toBe(originalList.id);
    });

    it('should handle list permissions and privacy', async () => {
      // Create private list
      const privateList = await trpc.lists.create.mutate({
        name: 'Private Selections',
        isPublic: false,
      });

      // Try to access as another user (should fail)
      const otherUserContext = { session: { user: testUser2 } };
      await expect(
        trpc.lists.getById.query({
          id: privateList.id,
        })
      ).rejects.toThrow(/permission/i);

      // Make list public
      await trpc.lists.updatePrivacy.mutate({
        listId: privateList.id,
        isPublic: true,
      });

      // Now other user can view (but not edit)
      const publicView = await trpc.lists.getById.query({
        id: privateList.id,
      });

      expect(publicView).toBeDefined();

      // Try to edit as other user (should fail)
      await expect(
        trpc.lists.addApartment.mutate({
          listId: privateList.id,
          apartmentId: testApartments[0].id,
        })
      ).rejects.toThrow(/permission/i);

      // Create collaborative list
      const collabList = await trpc.lists.create.mutate({
        name: 'Shared Research',
        collaborators: [
          { email: testUser2.email, permission: 'view' },
        ],
      });

      // Collaborator can view
      const collabView = await trpc.lists.getById.query({
        id: collabList.id,
      });

      expect(collabView).toBeDefined();

      // Update collaborator permission
      await trpc.lists.updateCollaboratorPermission.mutate({
        listId: collabList.id,
        userId: testUser2.id,
        permission: 'edit',
      });

      // Now collaborator can edit
      await trpc.lists.addApartment.mutate({
        listId: collabList.id,
        apartmentId: testApartments[0].id,
      });
    });
  });

  describe('Advanced List Features', () => {
    it('should support list analytics and insights', async () => {
      // Create list with multiple apartments
      const analyticsList = await trpc.lists.create.mutate({
        name: 'Analysis Test',
      });

      // Add all test apartments
      await Promise.all(
        testApartments.map((apt, index) =>
          trpc.lists.addApartment.mutate({
            listId: analyticsList.id,
            apartmentId: apt.id,
            rating: 5 - index,
          })
        )
      );

      // Get list analytics
      const analytics = await trpc.lists.getAnalytics.query({
        listId: analyticsList.id,
      });

      expect(analytics).toBeDefined();
      expect(analytics.totalApartments).toBe(5);
      expect(analytics.averageRent).toBeDefined();
      expect(analytics.averageSize).toBeDefined();
      expect(analytics.averageRating).toBeDefined();
      expect(analytics.priceRange).toBeDefined();
      expect(analytics.priceRange.min).toBe(80000);
      expect(analytics.priceRange.max).toBe(120000);
      expect(analytics.locationBreakdown).toBeDefined();
      expect(analytics.roomTypeBreakdown).toBeDefined();
    });

    it('should support list comparison', async () => {
      // Create two lists to compare
      const list1 = await trpc.lists.create.mutate({
        name: 'Budget Options',
      });

      const list2 = await trpc.lists.create.mutate({
        name: 'Premium Options',
      });

      // Add apartments to lists
      await Promise.all([
        trpc.lists.addApartment.mutate({
          listId: list1.id,
          apartmentId: testApartments[0].id,
        }),
        trpc.lists.addApartment.mutate({
          listId: list1.id,
          apartmentId: testApartments[1].id,
        }),
        trpc.lists.addApartment.mutate({
          listId: list2.id,
          apartmentId: testApartments[3].id,
        }),
        trpc.lists.addApartment.mutate({
          listId: list2.id,
          apartmentId: testApartments[4].id,
        }),
      ]);

      // Compare lists
      const comparison = await trpc.lists.compare.query({
        listIds: [list1.id, list2.id],
      });

      expect(comparison).toBeDefined();
      expect(comparison.lists).toHaveLength(2);
      
      comparison.lists.forEach(list => {
        expect(list.averageRent).toBeDefined();
        expect(list.averageSize).toBeDefined();
        expect(list.apartmentCount).toBeDefined();
      });

      expect(comparison.commonApartments).toHaveLength(0);
      expect(comparison.insights).toBeDefined();
    });

    it('should support bulk operations', async () => {
      const bulkList = await trpc.lists.create.mutate({
        name: 'Bulk Operations Test',
      });

      // Bulk add apartments
      const bulkAdd = await trpc.lists.bulkAddApartments.mutate({
        listId: bulkList.id,
        apartments: testApartments.slice(0, 3).map(apt => ({
          apartmentId: apt.id,
          notes: `Bulk added - ${apt.title}`,
          rating: 4,
        })),
      });

      expect(bulkAdd.added).toBe(3);

      // Bulk update ratings
      await trpc.lists.bulkUpdateRatings.mutate({
        listId: bulkList.id,
        updates: [
          { apartmentId: testApartments[0].id, rating: 5 },
          { apartmentId: testApartments[1].id, rating: 3 },
        ],
      });

      // Bulk remove
      await trpc.lists.bulkRemoveApartments.mutate({
        listId: bulkList.id,
        apartmentIds: [testApartments[1].id, testApartments[2].id],
      });

      const finalList = await trpc.lists.getById.query({
        id: bulkList.id,
      });

      expect(finalList.apartments).toHaveLength(1);
      expect(finalList.apartments[0].rating).toBe(5);
    });
  });
});