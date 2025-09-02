import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider } from '~/trpc/react';
import { SearchProvider } from '~/contexts/SearchContext';
import { ListManagementProvider } from '~/contexts/ListManagementContext';
import { UserPreferencesProvider } from '~/contexts/UserPreferencesContext';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

// Mock session for tests
const mockSession: Session = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    toString: jest.fn(),
  }),
  usePathname: () => '/search',
}));

// Mock next/dynamic
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
});

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Create a test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
  initialSearchFilters?: any;
  initialCommuteFilters?: any;
}

// Custom render function that includes all providers
export function AllTheProviders({ 
  children, 
  session = mockSession,
  initialSearchFilters,
  initialCommuteFilters,
}: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider>
          <UserPreferencesProvider>
            <SearchProvider 
              initialFilters={initialSearchFilters}
              initialCommuteFilters={initialCommuteFilters}
            >
              <ListManagementProvider>
                {children}
              </ListManagementProvider>
            </SearchProvider>
          </UserPreferencesProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    session?: Session | null;
    initialSearchFilters?: any;
    initialCommuteFilters?: any;
  }
) => {
  const { session, initialSearchFilters, initialCommuteFilters, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders 
        session={session}
        initialSearchFilters={initialSearchFilters}
        initialCommuteFilters={initialCommuteFilters}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Mock data factories
export const createMockApartment = (overrides?: any) => ({
  id: 'apt-1',
  title: 'Modern 2LDK Apartment',
  titleEn: 'Modern 2LDK Apartment',
  address: '東京都渋谷区渋谷1-1-1',
  addressEn: 'Shibuya 1-1-1, Shibuya-ku, Tokyo',
  price: 150000,
  size: 60.5,
  layout: '2LDK',
  floor: 5,
  totalFloors: 10,
  age: 5,
  description: 'A modern apartment in the heart of Shibuya',
  features: ['Auto-lock', 'Balcony', 'Corner unit'],
  images: ['/images/apt1.jpg', '/images/apt2.jpg'],
  nearestStation: {
    id: 'station-1',
    name: 'Shibuya',
    nameEn: 'Shibuya',
    lines: ['JY', 'G01'],
    distanceMinutes: 5,
  },
  commuteInfo: {
    durationMinutes: 25,
    transferCount: 1,
    targetStation: 'Tokyo',
  },
  latitude: 35.6595,
  longitude: 139.7004,
  available: true,
  provider: 'suumo',
  externalId: 'ext-123',
  externalUrl: 'https://example.com/apt-1',
  likedAt: null,
  bookmarkedAt: null,
  viewedAt: null,
  hiddenAt: null,
  ...overrides,
});

export const createMockStation = (overrides?: any) => ({
  id: 'station-1',
  name: 'Shibuya',
  nameEn: 'Shibuya',
  lines: [
    { id: 'JY', name: 'Yamanote Line', color: '#00ac00' },
    { id: 'G01', name: 'Ginza Line', color: '#ff9500' },
  ],
  latitude: 35.6595,
  longitude: 139.7004,
  ...overrides,
});

export const createMockList = (overrides?: any) => ({
  id: 'list-1',
  name: 'My Favorites',
  description: 'Apartments I really like',
  apartments: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  userId: 'test-user-id',
  ...overrides,
});

// Test helpers
export const waitForLoadingToFinish = () => 
  waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

export { default as userEvent } from '@testing-library/user-event';
export { waitFor, screen } from '@testing-library/react';