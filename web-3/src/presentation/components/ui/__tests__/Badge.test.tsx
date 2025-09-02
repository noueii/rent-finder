import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge, ColorBadge } from '../Badge';

describe('Badge', () => {
  it('renders with default variant and size', () => {
    render(<Badge>Test Badge</Badge>);
    const badge = screen.getByText('Test Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="secondary">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('bg-secondary', 'text-secondary-foreground');

    rerender(<Badge variant="destructive">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('bg-destructive', 'text-destructive-foreground');

    rerender(<Badge variant="outline">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('text-foreground');

    rerender(<Badge variant="success">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(<Badge variant="warning">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('bg-yellow-100', 'text-yellow-800');

    rerender(<Badge variant="info">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Badge size="sm">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('px-2', 'py-0.5', 'text-xs');

    rerender(<Badge size="md">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('px-2.5', 'py-0.5', 'text-xs');

    rerender(<Badge size="lg">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('px-3', 'py-1', 'text-sm');
  });

  it('renders with removable functionality', () => {
    const onRemove = jest.fn();
    render(
      <Badge removable onRemove={onRemove}>
        Removable Badge
      </Badge>
    );

    const badge = screen.getByText('Removable Badge');
    expect(badge).toBeInTheDocument();

    const removeButton = screen.getByLabelText('Remove');
    expect(removeButton).toBeInTheDocument();

    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('stops propagation when remove button is clicked', () => {
    const onRemove = jest.fn();
    const onClick = jest.fn();
    
    render(
      <div onClick={onClick}>
        <Badge removable onRemove={onRemove}>
          Removable Badge
        </Badge>
      </div>
    );

    const removeButton = screen.getByLabelText('Remove');
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not render remove button when removable is false', () => {
    render(<Badge>Non-removable Badge</Badge>);
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<Badge className="custom-badge">Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass('custom-badge');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Badge ref={ref}>Badge</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('ColorBadge', () => {
  it('renders with correct color classes', () => {
    const { rerender } = render(<ColorBadge color="green">Green</ColorBadge>);
    const badge = screen.getByText('Green');
    expect(badge).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200');

    rerender(<ColorBadge color="yellow">Yellow</ColorBadge>);
    expect(screen.getByText('Yellow')).toHaveClass('text-yellow-600', 'bg-yellow-50', 'border-yellow-200');

    rerender(<ColorBadge color="orange">Orange</ColorBadge>);
    expect(screen.getByText('Orange')).toHaveClass('text-orange-600', 'bg-orange-50', 'border-orange-200');

    rerender(<ColorBadge color="red">Red</ColorBadge>);
    expect(screen.getByText('Red')).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200');

    rerender(<ColorBadge color="blue">Blue</ColorBadge>);
    expect(screen.getByText('Blue')).toHaveClass('text-blue-600', 'bg-blue-50', 'border-blue-200');
  });

  it('uses outline variant by default', () => {
    render(<ColorBadge color="green">Badge</ColorBadge>);
    expect(screen.getByText('Badge')).toHaveClass('text-foreground', 'border');
  });

  it('accepts custom variant', () => {
    render(<ColorBadge color="green" variant="default">Badge</ColorBadge>);
    expect(screen.getByText('Badge')).toHaveClass('bg-primary');
  });

  it('inherits Badge functionality', () => {
    const onRemove = jest.fn();
    render(
      <ColorBadge color="red" removable onRemove={onRemove}>
        Removable
      </ColorBadge>
    );

    const removeButton = screen.getByLabelText('Remove');
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('accepts custom className', () => {
    render(<ColorBadge color="blue" className="custom-color-badge">Badge</ColorBadge>);
    expect(screen.getByText('Badge')).toHaveClass('custom-color-badge');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ColorBadge ref={ref} color="green">Badge</ColorBadge>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});