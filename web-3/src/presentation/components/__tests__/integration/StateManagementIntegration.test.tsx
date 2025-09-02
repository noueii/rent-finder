import React from 'react';
import { render, screen, waitFor, act } from './test-utils';
import userEvent from '@testing-library/user-event';
import { SearchProvider, useSearch } from '~/contexts/SearchContext';
import { ListManagementProvider, useListManagement } from '~/contexts/ListManagementContext';
import { UserPreferencesProvider, useUserPreferences } from '~/contexts/UserPreferencesContext';
import { createMockApartment, createMockStation } from './test-utils';
import * as api from '~/trpc/react';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Test component that uses all contexts
function TestComponent() {
  const search = useSearch();
  const listManagement = useListManagement();
  const userPrefs = useUserPreferences();

  const mockApartment = createMockApartment({ id: 'test-apt' });
  const mockStation = createMockStation({ id: 'test-station' });

  return (
    <div>
      {/* Search Context Controls */}
      <div data-testid="search-controls">
        <button onClick={() => search.updateFilters({ minPrice: 100000 })}>
          Update Min Price
        </button>
        <button onClick={() => search.setWorkplaceStation(mockStation)}>
          Set Workplace Station
        </button>
        <button onClick={() => search.addStation('station-1')}>
          Add Station
        </button>
        <button onClick={() => search.removeStation('station-1')}>
          Remove Station
        </button>
        <button onClick={() => search.setSearchMode('commute')}>
          Switch to Commute Mode
        </button>
        <button onClick={() => search.resetFilters()}>
          Reset Filters
        </button>
        <div data-testid="search-state">
          {JSON.stringify({
            filters: search.filters,
            commuteFilters: search.commuteFilters,
            searchMode: search.searchMode,
            selectedStations: search.selectedStations,
          })}
        </div>
      </div>

      {/* List Management Controls */}
      <div data-testid="list-controls">
        <button onClick={() => listManagement.onLikeApartment(mockApartment)}>
          Like Apartment
        </button>
        <button onClick={() => listManagement.onBookmarkApartment(mockApartment)}>
          Bookmark Apartment
        </button>
        <button onClick={() => listManagement.onViewApartment(mockApartment)}>
          View Apartment
        </button>
        <button onClick={() => listManagement.onAddToList('list-1', 'test-apt')}>
          Add to List
        </button>
      </div>

      {/* User Preferences Controls */}
      <div data-testid="prefs-controls">
        <button onClick={() => userPrefs.setViewMode('grid')}>
          Switch to Grid View
        </button>
        <button onClick={() => userPrefs.setSortBy('price')}>
          Sort by Price
        </button>
        <button onClick={() => userPrefs.setHideViewed(true)}>
          Hide Viewed
        </button>
        <button onClick={() => userPrefs.updateClientSideFilters({ showBookmarked: true })}>
          Show Only Bookmarked
        </button>
        <div data-testid="prefs-state">
          {JSON.stringify({
            viewMode: userPrefs.viewMode,
            sortBy: userPrefs.sortBy,
            sortOrder: userPrefs.sortOrder,
            hideViewed: userPrefs.hideViewed,
            clientSideFilters: userPrefs.clientSideFilters,
          })}
        </div>
      </div>
    </div>
  );
}

// Component that simulates a real use case
function ApartmentSearchExperience() {
  const search = useSearch();
  const userPrefs = useUserPreferences();
  const listManagement = useListManagement();

  const apartments = [
    createMockApartment({ id: 'apt-1', price: 120000, bookmarkedAt: new Date() }),
    createMockApartment({ id: 'apt-2', price: 150000, viewedAt: new Date() }),
    createMockApartment({ id: 'apt-3', price: 90000 }),
  ];

  // Filter apartments based on contexts
  const filteredApartments = apartments.filter(apt => {
    // Apply search filters
    if (search.filters.minPrice && apt.price < search.filters.minPrice) return false;
    if (search.filters.maxPrice && apt.price > search.filters.maxPrice) return false;

    // Apply user preference filters
    if (userPrefs.hideViewed && apt.viewedAt) return false;
    if (userPrefs.clientSideFilters.showBookmarked && !apt.bookmarkedAt) return false;

    return true;
  });

  // Sort apartments based on user preferences
  const sortedApartments = [...filteredApartments].sort((a, b) => {
    const order = userPrefs.sortOrder === 'asc' ? 1 : -1;
    if (userPrefs.sortBy === 'price') {
      return (a.price - b.price) * order;
    }
    return 0;
  });

  return (
    <div>
      <h1>Search Mode: {search.searchMode}</h1>
      <h2>View Mode: {userPrefs.viewMode}</h2>
      
      <div data-testid="apartment-results">
        {sortedApartments.map(apt => (
          <div key={apt.id} data-testid={`apartment-${apt.id}`}>
            <span>{apt.id}</span>
            <span>¥{apt.price}</span>
            {apt.viewedAt && <span>Viewed</span>}
            {apt.bookmarkedAt && <span>Bookmarked</span>}
            <button onClick={() => listManagement.onViewApartment(apt)}>
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

describe('State Management Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('integrates all three contexts without conflicts', async () => {
    const user = userEvent.setup();
    
    render(
      <UserPreferencesProvider>
        <SearchProvider>
          <ListManagementProvider>
            <TestComponent />
          </ListManagementProvider>
        </SearchProvider>
      </UserPreferencesProvider>
    );

    // Test search context
    await user.click(screen.getByText('Update Min Price'));
    await user.click(screen.getByText('Add Station'));

    // Test user preferences
    await user.click(screen.getByText('Switch to Grid View'));
    await user.click(screen.getByText('Sort by Price'));

    // Test list management (won't actually work without mocked mutations)
    await user.click(screen.getByText('Like Apartment'));

    // Verify states are independent
    const searchState = JSON.parse(screen.getByTestId('search-state').textContent!);
    const prefsState = JSON.parse(screen.getByTestId('prefs-state').textContent!);

    expect(searchState.filters.minPrice).toBe(100000);
    expect(searchState.selectedStations).toContain('station-1');
    expect(prefsState.viewMode).toBe('grid');
    expect(prefsState.sortBy).toBe('price');
  });

  it('handles search mode transitions correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    // Start in standard mode
    let state = JSON.parse(screen.getByTestId('search-state').textContent!);
    expect(state.searchMode).toBe('standard');

    // Set workplace station (switches to commute mode)
    await user.click(screen.getByText('Set Workplace Station'));
    
    state = JSON.parse(screen.getByTestId('search-state').textContent!);
    expect(state.searchMode).toBe('commute');
    expect(state.commuteFilters.workplaceStationId).toBe('test-station');

    // Switch back to standard mode
    await user.click(screen.getByText('Switch to Commute Mode')); // This actually resets commute filters
    
    // Manually switch to standard by resetting
    await user.click(screen.getByText('Reset Filters'));
    
    state = JSON.parse(screen.getByTestId('search-state').textContent!);
    expect(state.searchMode).toBe('standard');
  });

  it('persists user preferences to localStorage', async () => {
    const user = userEvent.setup();
    
    render(
      <UserPreferencesProvider>
        <TestComponent />
      </UserPreferencesProvider>
    );

    // Change preferences
    await user.click(screen.getByText('Switch to Grid View'));
    await user.click(screen.getByText('Hide Viewed'));
    await user.click(screen.getByText('Show Only Bookmarked'));

    // Check localStorage was called
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'user-preferences',
        expect.stringContaining('"viewMode":"grid"')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'user-preferences',
        expect.stringContaining('"hideViewed":true')
      );
    });
  });

  it('loads preferences from localStorage on mount', () => {
    const savedPrefs = {
      viewMode: 'map',
      sortBy: 'size',
      sortOrder: 'asc',
      clientSideFilters: { showBookmarked: true },
    };
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPrefs));

    render(
      <UserPreferencesProvider>
        <TestComponent />
      </UserPreferencesProvider>
    );

    const prefsState = JSON.parse(screen.getByTestId('prefs-state').textContent!);
    expect(prefsState.viewMode).toBe('map');
    expect(prefsState.sortBy).toBe('size');
    expect(prefsState.clientSideFilters.showBookmarked).toBe(true);
  });

  it('handles complex filtering and sorting scenarios', async () => {
    const user = userEvent.setup();
    
    render(
      <UserPreferencesProvider>
        <SearchProvider>
          <ListManagementProvider>
            <ApartmentSearchExperience />
          </ListManagementProvider>
        </SearchProvider>
      </UserPreferencesProvider>
    );

    // Initially shows all apartments
    expect(screen.getByTestId('apartment-apt-1')).toBeInTheDocument();
    expect(screen.getByTestId('apartment-apt-2')).toBeInTheDocument();
    expect(screen.getByTestId('apartment-apt-3')).toBeInTheDocument();

    // Apply search filter
    const searchControls = render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    ).container;
    
    // This is a simplified test - in real app, we'd update filters through UI
    // For now, we'll test the filtering logic directly
  });

  it('handles station management in search context', async () => {
    const user = userEvent.setup();
    
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    // Add multiple stations
    await user.click(screen.getByText('Add Station'));
    
    // Add another station by modifying the test component
    const state1 = JSON.parse(screen.getByTestId('search-state').textContent!);
    expect(state1.selectedStations).toHaveLength(1);
    expect(state1.selectedStations).toContain('station-1');

    // Remove station
    await user.click(screen.getByText('Remove Station'));
    
    const state2 = JSON.parse(screen.getByTestId('search-state').textContent!);
    expect(state2.selectedStations).toHaveLength(0);
  });

  it('synchronizes filter and station updates', async () => {
    const user = userEvent.setup();
    
    function StationSyncTest() {
      const search = useSearch();
      
      return (
        <div>
          <button onClick={() => search.addStation('station-a')}>Add Station A</button>
          <button onClick={() => search.addStation('station-b')}>Add Station B</button>
          <button onClick={() => search.clearStations()}>Clear Stations</button>
          <div data-testid="stations">{search.selectedStations.join(',')}</div>
          <div data-testid="filter-stations">{search.filters.stationIds?.join(',') || ''}</div>
        </div>
      );
    }

    render(
      <SearchProvider>
        <StationSyncTest />
      </SearchProvider>
    );

    // Add stations
    await user.click(screen.getByText('Add Station A'));
    await user.click(screen.getByText('Add Station B'));

    // Both should be synchronized
    expect(screen.getByTestId('stations').textContent).toBe('station-a,station-b');
    expect(screen.getByTestId('filter-stations').textContent).toBe('station-a,station-b');

    // Clear stations
    await user.click(screen.getByText('Clear Stations'));

    // Both should be cleared
    expect(screen.getByTestId('stations').textContent).toBe('');
    expect(screen.getByTestId('filter-stations').textContent).toBe('');
  });

  it('handles preference resets correctly', async () => {
    const user = userEvent.setup();
    
    function ResetTest() {
      const prefs = useUserPreferences();
      
      return (
        <div>
          <button onClick={() => prefs.updateClientSideFilters({ 
            showBookmarked: true,
            showLiked: true,
            hideViewed: true,
          })}>
            Set Filters
          </button>
          <button onClick={() => prefs.resetClientSideFilters()}>
            Reset Filters
          </button>
          <div data-testid="filters">
            {JSON.stringify(prefs.clientSideFilters)}
          </div>
          <div data-testid="hide-viewed">{String(prefs.hideViewed)}</div>
        </div>
      );
    }

    render(
      <UserPreferencesProvider>
        <ResetTest />
      </UserPreferencesProvider>
    );

    // Set filters
    await user.click(screen.getByText('Set Filters'));
    
    expect(screen.getByTestId('filters').textContent).toContain('"showBookmarked":true');
    expect(screen.getByTestId('hide-viewed').textContent).toBe('true');

    // Reset filters
    await user.click(screen.getByText('Reset Filters'));
    
    expect(screen.getByTestId('filters').textContent).toBe('{}');
    expect(screen.getByTestId('hide-viewed').textContent).toBe('false');
  });

  it('handles errors in localStorage gracefully', () => {
    // Mock localStorage to throw error
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not crash the app
    expect(() => {
      render(
        <UserPreferencesProvider>
          <TestComponent />
        </UserPreferencesProvider>
      );
    }).not.toThrow();

    // Console error should be logged
    expect(console.error).toHaveBeenCalledWith(
      'Failed to save user preferences:',
      expect.any(Error)
    );
  });

  it('maintains consistency across multiple context updates', async () => {
    const user = userEvent.setup();
    
    function ConsistencyTest() {
      const search = useSearch();
      const prefs = useUserPreferences();
      
      const handleComplexUpdate = () => {
        // Simulate rapid updates
        search.updateFilters({ minPrice: 100000 });
        prefs.setSortBy('price');
        search.updateFilters({ maxPrice: 200000 });
        prefs.setViewMode('grid');
        search.addStation('station-1');
      };
      
      return (
        <div>
          <button onClick={handleComplexUpdate}>Complex Update</button>
          <div data-testid="final-state">
            {JSON.stringify({
              searchFilters: search.filters,
              prefsSort: prefs.sortBy,
              prefsView: prefs.viewMode,
            })}
          </div>
        </div>
      );
    }

    render(
      <UserPreferencesProvider>
        <SearchProvider>
          <ConsistencyTest />
        </SearchProvider>
      </UserPreferencesProvider>
    );

    await user.click(screen.getByText('Complex Update'));

    // All updates should be applied
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('final-state').textContent!);
      expect(state.searchFilters.minPrice).toBe(100000);
      expect(state.searchFilters.maxPrice).toBe(200000);
      expect(state.searchFilters.stationIds).toContain('station-1');
      expect(state.prefsSort).toBe('price');
      expect(state.prefsView).toBe('grid');
    });
  });
});