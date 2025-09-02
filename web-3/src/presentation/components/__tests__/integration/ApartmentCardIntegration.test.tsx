import React from 'react';
import { render, screen, waitFor } from './test-utils';
import userEvent from '@testing-library/user-event';
import { ApartmentCard } from '~/presentation/components/apartment';
import { ListManagementProvider } from '~/contexts/ListManagementContext';
import { toast } from 'sonner';
import * as api from '~/trpc/react';
import { createMockApartment } from './test-utils';

// Mock TRPC API
jest.mock('~/trpc/react', () => ({
  api: {
    apartment: {
      toggleLike: {
        useMutation: jest.fn(),
      },
      toggleBookmark: {
        useMutation: jest.fn(),
      },
      markAsViewed: {
        useMutation: jest.fn(),
      },
    },
    list: {
      addApartment: {
        useMutation: jest.fn(),
      },
      removeApartment: {
        useMutation: jest.fn(),
      },
    },
    useUtils: jest.fn(() => ({
      apartment: { invalidate: jest.fn() },
      list: { invalidate: jest.fn() },
    })),
  },
}));

// Mock router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Apartment Card Integration', () => {
  const mockApartment = createMockApartment({
    id: 'apt-1',
    title: 'Beautiful 2LDK in Shibuya',
    price: 180000,
    size: 65.5,
    layout: '2LDK',
    images: ['/img1.jpg', '/img2.jpg', '/img3.jpg'],
    nearestStation: {
      id: 'station-1',
      name: 'Shibuya',
      lines: ['JY'],
      distanceMinutes: 5,
    },
    commuteInfo: {
      durationMinutes: 20,
      transferCount: 0,
      targetStation: 'Tokyo',
    },
  });

  let mockToggleLike: jest.Mock;
  let mockToggleBookmark: jest.Mock;
  let mockMarkAsViewed: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockToggleLike = jest.fn();
    mockToggleBookmark = jest.fn();
    mockMarkAsViewed = jest.fn();

    (api.api.apartment.toggleLike.useMutation as jest.Mock).mockReturnValue({
      mutate: mockToggleLike,
    });
    (api.api.apartment.toggleBookmark.useMutation as jest.Mock).mockReturnValue({
      mutate: mockToggleBookmark,
    });
    (api.api.apartment.markAsViewed.useMutation as jest.Mock).mockReturnValue({
      mutate: mockMarkAsViewed,
    });
  });

  it('renders all apartment card components together', () => {
    render(
      <ApartmentCard 
        apartment={mockApartment}
        showScore={true}
        showActions={true}
      />
    );

    // Card content
    expect(screen.getByText('Beautiful 2LDK in Shibuya')).toBeInTheDocument();
    
    // Price component
    expect(screen.getByText('¥180,000')).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
    
    // Property details
    expect(screen.getByText('65.5㎡')).toBeInTheDocument();
    expect(screen.getByText('2LDK')).toBeInTheDocument();
    
    // Station info
    expect(screen.getByText(/Shibuya.*5 min walk/)).toBeInTheDocument();
    
    // Score component (commute info)
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('min')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    
    // Action buttons
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bookmark/i })).toBeInTheDocument();
  });

  it('handles image gallery interaction', async () => {
    const user = userEvent.setup();
    render(<ApartmentCard apartment={mockApartment} />);

    // Should show first image
    const mainImage = screen.getByRole('img', { name: /Beautiful 2LDK in Shibuya/ });
    expect(mainImage).toHaveAttribute('src', '/img1.jpg');

    // Click on thumbnail
    const thumbnails = screen.getAllByRole('button', { name: /view image/i });
    await user.click(thumbnails[1]);

    // Main image should update
    await waitFor(() => {
      expect(mainImage).toHaveAttribute('src', '/img2.jpg');
    });
  });

  it('handles view action with list management context', async () => {
    const user = userEvent.setup();
    render(
      <ListManagementProvider>
        <ApartmentCard apartment={mockApartment} showActions />
      </ListManagementProvider>
    );

    const viewButton = screen.getByRole('button', { name: /view/i });
    await user.click(viewButton);

    // Should mark as viewed and navigate
    expect(mockMarkAsViewed).toHaveBeenCalledWith({ apartmentId: 'apt-1' });
    expect(mockPush).toHaveBeenCalledWith('/apartments/apt-1');
  });

  it('handles like action with state update', async () => {
    const user = userEvent.setup();
    const utils = api.api.useUtils();
    
    render(
      <ListManagementProvider>
        <ApartmentCard apartment={mockApartment} showActions />
      </ListManagementProvider>
    );

    const likeButton = screen.getByRole('button', { name: /like/i });
    await user.click(likeButton);

    expect(mockToggleLike).toHaveBeenCalledWith({ apartmentId: 'apt-1' });
    
    // Verify cache invalidation
    expect(utils.apartment.invalidate).toHaveBeenCalled();
    expect(utils.list.invalidate).toHaveBeenCalled();
  });

  it('handles bookmark action with state update', async () => {
    const user = userEvent.setup();
    const utils = api.api.useUtils();
    
    render(
      <ListManagementProvider>
        <ApartmentCard apartment={mockApartment} showActions />
      </ListManagementProvider>
    );

    const bookmarkButton = screen.getByRole('button', { name: /bookmark/i });
    await user.click(bookmarkButton);

    expect(mockToggleBookmark).toHaveBeenCalledWith({ apartmentId: 'apt-1' });
    
    // Verify cache invalidation
    expect(utils.apartment.invalidate).toHaveBeenCalled();
    expect(utils.list.invalidate).toHaveBeenCalled();
  });

  it('shows liked/bookmarked state correctly', () => {
    const likedApartment = createMockApartment({
      ...mockApartment,
      likedAt: new Date('2024-01-01'),
      bookmarkedAt: new Date('2024-01-01'),
    });

    render(
      <ApartmentCard apartment={likedApartment} showActions />
    );

    // Check for active states (implementation dependent)
    const likeButton = screen.getByRole('button', { name: /like/i });
    const bookmarkButton = screen.getByRole('button', { name: /bookmark/i });
    
    // These buttons should have some visual indication of being active
    expect(likeButton).toHaveClass(expect.stringContaining('text-red-500'));
    expect(bookmarkButton).toHaveClass(expect.stringContaining('text-yellow-500'));
  });

  it('handles loading states during actions', async () => {
    const user = userEvent.setup();
    
    // Mock slow mutation
    let resolveMutation: any;
    mockToggleLike.mockImplementation(() => {
      return new Promise(resolve => {
        resolveMutation = resolve;
      });
    });

    render(
      <ListManagementProvider>
        <ApartmentCard apartment={mockApartment} showActions />
      </ListManagementProvider>
    );

    const likeButton = screen.getByRole('button', { name: /like/i });
    await user.click(likeButton);

    // Button should be disabled during mutation
    expect(likeButton).toBeDisabled();

    // Resolve mutation
    resolveMutation();

    await waitFor(() => {
      expect(likeButton).not.toBeDisabled();
    });
  });

  it('handles different score display modes', () => {
    // With commute info
    render(
      <ApartmentCard 
        apartment={mockApartment}
        showScore={true}
      />
    );

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();

    // Without commute info
    const apartmentNoCommute = createMockApartment({
      ...mockApartment,
      commuteInfo: null,
    });

    const { rerender } = render(
      <ApartmentCard 
        apartment={apartmentNoCommute}
        showScore={true}
      />
    );

    // Should show walking time to station instead
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('min walk')).toBeInTheDocument();
  });

  it('handles price display variations', () => {
    // Regular price
    render(<ApartmentCard apartment={mockApartment} />);
    expect(screen.getByText('¥180,000')).toBeInTheDocument();

    // Zero price (should show special message)
    const freeApartment = createMockApartment({
      ...mockApartment,
      price: 0,
    });

    const { rerender } = render(<ApartmentCard apartment={freeApartment} />);
    expect(screen.getByText(/contact for price/i)).toBeInTheDocument();
  });

  it('integrates with responsive behavior', () => {
    // Test mobile layout
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(
      <ApartmentCard 
        apartment={mockApartment}
        variant="compact"
      />
    );

    // In compact mode, some elements might be hidden or rearranged
    // Verify key information is still visible
    expect(screen.getByText('Beautiful 2LDK in Shibuya')).toBeInTheDocument();
    expect(screen.getByText('¥180,000')).toBeInTheDocument();
  });

  it('handles error states gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock error
    mockToggleLike.mockImplementation((_, options?: any) => {
      options?.onError?.(new Error('Network error'));
    });

    render(
      <ListManagementProvider>
        <ApartmentCard apartment={mockApartment} showActions />
      </ListManagementProvider>
    );

    const likeButton = screen.getByRole('button', { name: /like/i });
    await user.click(likeButton);

    // Should show error toast
    expect(toast.error).toHaveBeenCalledWith('Failed to update');
  });

  it('preserves state across re-renders', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ApartmentCard apartment={mockApartment} />
    );

    // Click thumbnail
    const thumbnails = screen.getAllByRole('button', { name: /view image/i });
    await user.click(thumbnails[2]);

    // Verify third image is shown
    const mainImage = screen.getByRole('img', { name: /Beautiful 2LDK in Shibuya/ });
    expect(mainImage).toHaveAttribute('src', '/img3.jpg');

    // Re-render with same props
    rerender(<ApartmentCard apartment={mockApartment} />);

    // Selected image should persist
    expect(mainImage).toHaveAttribute('src', '/img3.jpg');
  });

  it('handles missing optional data gracefully', () => {
    const minimalApartment = createMockApartment({
      id: 'apt-2',
      title: 'Studio Apartment',
      price: 80000,
      size: 25,
      layout: null,
      images: [],
      nearestStation: null,
      commuteInfo: null,
    });

    render(<ApartmentCard apartment={minimalApartment} showScore showActions />);

    // Should still render without errors
    expect(screen.getByText('Studio Apartment')).toBeInTheDocument();
    expect(screen.getByText('¥80,000')).toBeInTheDocument();
    expect(screen.getByText('25㎡')).toBeInTheDocument();
    
    // No station info shown
    expect(screen.queryByText(/min walk/)).not.toBeInTheDocument();
    
    // No images shown
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});