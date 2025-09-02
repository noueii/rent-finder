import React from 'react';
import { render, screen, waitFor, within } from './test-utils';
import userEvent from '@testing-library/user-event';
import SearchPage from '~/app/search/page';
import { toast } from 'sonner';
import * as api from '~/trpc/react';
import { createMockApartment, createMockStation } from './test-utils';

// Mock TRPC API
jest.mock('~/trpc/react', () => ({
  api: {
    apartment: {
      search: {
        useQuery: jest.fn(),
      },
    },
    search: {
      refreshApartments: {
        useMutation: jest.fn(),
      },
    },
    useUtils: jest.fn(() => ({
      apartment: { invalidate: jest.fn() },
      list: { invalidate: jest.fn() },
    })),
  },
}));

// Mock components that we're not testing directly
jest.mock('~/components/search-form', () => ({
  SearchForm: () => <div data-testid="search-form">SearchForm</div>,
}));

jest.mock('~/components/apartment-filters', () => ({
  ApartmentFilters: ({ onFiltersChange, onSearchButtonClick }: any) => (
    <div data-testid="apartment-filters">
      <button onClick={() => onFiltersChange({ minPrice: 100000 })}>
        Set Min Price
      </button>
      <button onClick={onSearchButtonClick}>Apply Filters</button>
    </div>
  ),
}));

jest.mock('~/components/apartment-list', () => ({
  ApartmentList: ({ apartments }: any) => (
    <div data-testid="apartment-list">
      {apartments.map((apt: any) => (
        <div key={apt.id} data-testid={`apartment-${apt.id}`}>
          {apt.title}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('~/components/map', () => ({
  SearchResultsMap: ({ apartments, onApartmentClick }: any) => (
    <div data-testid="search-results-map">
      {apartments.map((apt: any) => (
        <button
          key={apt.id}
          data-testid={`map-marker-${apt.id}`}
          onClick={() => onApartmentClick(apt)}
        >
          {apt.title}
        </button>
      ))}
    </div>
  ),
}));

describe('Search Page Integration', () => {
  const mockApartments = [
    createMockApartment({ id: 'apt-1', title: 'Apartment 1' }),
    createMockApartment({ id: 'apt-2', title: 'Apartment 2' }),
    createMockApartment({ id: 'apt-3', title: 'Apartment 3' }),
  ];

  const mockSearchResponse = {
    apartments: mockApartments,
    total: 3,
    page: 1,
    limit: 20,
    hasMore: false,
  };

  let mockSearchQuery: jest.Mock;
  let mockRefreshMutation: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSearchQuery = jest.fn().mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockRefreshMutation = {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
    };

    (api.api.apartment.search.useQuery as jest.Mock) = mockSearchQuery;
    (api.api.search.refreshApartments.useMutation as jest.Mock).mockReturnValue(mockRefreshMutation);
  });

  it('renders all main components and integrates them properly', async () => {
    render(<SearchPage />);

    // Check main components are rendered
    expect(screen.getByTestId('search-form')).toBeInTheDocument();
    expect(screen.getByTestId('apartment-filters')).toBeInTheDocument();
    expect(screen.getByText('3 apartments found')).toBeInTheDocument();
    expect(screen.getByTestId('apartment-list')).toBeInTheDocument();
  });

  it('handles filter changes and updates search results', async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    // Apply filter
    const setMinPriceButton = screen.getByText('Set Min Price');
    await user.click(setMinPriceButton);

    const applyButton = screen.getByText('Apply Filters');
    await user.click(applyButton);

    // Check that search was called with updated filters
    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            minPrice: 100000,
          }),
        }),
        expect.any(Object)
      );
    });
  });

  it('switches between list and map view modes', async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    // Initially shows list view
    expect(screen.getByTestId('apartment-list')).toBeInTheDocument();
    expect(screen.queryByTestId('search-results-map')).not.toBeInTheDocument();

    // Switch to map view
    const mapTab = screen.getByRole('tab', { name: /map/i });
    await user.click(mapTab);

    // Now shows map view
    expect(screen.queryByTestId('apartment-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-results-map')).toBeInTheDocument();
  });

  it('handles apartment selection in map view', async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    // Switch to map view
    const mapTab = screen.getByRole('tab', { name: /map/i });
    await user.click(mapTab);

    // Click on apartment marker
    const marker = screen.getByTestId('map-marker-apt-1');
    await user.click(marker);

    // Check that apartment details are shown
    await waitFor(() => {
      expect(screen.getByText('Apartment 1')).toBeInTheDocument();
      expect(screen.getByText('¥150,000/月')).toBeInTheDocument();
    });
  });

  it('handles sorting changes', async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    // Open sort dropdown
    const sortSelect = screen.getByRole('combobox');
    await user.click(sortSelect);

    // Select price ascending
    const priceOption = screen.getByText('Price: Low to High');
    await user.click(priceOption);

    // Check that search was called with new sort
    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            sortBy: 'price',
            sortOrder: 'asc',
          }),
        }),
        expect.any(Object)
      );
    });
  });

  it('handles refresh functionality', async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockRefreshMutation.mutate).toHaveBeenCalledWith({
      filters: expect.any(Object),
      sort: expect.any(Object),
    });
  });

  it('shows loading state correctly', () => {
    mockSearchQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<SearchPage />);

    // Should show loading skeletons
    const skeletons = screen.getAllByTestId(/skeleton/i);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles error state properly', () => {
    mockSearchQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
      refetch: jest.fn(),
    });

    render(<SearchPage />);

    expect(screen.getByText(/error loading apartments/i)).toBeInTheDocument();
  });

  it('handles empty results', () => {
    mockSearchQuery.mockReturnValue({
      data: { apartments: [], total: 0, page: 1, limit: 20, hasMore: false },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<SearchPage />);

    expect(screen.getByText(/no apartments found/i)).toBeInTheDocument();
  });

  it('handles pagination correctly', async () => {
    const user = userEvent.setup();
    
    mockSearchQuery.mockReturnValue({
      data: { ...mockSearchResponse, total: 50, hasMore: true },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<SearchPage />);

    // Check pagination controls are shown
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Window.scrollTo should be called
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('toggles mobile filter drawer', async () => {
    const user = userEvent.setup();
    
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<SearchPage />);

    // Mobile filter button should be visible
    const mobileFilterButton = screen.getByRole('button', { name: '' }); // Icon button
    await user.click(mobileFilterButton);

    // Filter drawer should open
    await waitFor(() => {
      const filterDrawers = screen.getAllByTestId('apartment-filters');
      expect(filterDrawers).toHaveLength(2); // Desktop + mobile
    });
  });

  it('integrates with contexts properly', async () => {
    const user = userEvent.setup();
    
    // Render with initial filters from context
    render(<SearchPage />, {
      initialSearchFilters: {
        minPrice: 100000,
        maxPrice: 200000,
      },
    });

    // Should use initial filters
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          minPrice: 100000,
          maxPrice: 200000,
        }),
      }),
      expect.any(Object)
    );
  });

  it('handles successful refresh with toast notification', async () => {
    const user = userEvent.setup();
    
    mockRefreshMutation.mutate.mockImplementation(({ }, options?: any) => {
      // Simulate successful mutation
      options?.onSuccess?.({ message: 'Apartments refreshed successfully' });
    });

    render(<SearchPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(toast.success).toHaveBeenCalledWith('Apartments refreshed successfully');
  });

  it('handles failed refresh with error toast', async () => {
    const user = userEvent.setup();
    
    mockRefreshMutation.mutate.mockImplementation(({ }, options?: any) => {
      // Simulate failed mutation
      options?.onError?.({ message: 'Network error' });
    });

    render(<SearchPage />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(toast.error).toHaveBeenCalledWith('Network error');
  });

  it('maintains filter state across view mode changes', async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    // Apply filter
    const setMinPriceButton = screen.getByText('Set Min Price');
    await user.click(setMinPriceButton);
    
    const applyButton = screen.getByText('Apply Filters');
    await user.click(applyButton);

    // Switch to map view
    const mapTab = screen.getByRole('tab', { name: /map/i });
    await user.click(mapTab);

    // Switch back to list view
    const listTab = screen.getByRole('tab', { name: /list/i });
    await user.click(listTab);

    // Filters should still be applied
    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          minPrice: 100000,
        }),
      }),
      expect.any(Object)
    );
  });
});