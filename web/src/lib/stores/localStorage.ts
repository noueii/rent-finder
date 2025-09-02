import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import { migrateLocalStorageData } from '@/lib/utils/migrateLocalStorage';
export interface ApartmentComparisonData {
  id: string;
  title: string;
  rentMonthly: number;
  size: number;
  layout: string;
  buildingName?: string;
  buildingAge?: number;
  walkingMinutes: number;
  imageUrls?: string[];
  features?: string[];
  station: {
    id: string;
    name: string;
    nameJa: string;
  };
  commute: {
    totalMinutes: number;
    transitMinutes: number;
    walkingMinutes: number;
    transferCount: number;
  };
}

export interface SavedSearch {
  id: string;
  name: string;
  targetStation: string;
  targetStationName: string;
  maxCommuteTime: number;
  filters: {
    priceRange?: [number, number];
    sizeRange?: [number, number];
    layouts?: string[];
    features?: string[];
    buildingTypes?: string[];
    maxBuildingAge?: number;
    maxWalkingMinutes?: number;
    hasImages?: boolean;
    petFriendly?: boolean;
  };
  createdAt: string;
  lastSearched?: string;
}

// Storage keys
const STORAGE_PREFIX = 'tokyo-rent-finder';
const USER_ID_KEY = `${STORAGE_PREFIX}-user-id`;
const STORAGE_KEY = `${STORAGE_PREFIX}-store`;

// Types
export interface UserSettings {
  // Default commute settings
  defaultCommuteStation?: string;
  defaultCommuteStationName?: string;
  defaultCommuteTime?: number;
  
  // Default search preferences
  defaultPriceRange?: {
    min: number;
    max: number;
  };
  defaultSizeRange?: {
    min: number;
    max: number;
  };
  defaultLayouts?: string[];
  defaultMaxBuildingAge?: number;
  defaultMaxWalkingMinutes?: number;
  
  // UI preferences
  defaultView?: 'list' | 'map';
  defaultSortBy?: string;
  trainLineColors?: boolean;
  showTransitDetails?: boolean;
  language?: 'en' | 'ja';
  theme?: 'light' | 'dark' | 'system';
  
  // Office/work location for transit directions
  workLocation?: {
    name: string;
    address: string;
  };
  
  // Notification preferences (for future features)
  emailNotifications?: boolean;
  newListingAlerts?: boolean;
  priceDropAlerts?: boolean;
}

export interface ApartmentListItem {
  id: string;
  title: string;
  rentMonthly: number;
  size: number;
  layout: string;
  address: string;
  buildingAge?: number;
  walkingMinutes?: number;
  stationName?: string;
  addedAt: string;
  source?: {
    site: string;
    url: string;
  };
}

export interface UserLists {
  saved: ApartmentListItem[];
  favorites: ApartmentListItem[];
  liked: ApartmentListItem[];
  hidden: ApartmentListItem[];
}

export interface LocalStorageState {
  // User data
  userId: string;
  userSettings: UserSettings;
  userLists: UserLists;
  
  // Search data
  savedSearches: SavedSearch[];
  
  // Comparison data
  comparisonApartments: ApartmentComparisonData[];
  
  // Actions
  initializeUserId: () => void;
  
  // User settings actions
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  resetUserSettings: () => void;
  getDefaultSearchFilters: () => any;
  updateCommuteSettings: (stationId: string, stationName: string, commuteTime: number) => void;
  updateWorkLocation: (name: string, address: string) => void;
  
  // User lists actions
  addToList: (listType: keyof UserLists, apartment: any) => void;
  removeFromList: (listType: keyof UserLists, apartmentId: string) => void;
  toggleListItem: (listType: keyof UserLists, apartment: any) => void;
  isInList: (listType: keyof UserLists, apartmentId: string) => boolean;
  clearList: (listType: keyof UserLists) => void;
  getListStatus: (apartmentId: string) => { saved: boolean; favorites: boolean; liked: boolean; hidden: boolean };
  
  // Saved searches actions
  saveSearch: (name: string, targetStation: string, targetStationName: string, maxCommuteTime: number, filters: SavedSearch['filters']) => SavedSearch;
  removeSavedSearch: (searchId: string) => void;
  updateSavedSearch: (searchId: string, updates: Partial<SavedSearch>) => void;
  markAsSearched: (searchId: string) => void;
  isSearchSaved: (targetStation: string, maxCommuteTime: number, filters: SavedSearch['filters']) => boolean;
  getSearchById: (searchId: string) => SavedSearch | undefined;
  getRecentSearches: (limit?: number) => SavedSearch[];
  
  // Comparison actions
  addToComparison: (apartment: ApartmentComparisonData) => { success: boolean; message: string };
  removeFromComparison: (apartmentId: string) => void;
  clearComparison: () => void;
  isInComparison: (apartmentId: string) => boolean;
  getComparisonStats: () => any;
  canAddMoreToComparison: () => boolean;
}

// Default values
const defaultUserSettings: UserSettings = {
  defaultCommuteTime: 30,
  defaultPriceRange: { min: 50000, max: 200000 },
  defaultSizeRange: { min: 20, max: 80 },
  defaultLayouts: [],
  defaultView: 'list',
  defaultSortBy: 'price_asc',
  trainLineColors: true,
  showTransitDetails: true,
  language: 'en',
  theme: 'system',
  workLocation: {
    name: 'Colorkrew Office',
    address: 'Colorkrew、〒111-0041 Tokyo, Taito City, Motoasakusa, 3 Chome−7−1 住友不動産上野御徒町ビル 5階'
  },
  emailNotifications: false,
  newListingAlerts: false,
  priceDropAlerts: false,
};

const defaultUserLists: UserLists = {
  saved: [],
  favorites: [],
  liked: [],
  hidden: [],
};

// Helper to get or create user ID
const getOrCreateUserId = (): string => {
  if (typeof window === 'undefined') return '';
  
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

// Create the store
export const useLocalStorage = create<LocalStorageState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      userId: '',
      userSettings: defaultUserSettings,
      userLists: defaultUserLists,
      savedSearches: [],
      comparisonApartments: [],
      
      // Initialize user ID
      initializeUserId: () => {
        const userId = getOrCreateUserId();
        set((state) => {
          state.userId = userId;
        });
      },
      
      // User settings actions
      updateUserSettings: (settings) => {
        set((state) => {
          state.userSettings = { ...state.userSettings, ...settings };
        });
      },
      
      resetUserSettings: () => {
        set((state) => {
          state.userSettings = defaultUserSettings;
        });
      },
      
      getDefaultSearchFilters: () => {
        const state = get();
        return {
          targetStation: state.userSettings.defaultCommuteStation,
          maxCommuteTime: state.userSettings.defaultCommuteTime,
          minPrice: state.userSettings.defaultPriceRange?.min,
          maxPrice: state.userSettings.defaultPriceRange?.max,
          minSize: state.userSettings.defaultSizeRange?.min,
          maxSize: state.userSettings.defaultSizeRange?.max,
          layouts: state.userSettings.defaultLayouts,
          maxBuildingAge: state.userSettings.defaultMaxBuildingAge,
          maxWalkingMinutes: state.userSettings.defaultMaxWalkingMinutes,
        };
      },
      
      updateCommuteSettings: (stationId, stationName, commuteTime) => {
        set((state) => {
          state.userSettings.defaultCommuteStation = stationId;
          state.userSettings.defaultCommuteStationName = stationName;
          state.userSettings.defaultCommuteTime = commuteTime;
        });
      },
      
      updateWorkLocation: (name, address) => {
        set((state) => {
          state.userSettings.workLocation = { name, address };
        });
      },
      
      // User lists actions
      addToList: (listType, apartment) => {
        set((state) => {
          const listItem: ApartmentListItem = {
            id: apartment.id,
            title: apartment.title || apartment.buildingName || 'Untitled Apartment',
            rentMonthly: apartment.rentMonthly,
            size: apartment.size,
            layout: apartment.layout,
            address: apartment.address,
            buildingAge: apartment.buildingAge,
            walkingMinutes: apartment.walkingMinutes,
            stationName: apartment.stationName || apartment.station?.name,
            addedAt: new Date().toISOString(),
            source: apartment.sourceSite ? {
              site: apartment.sourceSite,
              url: apartment.sourceUrl,
            } : undefined,
          };
          
          // Check if already exists
          const existingIndex = state.userLists[listType].findIndex(
            (item) => item.id === apartment.id
          );
          if (existingIndex === -1) {
            // Add to beginning of list
            state.userLists[listType].unshift(listItem);
          }
        });
      },
      
      removeFromList: (listType, apartmentId) => {
        set((state) => {
          state.userLists[listType] = state.userLists[listType].filter(
            (item) => item.id !== apartmentId
          );
        });
      },
      
      toggleListItem: (listType, apartment) => {
        const state = get();
        if (state.isInList(listType, apartment.id)) {
          state.removeFromList(listType, apartment.id);
        } else {
          state.addToList(listType, apartment);
        }
      },
      
      isInList: (listType, apartmentId) => {
        const state = get();
        return state.userLists[listType].some((item) => item.id === apartmentId);
      },
      
      clearList: (listType) => {
        set((state) => {
          state.userLists[listType] = [];
        });
      },
      
      getListStatus: (apartmentId) => {
        const state = get();
        return {
          saved: state.isInList('saved', apartmentId),
          favorites: state.isInList('favorites', apartmentId),
          liked: state.isInList('liked', apartmentId),
          hidden: state.isInList('hidden', apartmentId),
        };
      },
      
      // Saved searches actions
      saveSearch: (name, targetStation, targetStationName, maxCommuteTime, filters) => {
        const newSearch: SavedSearch = {
          id: Date.now().toString(),
          name,
          targetStation,
          targetStationName,
          maxCommuteTime,
          filters,
          createdAt: new Date().toISOString(),
        };
        
        set((state) => {
          state.savedSearches.push(newSearch);
        });
        
        return newSearch;
      },
      
      removeSavedSearch: (searchId) => {
        set((state) => {
          state.savedSearches = state.savedSearches.filter(
            (search) => search.id !== searchId
          );
        });
      },
      
      updateSavedSearch: (searchId, updates) => {
        set((state) => {
          const index = state.savedSearches.findIndex(
            (search) => search.id === searchId
          );
          if (index !== -1) {
            state.savedSearches[index] = {
              ...state.savedSearches[index],
              ...updates,
            };
          }
        });
      },
      
      markAsSearched: (searchId) => {
        const state = get();
        state.updateSavedSearch(searchId, { lastSearched: new Date().toISOString() });
      },
      
      isSearchSaved: (targetStation, maxCommuteTime, filters) => {
        const state = get();
        return state.savedSearches.some(search => 
          search.targetStation === targetStation &&
          search.maxCommuteTime === maxCommuteTime &&
          JSON.stringify(search.filters) === JSON.stringify(filters)
        );
      },
      
      getSearchById: (searchId) => {
        const state = get();
        return state.savedSearches.find(search => search.id === searchId);
      },
      
      getRecentSearches: (limit = 5) => {
        const state = get();
        return state.savedSearches
          .filter(search => search.lastSearched)
          .sort((a, b) => new Date(b.lastSearched!).getTime() - new Date(a.lastSearched!).getTime())
          .slice(0, limit);
      },
      
      // Comparison actions
      addToComparison: (apartment) => {
        const state = get();
        const MAX_COMPARISONS = 3;
        
        if (state.comparisonApartments.length >= MAX_COMPARISONS) {
          return { success: false, message: `Maximum ${MAX_COMPARISONS} apartments can be compared` };
        }
        
        if (state.comparisonApartments.some(apt => apt.id === apartment.id)) {
          return { success: false, message: 'Apartment already in comparison' };
        }
        
        set((state) => {
          state.comparisonApartments.push(apartment);
        });
        
        return { success: true, message: 'Added to comparison' };
      },
      
      removeFromComparison: (apartmentId) => {
        set((state) => {
          state.comparisonApartments = state.comparisonApartments.filter(
            (apt) => apt.id !== apartmentId
          );
        });
      },
      
      clearComparison: () => {
        set((state) => {
          state.comparisonApartments = [];
        });
      },
      
      isInComparison: (apartmentId) => {
        const state = get();
        return state.comparisonApartments.some((apt) => apt.id === apartmentId);
      },
      
      getComparisonStats: () => {
        const state = get();
        const apartments = state.comparisonApartments;
        
        if (apartments.length === 0) {
          return null;
        }
        
        const rents = apartments.map(apt => apt.rentMonthly);
        const sizes = apartments.map(apt => apt.size);
        const commutes = apartments.map(apt => apt.commute.totalMinutes);
        
        return {
          count: apartments.length,
          rent: {
            min: Math.min(...rents),
            max: Math.max(...rents),
            avg: Math.round(rents.reduce((sum, rent) => sum + rent, 0) / rents.length)
          },
          size: {
            min: Math.min(...sizes),
            max: Math.max(...sizes),
            avg: Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length)
          },
          commute: {
            min: Math.min(...commutes),
            max: Math.max(...commutes),
            avg: Math.round(commutes.reduce((sum, time) => sum + time, 0) / commutes.length)
          }
        };
      },
      
      canAddMoreToComparison: () => {
        const state = get();
        return state.comparisonApartments.length < 3;
      },
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        userSettings: state.userSettings,
        userLists: state.userLists,
        savedSearches: state.savedSearches,
        comparisonApartments: state.comparisonApartments,
      }),
    }
  )
);

// Hook to initialize user ID on mount
export const useInitializeLocalStorage = () => {
  const initializeUserId = useLocalStorage((state) => state.initializeUserId);
  
  if (typeof window !== 'undefined') {
    // Run migration before initializing
    migrateLocalStorageData();
    initializeUserId();
  }
};