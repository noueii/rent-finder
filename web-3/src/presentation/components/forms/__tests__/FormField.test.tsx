import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { FormField, FormError } from '../FormField';
import { Mail } from 'lucide-react';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Label component
jest.mock('~/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: any) => (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  ),
}));

describe('FormField', () => {
  it('renders children', () => {
    render(
      <FormField>
        <input type="text" data-testid="input" />
      </FormField>
    );

    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(
      <FormField label="Email Address" htmlFor="email">
        <input type="email" id="email" />
      </FormField>
    );

    const label = screen.getByText('Email Address');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'email');
  });

  it('renders required asterisk', () => {
    render(
      <FormField label="Username" required>
        <input type="text" />
      </FormField>
    );

    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveClass('text-destructive');
  });

  it('renders icon with label', () => {
    render(
      <FormField label="Email" icon={Mail}>
        <input type="email" />
      </FormField>
    );

    const label = screen.getByText('Email').parentElement;
    expect(label?.querySelector('svg')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(
      <FormField error="This field is required">
        <input type="text" />
      </FormField>
    );

    const error = screen.getByRole('alert');
    expect(error).toBeInTheDocument();
    expect(error).toHaveTextContent('This field is required');
    expect(error).toHaveClass('text-destructive');
  });

  it('applies error styling to label when error present', () => {
    render(
      <FormField label="Email" error="Invalid email">
        <input type="email" />
      </FormField>
    );

    const label = screen.getByText('Email').parentElement;
    expect(label).toHaveClass('text-destructive');
  });

  it('renders description when no error', () => {
    render(
      <FormField description="Enter your email address">
        <input type="email" />
      </FormField>
    );

    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address')).toHaveClass('text-muted-foreground');
  });

  it('shows error instead of description when both provided', () => {
    render(
      <FormField
        error="Invalid input"
        description="This should not be shown"
      >
        <input type="text" />
      </FormField>
    );

    expect(screen.getByText('Invalid input')).toBeInTheDocument();
    expect(screen.queryByText('This should not be shown')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <FormField className="custom-field">
        <input type="text" />
      </FormField>
    );

    expect(screen.getByRole('textbox').parentElement).toHaveClass('custom-field');
  });

  it('renders all elements in correct order', () => {
    const { container } = render(
      <FormField
        label="Test Field"
        error="Error message"
        required
        icon={Mail}
      >
        <input type="text" />
      </FormField>
    );

    const elements = container.firstChild?.childNodes;
    expect(elements).toHaveLength(3); // label, input, error
    
    // Check order
    expect(elements?.[0]).toContainElement(screen.getByText('Test Field'));
    expect(elements?.[1]).toBe(screen.getByRole('textbox'));
    expect(elements?.[2]).toBe(screen.getByRole('alert'));
  });

  it('maintains space-y-2 spacing class', () => {
    render(
      <FormField>
        <input type="text" />
      </FormField>
    );

    expect(screen.getByRole('textbox').parentElement).toHaveClass('space-y-2');
  });
});

describe('FormError', () => {
  it('renders error message', () => {
    render(<FormError error="Test error" />);
    
    const error = screen.getByRole('alert');
    expect(error).toBeInTheDocument();
    expect(error).toHaveTextContent('Test error');
  });

  it('applies default styles', () => {
    render(<FormError error="Test error" />);
    
    const error = screen.getByRole('alert');
    expect(error).toHaveClass('text-sm', 'text-destructive');
  });

  it('applies custom className', () => {
    render(<FormError error="Test error" className="custom-error" />);
    
    const error = screen.getByRole('alert');
    expect(error).toHaveClass('custom-error');
    // Should still have default classes
    expect(error).toHaveClass('text-sm', 'text-destructive');
  });

  it('has motion animation props', () => {
    render(<FormError error="Test error" />);
    
    const error = screen.getByRole('alert');
    expect(error).toHaveAttribute('initial');
    expect(error).toHaveAttribute('animate');
    expect(error).toHaveAttribute('exit');
  });
});