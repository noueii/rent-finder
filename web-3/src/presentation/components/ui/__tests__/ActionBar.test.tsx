import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar, QuickAction } from '../ActionBar';
import { Heart, Share2, Bookmark, Trash } from 'lucide-react';
import type { ActionItem } from '../ActionBar';

// Mock button component
jest.mock('~/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, title, className, variant = 'default', size = 'default', ...props }: any) => (
    <button onClick={onClick} disabled={disabled} title={title} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

describe('ActionBar', () => {
  const mockActions: ActionItem[] = [
    {
      id: 'save',
      label: 'Save',
      icon: Bookmark,
      onClick: jest.fn(),
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      onClick: jest.fn(),
      tooltip: 'Share this item',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash,
      onClick: jest.fn(),
      variant: 'destructive',
      disabled: true,
    },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Default variant', () => {
    it('renders all actions with labels', () => {
      render(<ActionBar actions={mockActions} />);
      
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('handles click events', () => {
      render(<ActionBar actions={mockActions} />);
      
      fireEvent.click(screen.getByText('Save'));
      expect(mockActions[0].onClick).toHaveBeenCalledTimes(1);
      
      fireEvent.click(screen.getByText('Share'));
      expect(mockActions[1].onClick).toHaveBeenCalledTimes(1);
    });

    it('disables buttons when specified', () => {
      render(<ActionBar actions={mockActions} />);
      
      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toBeDisabled();
      
      fireEvent.click(deleteButton);
      expect(mockActions[2].onClick).not.toHaveBeenCalled();
    });

    it('shows tooltips when provided', () => {
      render(<ActionBar actions={mockActions} />);
      
      const shareButton = screen.getByText('Share');
      expect(shareButton).toHaveAttribute('title', 'Share this item');
    });

    it('applies correct button variants', () => {
      render(<ActionBar actions={mockActions} />);
      
      expect(screen.getByText('Save')).toHaveAttribute('data-variant', 'outline');
      expect(screen.getByText('Delete')).toHaveAttribute('data-variant', 'destructive');
    });

    it('renders different sizes', () => {
      const { rerender } = render(<ActionBar actions={mockActions} size="sm" />);
      expect(screen.getByText('Save')).toHaveAttribute('data-size', 'sm');

      rerender(<ActionBar actions={mockActions} size="md" />);
      expect(screen.getByText('Save')).toHaveAttribute('data-size', 'default');

      rerender(<ActionBar actions={mockActions} size="lg" />);
      expect(screen.getByText('Save')).toHaveAttribute('data-size', 'lg');
    });

    it('applies different alignments', () => {
      const { rerender, container } = render(<ActionBar actions={mockActions} align="start" />);
      expect(container.firstChild).toHaveClass('justify-start');

      rerender(<ActionBar actions={mockActions} align="center" />);
      expect(container.firstChild).toHaveClass('justify-center');

      rerender(<ActionBar actions={mockActions} align="end" />);
      expect(container.firstChild).toHaveClass('justify-end');

      rerender(<ActionBar actions={mockActions} align="between" />);
      expect(container.firstChild).toHaveClass('justify-between');
    });

    it('supports vertical orientation', () => {
      render(<ActionBar actions={mockActions} orientation="vertical" />);
      expect(screen.getByText('Save').parentElement?.parentElement).toHaveClass('flex-col');
    });
  });

  describe('Compact variant', () => {
    it('renders icon-only buttons', () => {
      render(<ActionBar actions={mockActions} variant="compact" />);
      
      // Labels should not be visible
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByText('Share')).not.toBeInTheDocument();
      
      // But buttons should have title attributes
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('title', 'Save');
      expect(buttons[1]).toHaveAttribute('title', 'Share this item');
    });

    it('handles loading state', () => {
      const loadingActions = [
        { ...mockActions[0], loading: true },
      ];
      
      render(<ActionBar actions={loadingActions} variant="compact" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('applies size classes to icon buttons', () => {
      const { rerender, container } = render(<ActionBar actions={mockActions} variant="compact" size="sm" />);
      expect(container.querySelector('button')).toHaveClass('h-8', 'w-8');

      rerender(<ActionBar actions={mockActions} variant="compact" size="md" />);
      expect(container.querySelector('button')).toHaveClass('h-9', 'w-9');

      rerender(<ActionBar actions={mockActions} variant="compact" size="lg" />);
      expect(container.querySelector('button')).toHaveClass('h-10', 'w-10');
    });
  });

  describe('Floating variant', () => {
    it('renders with floating styles', () => {
      render(<ActionBar actions={mockActions} variant="floating" />);
      
      const container = screen.getAllByRole('button')[0].parentElement;
      expect(container).toHaveClass('backdrop-blur-sm', 'bg-background/80', 'rounded-full', 'shadow-lg');
    });

    it('renders round buttons', () => {
      render(<ActionBar actions={mockActions} variant="floating" />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('rounded-full');
      });
    });
  });

  describe('Inline variant', () => {
    it('renders as text links with separators', () => {
      render(<ActionBar actions={mockActions} variant="inline" />);
      
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      
      // Check for separators
      const separators = screen.getAllByText('•');
      expect(separators).toHaveLength(2); // Between 3 items
    });

    it('handles destructive variant styling', () => {
      render(<ActionBar actions={mockActions} variant="inline" />);
      
      const deleteButton = screen.getByText('Delete').parentElement;
      expect(deleteButton).toHaveClass('text-destructive');
    });

    it('does not show separators in vertical orientation', () => {
      render(<ActionBar actions={mockActions} variant="inline" orientation="vertical" />);
      
      expect(screen.queryByText('•')).not.toBeInTheDocument();
    });

    it('applies disabled styling', () => {
      render(<ActionBar actions={mockActions} variant="inline" />);
      
      const deleteButton = screen.getByText('Delete').parentElement;
      expect(deleteButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  it('accepts custom className', () => {
    render(<ActionBar actions={mockActions} className="custom-actions" />);
    expect(screen.getByText('Save').parentElement?.parentElement).toHaveClass('custom-actions');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ActionBar ref={ref} actions={mockActions} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('QuickAction', () => {
  it('renders with icon', () => {
    const onClick = jest.fn();
    render(<QuickAction icon={Heart} onClick={onClick} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows label as tooltip', () => {
    render(<QuickAction icon={Heart} label="Add to favorites" onClick={jest.fn()} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Add to favorites');
  });

  it('shows active state', () => {
    render(<QuickAction icon={Heart} onClick={jest.fn()} active />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-accent', 'text-accent-foreground');
  });

  it('displays badge', () => {
    render(<QuickAction icon={Heart} onClick={jest.fn()} badge={5} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('5')).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('applies different variants', () => {
    const { rerender } = render(<QuickAction icon={Heart} onClick={jest.fn()} variant="primary" />);
    expect(screen.getByRole('button')).toHaveClass('text-primary');

    rerender(<QuickAction icon={Heart} onClick={jest.fn()} variant="destructive" />);
    expect(screen.getByRole('button')).toHaveClass('text-destructive');
  });

  it('applies different sizes', () => {
    const { rerender } = render(<QuickAction icon={Heart} onClick={jest.fn()} size="sm" />);
    expect(screen.getByRole('button')).toHaveClass('h-8', 'w-8');

    rerender(<QuickAction icon={Heart} onClick={jest.fn()} size="md" />);
    expect(screen.getByRole('button')).toHaveClass('h-10', 'w-10');

    rerender(<QuickAction icon={Heart} onClick={jest.fn()} size="lg" />);
    expect(screen.getByRole('button')).toHaveClass('h-12', 'w-12');
  });

  it('accepts custom className', () => {
    render(<QuickAction icon={Heart} onClick={jest.fn()} className="custom-quick" />);
    expect(screen.getByRole('button')).toHaveClass('custom-quick');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<QuickAction ref={ref} icon={Heart} onClick={jest.fn()} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});