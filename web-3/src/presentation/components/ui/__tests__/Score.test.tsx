import React from 'react';
import { render, screen } from '@testing-library/react';
import { Score, MatchScore, RatingScore } from '../Score';
import { TrendingUp, Star } from 'lucide-react';

// Mock the dependencies
jest.mock('~/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

jest.mock('~/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

describe('Score', () => {
  describe('Badge variant', () => {
    it('renders with default props', () => {
      render(<Score value={75} />);
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Score value={75} label="Performance" />);
      expect(screen.getByText('Performance: 75%')).toBeInTheDocument();
    });

    it('calculates percentage correctly', () => {
      render(<Score value={40} max={50} />);
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('renders with custom icon', () => {
      render(<Score value={75} icon={Star} />);
      // Icon rendering is part of the Badge component
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
      const { rerender } = render(<Score value={75} size="sm" />);
      expect(screen.getByText('75%').parentElement).toHaveClass('text-xs');

      rerender(<Score value={75} size="md" />);
      expect(screen.getByText('75%').parentElement).toHaveClass('text-sm');

      rerender(<Score value={75} size="lg" />);
      expect(screen.getByText('75%').parentElement).toHaveClass('text-base');
    });

    it('shows popover with details when showDetails is true and children are provided', () => {
      render(
        <Score value={75} showDetails>
          <div>Additional details</div>
        </Score>
      );
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
      expect(screen.getByText('Additional details')).toBeInTheDocument();
    });
  });

  describe('Progress variant', () => {
    it('renders progress bar', () => {
      render(<Score value={60} variant="progress" />);
      const progress = screen.getByTestId('progress');
      expect(progress).toBeInTheDocument();
      expect(progress).toHaveAttribute('data-value', '60');
    });

    it('renders with label', () => {
      render(<Score value={60} variant="progress" label="Loading" />);
      expect(screen.getByText('Loading')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('renders different sizes', () => {
      const { rerender } = render(<Score value={60} variant="progress" size="sm" />);
      expect(screen.getByTestId('progress')).toHaveClass('h-1.5');

      rerender(<Score value={60} variant="progress" size="md" />);
      expect(screen.getByTestId('progress')).toHaveClass('h-2');

      rerender(<Score value={60} variant="progress" size="lg" />);
      expect(screen.getByTestId('progress')).toHaveClass('h-3');
    });

    it('shows children details when showDetails is true', () => {
      render(
        <Score value={60} variant="progress" showDetails>
          <span>Progress details</span>
        </Score>
      );
      expect(screen.getByText('Progress details')).toBeInTheDocument();
    });
  });

  describe('Circular variant', () => {
    it('renders circular progress', () => {
      render(<Score value={75} variant="circular" />);
      expect(screen.getByText('75%')).toBeInTheDocument();
      
      const svgs = document.querySelectorAll('svg');
      expect(svgs).toHaveLength(1);
      
      const circles = document.querySelectorAll('circle');
      expect(circles).toHaveLength(2); // Background and progress circles
    });

    it('renders different sizes', () => {
      const { rerender, container } = render(<Score value={75} variant="circular" size="sm" />);
      let svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '46'); // radius(20) * 2 + strokeWidth(3) * 2

      rerender(<Score value={75} variant="circular" size="md" />);
      svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '68'); // radius(30) * 2 + strokeWidth(4) * 2

      rerender(<Score value={75} variant="circular" size="lg" />);
      svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '90'); // radius(40) * 2 + strokeWidth(5) * 2
    });
  });

  describe('Color scales', () => {
    it('applies default color scale', () => {
      const { rerender } = render(<Score value={85} />);
      expect(screen.getByText('85%').parentElement).toHaveClass('bg-primary'); // success variant

      rerender(<Score value={65} />);
      expect(screen.getByText('65%').parentElement).toHaveClass('bg-primary'); // warning variant

      rerender(<Score value={45} />);
      expect(screen.getByText('45%').parentElement).toHaveClass('bg-primary'); // info variant

      rerender(<Score value={25} />);
      expect(screen.getByText('25%').parentElement).toHaveClass('bg-destructive'); // destructive variant
    });

    it('applies performance color scale', () => {
      render(<Score value={95} colorScale="performance" />);
      expect(screen.getByText('95%').parentElement).toHaveClass('text-foreground'); // outline variant
    });

    it('applies rating color scale', () => {
      render(<Score value={85} colorScale="rating" />);
      expect(screen.getByText('85%').parentElement).toHaveClass('bg-primary');
    });
  });

  it('accepts custom className', () => {
    render(<Score value={75} className="custom-score" />);
    expect(screen.getByText('75%').parentElement).toHaveClass('custom-score');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Score ref={ref} value={75} variant="progress" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('MatchScore', () => {
  it('renders with default apartment type', () => {
    render(<MatchScore value={80} />);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders with different match types', () => {
    const { rerender } = render(<MatchScore value={80} matchType="apartment" />);
    expect(screen.getByText('80%')).toBeInTheDocument();

    rerender(<MatchScore value={80} matchType="location" />);
    expect(screen.getByText('80%')).toBeInTheDocument();

    rerender(<MatchScore value={80} matchType="commute" />);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('uses performance color scale', () => {
    render(<MatchScore value={95} />);
    expect(screen.getByText('95%').parentElement).toHaveClass('text-foreground');
  });

  it('forwards other props', () => {
    render(<MatchScore value={75} label="Match" size="lg" />);
    expect(screen.getByText('Match: 75%')).toBeInTheDocument();
  });
});

describe('RatingScore', () => {
  it('renders with default 5 stars', () => {
    render(<RatingScore value={4} />);
    expect(screen.getByText('80%')).toBeInTheDocument(); // 4/5 = 80%
  });

  it('renders with custom star count', () => {
    render(<RatingScore value={3} stars={10} />);
    expect(screen.getByText('30%')).toBeInTheDocument(); // 3/10 = 30%
  });

  it('uses rating color scale', () => {
    render(<RatingScore value={4.5} stars={5} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('forwards other props', () => {
    render(<RatingScore value={4} label="Rating" variant="progress" />);
    expect(screen.getByText('Rating')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });
});