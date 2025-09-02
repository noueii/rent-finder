import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../Card';

describe('Card', () => {
  it('renders with default variant and padding', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('bg-card', 'text-card-foreground', 'shadow-sm', 'p-4');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Card data-testid="card" variant="elevated">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('shadow-md', 'hover:shadow-lg');

    rerender(<Card data-testid="card" variant="ghost">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('border-transparent', 'hover:bg-accent');

    rerender(<Card data-testid="card" variant="outlined">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('bg-transparent', 'border-border');
  });

  it('renders with different padding sizes', () => {
    const { rerender } = render(<Card data-testid="card" padding="none">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('p-0');

    rerender(<Card data-testid="card" padding="sm">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('p-2');

    rerender(<Card data-testid="card" padding="lg">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('p-6');
  });

  it('accepts custom className', () => {
    render(<Card data-testid="card" className="custom-class">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Card ref={ref}>Content</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardHeader', () => {
  it('renders with default padding', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('p-6', 'pb-4');
  });

  it('renders without padding when noPadding is true', () => {
    render(<CardHeader data-testid="header" noPadding>Header</CardHeader>);
    const header = screen.getByTestId('header');
    expect(header).not.toHaveClass('p-6', 'pb-4');
  });

  it('accepts custom className', () => {
    render(<CardHeader data-testid="header" className="custom-header">Header</CardHeader>);
    expect(screen.getByTestId('header')).toHaveClass('custom-header');
  });
});

describe('CardTitle', () => {
  it('renders as h3 by default', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('H3');
    expect(title).toHaveClass('text-lg', 'font-semibold');
  });

  it('renders with different heading levels', () => {
    const { rerender } = render(<CardTitle as="h1">Title</CardTitle>);
    expect(screen.getByText('Title').tagName).toBe('H1');

    rerender(<CardTitle as="h2">Title</CardTitle>);
    expect(screen.getByText('Title').tagName).toBe('H2');

    rerender(<CardTitle as="h4">Title</CardTitle>);
    expect(screen.getByText('Title').tagName).toBe('H4');
  });

  it('accepts custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);
    expect(screen.getByText('Title')).toHaveClass('custom-title');
  });
});

describe('CardDescription', () => {
  it('renders with correct styles', () => {
    render(<CardDescription>Description</CardDescription>);
    const description = screen.getByText('Description');
    expect(description).toBeInTheDocument();
    expect(description.tagName).toBe('P');
    expect(description).toHaveClass('text-sm', 'text-muted-foreground');
  });

  it('accepts custom className', () => {
    render(<CardDescription className="custom-desc">Description</CardDescription>);
    expect(screen.getByText('Description')).toHaveClass('custom-desc');
  });
});

describe('CardContent', () => {
  it('renders with default padding', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    const content = screen.getByTestId('content');
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass('p-6', 'pt-0');
  });

  it('renders without padding when noPadding is true', () => {
    render(<CardContent data-testid="content" noPadding>Content</CardContent>);
    const content = screen.getByTestId('content');
    expect(content).not.toHaveClass('p-6', 'pt-0');
  });
});

describe('CardFooter', () => {
  it('renders with default padding and flex styles', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0');
  });

  it('renders without padding when noPadding is true', () => {
    render(<CardFooter data-testid="footer" noPadding>Footer</CardFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer).not.toHaveClass('p-6', 'pt-0');
  });
});

describe('Card composition', () => {
  it('renders a complete card with all subcomponents', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card content goes here</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Card content goes here')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});