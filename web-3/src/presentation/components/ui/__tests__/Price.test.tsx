import React from 'react';
import { render, screen } from '@testing-library/react';
import { Price, PriceBreakdown, CostCalculator } from '../Price';

describe('Price', () => {
  describe('Default variant', () => {
    it('renders with default props', () => {
      render(<Price value={100000} />);
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Price value={100000} label="Monthly Rent" />);
      expect(screen.getByText('Monthly Rent:')).toBeInTheDocument();
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
    });

    it('renders with suffix', () => {
      render(<Price value={100000} suffix="/mo" />);
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
      expect(screen.getByText('/mo')).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
      const { rerender } = render(<Price value={100000} size="sm" />);
      expect(screen.getByText('¥100,000').parentElement).toHaveClass('text-sm');

      rerender(<Price value={100000} size="md" />);
      expect(screen.getByText('¥100,000').parentElement).toHaveClass('text-base');

      rerender(<Price value={100000} size="lg" />);
      expect(screen.getByText('¥100,000').parentElement).toHaveClass('text-lg');
    });

    it('renders with different currency and locale', () => {
      render(<Price value={1000} currency="USD" locale="en-US" />);
      expect(screen.getByText('$1,000')).toBeInTheDocument();
    });
  });

  describe('Badge variant', () => {
    it('renders as badge', () => {
      render(<Price value={100000} variant="badge" />);
      const price = screen.getByText('¥100,000');
      expect(price.parentElement).toHaveClass('inline-flex', 'items-center', 'rounded-full');
    });

    it('renders badge with label and suffix', () => {
      render(<Price value={100000} variant="badge" label="Rent" suffix="/mo" />);
      expect(screen.getByText('Rent:')).toBeInTheDocument();
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
      expect(screen.getByText('/mo')).toBeInTheDocument();
    });
  });

  describe('Compact variant', () => {
    it('renders compact style', () => {
      render(<Price value={100000} variant="compact" />);
      const price = screen.getByText('¥100,000');
      expect(price).toHaveClass('font-semibold');
    });

    it('renders compact with suffix', () => {
      render(<Price value={100000} variant="compact" suffix="/mo" />);
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
      expect(screen.getByText('/mo')).toHaveClass('font-normal');
    });
  });

  describe('Detailed variant', () => {
    it('renders detailed layout', () => {
      render(<Price value={100000} variant="detailed" label="Monthly Rent" />);
      expect(screen.getByText('Monthly Rent')).toHaveClass('text-xs', 'text-muted-foreground');
      expect(screen.getByText('¥100,000')).toHaveClass('font-semibold');
    });

    it('shows trend with previous value', () => {
      render(
        <Price
          value={110000}
          previousValue={100000}
          variant="detailed"
          showTrend
        />
      );
      expect(screen.getByText('¥110,000')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('shows downward trend', () => {
      render(
        <Price
          value={90000}
          previousValue={100000}
          variant="detailed"
          showTrend
        />
      );
      expect(screen.getByText('¥90,000')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('shows no trend when values are equal', () => {
      render(
        <Price
          value={100000}
          previousValue={100000}
          variant="detailed"
          showTrend
        />
      );
      expect(screen.getByText('¥100,000')).toBeInTheDocument();
      expect(screen.queryByText('%')).not.toBeInTheDocument();
    });
  });

  it('accepts custom className', () => {
    render(<Price value={100000} className="custom-price" />);
    expect(screen.getByText('¥100,000').parentElement).toHaveClass('custom-price');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Price ref={ref} value={100000} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('PriceBreakdown', () => {
  const mockItems = [
    { label: 'Base Rent', value: 100000 },
    { label: 'Management Fee', value: 5000 },
    { label: 'Internet', value: 3000, highlight: true },
  ];

  const mockTotal = {
    label: 'Total Monthly',
    value: 108000,
  };

  it('renders all items', () => {
    render(<PriceBreakdown items={mockItems} />);
    
    expect(screen.getByText('Base Rent')).toBeInTheDocument();
    expect(screen.getByText('¥100,000')).toBeInTheDocument();
    
    expect(screen.getByText('Management Fee')).toBeInTheDocument();
    expect(screen.getByText('¥5,000')).toBeInTheDocument();
    
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText('¥3,000')).toBeInTheDocument();
  });

  it('highlights specified items', () => {
    render(<PriceBreakdown items={mockItems} />);
    
    const internetLabel = screen.getByText('Internet');
    expect(internetLabel.parentElement).toHaveClass('font-semibold');
    
    const baseRentLabel = screen.getByText('Base Rent');
    expect(baseRentLabel).toHaveClass('text-muted-foreground');
  });

  it('renders total section', () => {
    render(<PriceBreakdown items={mockItems} total={mockTotal} />);
    
    expect(screen.getByText('Total Monthly')).toBeInTheDocument();
    expect(screen.getByText('¥108,000')).toBeInTheDocument();
    
    const totalSection = screen.getByText('Total Monthly').parentElement;
    expect(totalSection).toHaveClass('border-t');
  });

  it('uses custom currency and locale', () => {
    render(
      <PriceBreakdown
        items={[{ label: 'Rent', value: 1000 }]}
        currency="USD"
        locale="en-US"
      />
    );
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<PriceBreakdown items={mockItems} className="custom-breakdown" />);
    expect(screen.getByText('Base Rent').parentElement?.parentElement).toHaveClass('custom-breakdown');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<PriceBreakdown ref={ref} items={mockItems} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CostCalculator', () => {
  it('calculates average monthly cost correctly', () => {
    render(
      <CostCalculator
        monthlyRent={100000}
        initialCosts={{
          deposit: 200000,
          keyMoney: 100000,
          agencyFee: 100000,
        }}
        period={24}
      />
    );

    // Total initial: 400,000
    // Total rent: 100,000 * 24 = 2,400,000
    // Total: 2,800,000
    // Monthly average: 2,800,000 / 24 = 116,667
    expect(screen.getByText('24-month avg:')).toBeInTheDocument();
    expect(screen.getByText('¥116,667')).toBeInTheDocument();
    expect(screen.getByText('¥2,800,000')).toBeInTheDocument();
  });

  it('handles missing initial costs', () => {
    render(
      <CostCalculator
        monthlyRent={100000}
        period={12}
      />
    );

    // Only monthly rent: 100,000 * 12 = 1,200,000
    expect(screen.getByText('¥100,000')).toBeInTheDocument();
    expect(screen.getByText('¥1,200,000')).toBeInTheDocument();
  });

  it('uses custom period', () => {
    render(
      <CostCalculator
        monthlyRent={100000}
        period={6}
      />
    );

    expect(screen.getByText('6-month avg:')).toBeInTheDocument();
  });

  it('uses custom currency and locale', () => {
    render(
      <CostCalculator
        monthlyRent={1000}
        period={12}
        currency="USD"
        locale="en-US"
      />
    );

    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(
      <CostCalculator
        monthlyRent={100000}
        className="custom-calculator"
      />
    );
    
    const calculator = screen.getByText('24-month avg:').parentElement?.parentElement;
    expect(calculator).toHaveClass('custom-calculator');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<CostCalculator ref={ref} monthlyRent={100000} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});