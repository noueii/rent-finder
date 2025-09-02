import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Form } from '../Form';
import { Settings } from 'lucide-react';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock Card components
jest.mock('~/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 className={className} data-testid="card-title">{children}</h3>
  ),
  CardDescription: ({ children }: any) => (
    <p data-testid="card-description">{children}</p>
  ),
  CardContent: ({ children }: any) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

describe('Form', () => {
  const mockOnSubmit = jest.fn((e) => e.preventDefault());

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with card wrapper by default', () => {
    render(
      <Form onSubmit={mockOnSubmit}>
        <input name="test" />
      </Form>
    );

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders form without card when card=false', () => {
    render(
      <Form onSubmit={mockOnSubmit} card={false}>
        <input name="test" />
      </Form>
    );

    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('handles form submission', () => {
    render(
      <Form onSubmit={mockOnSubmit}>
        <button type="submit">Submit</button>
      </Form>
    );

    fireEvent.submit(screen.getByRole('button'));
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders title and description', () => {
    render(
      <Form
        onSubmit={mockOnSubmit}
        title="Test Form"
        description="This is a test form"
      >
        <input name="test" />
      </Form>
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Test Form');
    expect(screen.getByTestId('card-description')).toHaveTextContent('This is a test form');
  });

  it('renders icon with title', () => {
    render(
      <Form
        onSubmit={mockOnSubmit}
        title="Settings"
        icon={Settings}
      >
        <input name="test" />
      </Form>
    );

    const title = screen.getByTestId('card-title');
    expect(title).toHaveTextContent('Settings');
    expect(title.querySelector('svg')).toBeInTheDocument();
  });

  it('renders custom header', () => {
    const customHeader = <div data-testid="custom-header">Custom Header</div>;
    
    render(
      <Form
        onSubmit={mockOnSubmit}
        header={customHeader}
      >
        <input name="test" />
      </Form>
    );

    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
    expect(screen.queryByTestId('card-title')).not.toBeInTheDocument();
  });

  it('renders footer', () => {
    const footer = <div data-testid="form-footer">Footer Content</div>;
    
    render(
      <Form
        onSubmit={mockOnSubmit}
        footer={footer}
      >
        <input name="test" />
      </Form>
    );

    expect(screen.getByTestId('form-footer')).toBeInTheDocument();
  });

  it('does not render header when no header props provided', () => {
    render(
      <Form onSubmit={mockOnSubmit}>
        <input name="test" />
      </Form>
    );

    expect(screen.queryByTestId('card-header')).not.toBeInTheDocument();
  });

  it('applies custom className to card', () => {
    render(
      <Form onSubmit={mockOnSubmit} className="custom-form">
        <input name="test" />
      </Form>
    );

    expect(screen.getByTestId('card')).toHaveClass('custom-form');
  });

  it('applies custom className to form when card=false', () => {
    const { container } = render(
      <Form onSubmit={mockOnSubmit} card={false} className="custom-form">
        <input name="test" />
      </Form>
    );

    expect(container.querySelector('form')).toHaveClass('custom-form');
  });

  it('renders with animation by default', () => {
    const { container } = render(
      <Form onSubmit={mockOnSubmit}>
        <input name="test" />
      </Form>
    );

    // Check that motion div wrapper exists
    const motionDiv = container.firstChild;
    expect(motionDiv).toHaveAttribute('initial');
    expect(motionDiv).toHaveAttribute('animate');
  });

  it('renders without animation when animate=false', () => {
    const { container } = render(
      <Form onSubmit={mockOnSubmit} animate={false}>
        <input name="test" />
      </Form>
    );

    // Motion div should not have animation attributes
    const firstChild = container.firstChild;
    expect(firstChild).not.toHaveAttribute('initial');
    expect(firstChild).not.toHaveAttribute('animate');
  });

  it('maintains form structure with multiple children', () => {
    render(
      <Form onSubmit={mockOnSubmit}>
        <input name="field1" />
        <input name="field2" />
        <button type="submit">Submit</button>
      </Form>
    );

    const form = screen.getByRole('form');
    expect(form).toHaveClass('space-y-6');
    expect(form.children).toHaveLength(3);
  });
});