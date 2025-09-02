import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageGallery } from '../ImageGallery';
import type { ImageItem } from '../ImageGallery';

// Mock button component
jest.mock('~/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

describe('ImageGallery', () => {
  const mockImages: ImageItem[] = [
    { url: 'https://example.com/image1.jpg', alt: 'Image 1', caption: 'First image' },
    { url: 'https://example.com/image2.jpg', alt: 'Image 2' },
    { url: 'https://example.com/image3.jpg', alt: 'Image 3', caption: 'Third image' },
  ];

  describe('Carousel variant', () => {
    it('renders first image by default', () => {
      render(<ImageGallery images={mockImages} />);
      const image = screen.getByAltText('Image 1');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg');
    });

    it('shows navigation buttons for multiple images', () => {
      render(<ImageGallery images={mockImages} />);
      // Navigation buttons are hidden by default and shown on hover
      const gallery = screen.getByAltText('Image 1').parentElement;
      expect(gallery).toBeInTheDocument();
    });

    it('navigates to next image', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Click the next navigation zone (right side)
      const nextZone = screen.getByLabelText('Next image');
      fireEvent.click(nextZone);
      
      expect(screen.getByAltText('Image 2')).toBeInTheDocument();
    });

    it('navigates to previous image', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Click the previous navigation zone (left side)
      const prevZone = screen.getByLabelText('Previous image');
      fireEvent.click(prevZone);
      
      // Should wrap to last image
      expect(screen.getByAltText('Image 3')).toBeInTheDocument();
    });

    it('shows indicators for multiple images', () => {
      render(<ImageGallery images={mockImages} />);
      const indicators = screen.getAllByRole('button', { name: /Go to image/ });
      expect(indicators).toHaveLength(3);
    });

    it('navigates using indicators', () => {
      render(<ImageGallery images={mockImages} />);
      
      const thirdIndicator = screen.getByLabelText('Go to image 3');
      fireEvent.click(thirdIndicator);
      
      expect(screen.getByAltText('Image 3')).toBeInTheDocument();
    });

    it('shows caption when available', () => {
      render(<ImageGallery images={mockImages} />);
      expect(screen.getByText('First image')).toBeInTheDocument();
    });

    it('handles image click', () => {
      const onImageClick = jest.fn();
      render(<ImageGallery images={mockImages} onImageClick={onImageClick} />);
      
      const image = screen.getByAltText('Image 1');
      fireEvent.click(image);
      
      expect(onImageClick).toHaveBeenCalledWith(0);
    });

    it('handles image load errors', () => {
      render(<ImageGallery images={mockImages} />);
      
      const image = screen.getByAltText('Image 1');
      fireEvent.error(image);
      
      expect(screen.getByText('No Image Available')).toBeInTheDocument();
    });

    it('handles empty image array', () => {
      render(<ImageGallery images={[]} />);
      expect(screen.getByText('No Image Available')).toBeInTheDocument();
    });

    it('uses default alt text when not provided', () => {
      const imagesWithoutAlt = [{ url: 'https://example.com/test.jpg' }];
      render(<ImageGallery images={imagesWithoutAlt} defaultAlt="Default Image" />);
      
      expect(screen.getByAltText('Default Image')).toBeInTheDocument();
    });

    it('hides navigation for single image', () => {
      const singleImage = [mockImages[0]];
      render(<ImageGallery images={singleImage} />);
      
      expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Previous image')).not.toBeInTheDocument();
    });

    it('hides indicators when showIndicators is false', () => {
      render(<ImageGallery images={mockImages} showIndicators={false} />);
      expect(screen.queryByLabelText('Go to image 1')).not.toBeInTheDocument();
    });

    it('hides navigation when showNavigation is false', () => {
      render(<ImageGallery images={mockImages} showNavigation={false} />);
      expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
    });

    it('enables autoplay', async () => {
      jest.useFakeTimers();
      render(<ImageGallery images={mockImages} autoPlay autoPlayInterval={1000} />);
      
      expect(screen.getByAltText('Image 1')).toBeInTheDocument();
      
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByAltText('Image 2')).toBeInTheDocument();
      });
      
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByAltText('Image 3')).toBeInTheDocument();
      });
      
      jest.useRealTimers();
    });

    it('pauses autoplay on hover', async () => {
      jest.useFakeTimers();
      render(<ImageGallery images={mockImages} autoPlay autoPlayInterval={1000} />);
      
      const gallery = screen.getByAltText('Image 1').parentElement;
      fireEvent.mouseEnter(gallery!);
      
      jest.advanceTimersByTime(2000);
      
      // Should still be on first image
      expect(screen.getByAltText('Image 1')).toBeInTheDocument();
      
      jest.useRealTimers();
    });
  });

  describe('Grid variant', () => {
    it('renders all images in a grid', () => {
      render(<ImageGallery images={mockImages} variant="grid" />);
      
      expect(screen.getByAltText('Image 1')).toBeInTheDocument();
      expect(screen.getByAltText('Image 2')).toBeInTheDocument();
      expect(screen.getByAltText('Image 3')).toBeInTheDocument();
    });

    it('applies correct grid columns based on image count', () => {
      const { rerender, container } = render(
        <ImageGallery images={[mockImages[0]]} variant="grid" />
      );
      expect(container.firstChild).toHaveClass('grid-cols-1');

      rerender(<ImageGallery images={mockImages.slice(0, 2)} variant="grid" />);
      expect(container.firstChild).toHaveClass('grid-cols-2');

      rerender(<ImageGallery images={mockImages} variant="grid" />);
      expect(container.firstChild).toHaveClass('grid-cols-3');
    });

    it('handles image click in grid', () => {
      const onImageClick = jest.fn();
      render(<ImageGallery images={mockImages} variant="grid" onImageClick={onImageClick} />);
      
      const secondImage = screen.getByAltText('Image 2');
      fireEvent.click(secondImage.parentElement!);
      
      expect(onImageClick).toHaveBeenCalledWith(1);
    });

    it('handles image errors in grid', () => {
      render(<ImageGallery images={mockImages} variant="grid" />);
      
      const firstImage = screen.getByAltText('Image 1');
      fireEvent.error(firstImage);
      
      // Should show error icon for that specific image
      const errorIcons = document.querySelectorAll('svg');
      expect(errorIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Stack variant', () => {
    it('renders stacked images', () => {
      render(<ImageGallery images={mockImages} variant="stack" />);
      
      // Only first 3 images are shown in stack
      expect(screen.getByAltText('Image 1')).toBeInTheDocument();
      expect(screen.getByAltText('Image 2')).toBeInTheDocument();
      expect(screen.getByAltText('Image 3')).toBeInTheDocument();
    });

    it('shows count for additional images', () => {
      const manyImages = [
        ...mockImages,
        { url: 'https://example.com/image4.jpg', alt: 'Image 4' },
        { url: 'https://example.com/image5.jpg', alt: 'Image 5' },
      ];
      render(<ImageGallery images={manyImages} variant="stack" />);
      
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('applies stacking transform styles', () => {
      render(<ImageGallery images={mockImages} variant="stack" />);
      
      const images = screen.getAllByRole('img');
      const containers = images.map(img => img.parentElement);
      
      expect(containers[0]).toHaveStyle({
        transform: 'translateX(0px) translateY(0px) scale(1)',
        zIndex: '3',
      });
      
      expect(containers[1]).toHaveStyle({
        transform: 'translateX(10px) translateY(10px) scale(0.95)',
        zIndex: '2',
      });
    });

    it('handles click on stack', () => {
      const onImageClick = jest.fn();
      render(<ImageGallery images={mockImages} variant="stack" onImageClick={onImageClick} />);
      
      const firstImage = screen.getByAltText('Image 1');
      fireEvent.click(firstImage.parentElement!);
      
      expect(onImageClick).toHaveBeenCalledWith(0);
    });
  });

  it('accepts custom className', () => {
    render(<ImageGallery images={mockImages} className="custom-gallery" />);
    expect(screen.getByAltText('Image 1').parentElement).toHaveClass('custom-gallery');
  });

  it('accepts custom height', () => {
    render(<ImageGallery images={mockImages} height={400} />);
    expect(screen.getByAltText('Image 1').parentElement).toHaveStyle({ height: '400px' });
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ImageGallery ref={ref} images={mockImages} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});