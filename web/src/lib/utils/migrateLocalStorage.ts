/**
 * Utility to migrate legacy localStorage data to the new centralized store
 * This ensures backward compatibility for existing users
 */

export function migrateLocalStorageData() {
  if (typeof window === 'undefined') return;

  const MIGRATED_KEY = 'tokyo-rent-finder-migrated-v2';
  
  // Check if migration has already been done
  if (localStorage.getItem(MIGRATED_KEY) === 'true') {
    return;
  }

  try {
    // Get the new store data if it exists
    const newStoreKey = 'tokyo-rent-finder-store';
    const existingStoreData = localStorage.getItem(newStoreKey);
    let storeData = existingStoreData ? JSON.parse(existingStoreData) : {
      state: {
        userSettings: {},
        userLists: { saved: [], favorites: [], liked: [], hidden: [] },
        savedSearches: [],
        comparisonApartments: []
      }
    };

    // Migrate user settings
    const oldSettingsKey = 'tokyo-rent-finder-user-settings';
    const oldSettings = localStorage.getItem(oldSettingsKey);
    if (oldSettings && !existingStoreData) {
      try {
        const parsedSettings = JSON.parse(oldSettings);
        storeData.state.userSettings = { ...storeData.state.userSettings, ...parsedSettings };
      } catch (e) {
        console.error('Error migrating user settings:', e);
      }
    }

    // Migrate user lists
    const oldListsKey = 'tokyo-rent-finder-lists';
    const oldLists = localStorage.getItem(oldListsKey);
    if (oldLists && !existingStoreData) {
      try {
        const parsedLists = JSON.parse(oldLists);
        storeData.state.userLists = parsedLists;
      } catch (e) {
        console.error('Error migrating user lists:', e);
      }
    }

    // Migrate saved searches
    const oldSearchesKey = 'rent-finder-saved-searches';
    const oldSearches = localStorage.getItem(oldSearchesKey);
    if (oldSearches && !existingStoreData) {
      try {
        const parsedSearches = JSON.parse(oldSearches);
        storeData.state.savedSearches = parsedSearches;
      } catch (e) {
        console.error('Error migrating saved searches:', e);
      }
    }

    // Migrate comparison apartments
    const oldComparisonKey = 'rent-finder-comparison';
    const oldComparison = localStorage.getItem(oldComparisonKey);
    if (oldComparison && !existingStoreData) {
      try {
        const parsedComparison = JSON.parse(oldComparison);
        storeData.state.comparisonApartments = parsedComparison;
      } catch (e) {
        console.error('Error migrating comparison apartments:', e);
      }
    }

    // Migrate legacy browse page lists (string arrays of IDs)
    const legacyKeys = ['savedApartments', 'starredApartments', 'likedApartments', 'blockedApartments'];
    const legacyMapping = {
      'savedApartments': 'saved',
      'starredApartments': 'favorites',
      'likedApartments': 'liked',
      'blockedApartments': 'hidden'
    };

    legacyKeys.forEach(key => {
      const legacyData = localStorage.getItem(key);
      if (legacyData && !existingStoreData) {
        try {
          const parsedIds = JSON.parse(legacyData);
          const listType = legacyMapping[key as keyof typeof legacyMapping];
          
          // Only migrate if the new list is empty
          if (storeData.state.userLists[listType].length === 0 && Array.isArray(parsedIds)) {
            // Convert IDs to minimal apartment objects
            storeData.state.userLists[listType] = parsedIds.map((id: string) => ({
              id,
              title: 'Migrated Apartment',
              rentMonthly: 0,
              size: 0,
              layout: '',
              address: '',
              addedAt: new Date().toISOString()
            }));
          }
        } catch (e) {
          console.error(`Error migrating ${key}:`, e);
        }
      }
    });

    // Save the migrated data
    localStorage.setItem(newStoreKey, JSON.stringify(storeData));

    // Mark migration as complete
    localStorage.setItem(MIGRATED_KEY, 'true');

    // Optionally clean up old keys (commented out for safety)
    // localStorage.removeItem(oldSettingsKey);
    // localStorage.removeItem(oldListsKey);
    // localStorage.removeItem(oldSearchesKey);
    // localStorage.removeItem(oldComparisonKey);
    // legacyKeys.forEach(key => localStorage.removeItem(key));

    console.log('LocalStorage migration completed successfully');
  } catch (error) {
    console.error('Error during localStorage migration:', error);
  }
}