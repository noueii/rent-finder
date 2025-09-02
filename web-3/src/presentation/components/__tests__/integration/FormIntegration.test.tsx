import React from 'react';
import { render, screen, waitFor, within } from './test-utils';
import userEvent from '@testing-library/user-event';
import { 
  Form, 
  FormField, 
  FormInput, 
  FormSelect, 
  FormSlider, 
  FormTextarea,
  FormSubmit,
  useForm,
} from '~/presentation/components/forms';
import { z } from 'zod';

// Test form schemas
const apartmentSearchSchema = z.object({
  station: z.string().min(1, 'Station is required'),
  maxCommuteTime: z.number().min(5).max(120),
  priceRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }).refine(data => data.max >= data.min, {
    message: 'Max price must be greater than min price',
  }),
  propertyTypes: z.array(z.string()).min(1, 'Select at least one property type'),
  additionalNotes: z.string().optional(),
});

const userProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be at least 18 years old'),
  bio: z.string().max(500, 'Bio must be less than 500 characters'),
  preferences: z.object({
    notifications: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
  }),
});

// Complex form component for testing
function ApartmentSearchForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const form = useForm({
    schema: apartmentSearchSchema,
    defaultValues: {
      station: '',
      maxCommuteTime: 30,
      priceRange: { min: 50000, max: 200000 },
      propertyTypes: [],
      additionalNotes: '',
    },
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField name="station" label="Station" required>
        <FormInput placeholder="Enter station name" />
      </FormField>

      <FormField name="maxCommuteTime" label="Max Commute Time (minutes)">
        <FormSlider min={5} max={120} step={5} />
      </FormField>

      <FormField name="priceRange.min" label="Min Price">
        <FormInput type="number" placeholder="50000" />
      </FormField>

      <FormField name="priceRange.max" label="Max Price">
        <FormInput type="number" placeholder="200000" />
      </FormField>

      <FormField name="propertyTypes" label="Property Types" required>
        <FormSelect 
          multiple
          options={[
            { value: '1R', label: '1R' },
            { value: '1K', label: '1K' },
            { value: '1DK', label: '1DK' },
            { value: '1LDK', label: '1LDK' },
            { value: '2LDK', label: '2LDK' },
            { value: '3LDK', label: '3LDK' },
          ]}
        />
      </FormField>

      <FormField name="additionalNotes" label="Additional Notes">
        <FormTextarea 
          placeholder="Any specific requirements..."
          rows={4}
        />
      </FormField>

      <FormSubmit>Search Apartments</FormSubmit>
    </Form>
  );
}

// User profile form for testing different scenarios
function UserProfileForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const form = useForm({
    schema: userProfileSchema,
    defaultValues: {
      name: '',
      email: '',
      age: 25,
      bio: '',
      preferences: {
        notifications: true,
        theme: 'system' as const,
      },
    },
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField name="name" label="Name" required>
        <FormInput placeholder="John Doe" />
      </FormField>

      <FormField name="email" label="Email" required>
        <FormInput type="email" placeholder="john@example.com" />
      </FormField>

      <FormField name="age" label="Age">
        <FormInput type="number" min={18} max={100} />
      </FormField>

      <FormField name="bio" label="Bio">
        <FormTextarea 
          placeholder="Tell us about yourself..."
          maxLength={500}
        />
      </FormField>

      <FormField name="preferences.notifications" label="Enable Notifications">
        <FormInput type="checkbox" />
      </FormField>

      <FormField name="preferences.theme" label="Theme">
        <FormSelect
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </FormField>

      <FormSubmit>Save Profile</FormSubmit>
    </Form>
  );
}

describe('Form Integration', () => {
  it('handles complex apartment search form with all field types', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    render(<ApartmentSearchForm onSubmit={handleSubmit} />);

    // Fill in the form
    await user.type(screen.getByPlaceholderText('Enter station name'), 'Shibuya');
    
    // Slider interaction (assuming it renders an input)
    const slider = screen.getByRole('slider', { name: /max commute time/i });
    await user.clear(slider);
    await user.type(slider, '45');

    // Price range
    await user.clear(screen.getByPlaceholderText('50000'));
    await user.type(screen.getByPlaceholderText('50000'), '80000');
    
    await user.clear(screen.getByPlaceholderText('200000'));
    await user.type(screen.getByPlaceholderText('200000'), '250000');

    // Multi-select
    const propertySelect = screen.getByRole('combobox', { name: /property types/i });
    await user.click(propertySelect);
    await user.click(screen.getByText('1LDK'));
    await user.click(screen.getByText('2LDK'));
    await user.keyboard('{Escape}'); // Close dropdown

    // Textarea
    await user.type(
      screen.getByPlaceholderText('Any specific requirements...'),
      'Pet-friendly, near parks'
    );

    // Submit
    await user.click(screen.getByRole('button', { name: /search apartments/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        station: 'Shibuya',
        maxCommuteTime: 45,
        priceRange: { min: 80000, max: 250000 },
        propertyTypes: ['1LDK', '2LDK'],
        additionalNotes: 'Pet-friendly, near parks',
      });
    });
  });

  it('validates all fields and shows error messages', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    render(<ApartmentSearchForm onSubmit={handleSubmit} />);

    // Submit without filling required fields
    await user.click(screen.getByRole('button', { name: /search apartments/i }));

    // Check validation errors
    await waitFor(() => {
      expect(screen.getByText('Station is required')).toBeInTheDocument();
      expect(screen.getByText('Select at least one property type')).toBeInTheDocument();
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates nested fields and complex rules', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    render(<ApartmentSearchForm onSubmit={handleSubmit} />);

    // Fill station to avoid that error
    await user.type(screen.getByPlaceholderText('Enter station name'), 'Tokyo');

    // Set invalid price range (max < min)
    await user.clear(screen.getByPlaceholderText('50000'));
    await user.type(screen.getByPlaceholderText('50000'), '300000');
    
    await user.clear(screen.getByPlaceholderText('200000'));
    await user.type(screen.getByPlaceholderText('200000'), '100000');

    // Select property type to avoid that error
    const propertySelect = screen.getByRole('combobox', { name: /property types/i });
    await user.click(propertySelect);
    await user.click(screen.getByText('1LDK'));
    await user.keyboard('{Escape}');

    // Submit
    await user.click(screen.getByRole('button', { name: /search apartments/i }));

    await waitFor(() => {
      expect(screen.getByText('Max price must be greater than min price')).toBeInTheDocument();
    });
  });

  it('handles form state persistence', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    const { rerender } = render(<UserProfileForm onSubmit={handleSubmit} />);

    // Fill in some fields
    await user.type(screen.getByPlaceholderText('John Doe'), 'Jane Smith');
    await user.type(screen.getByPlaceholderText('john@example.com'), 'jane@example.com');

    // Simulate re-render (e.g., parent component update)
    rerender(<UserProfileForm onSubmit={handleSubmit} />);

    // Values should persist
    expect(screen.getByDisplayValue('Jane Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
  });

  it('handles different input types correctly', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    render(<UserProfileForm onSubmit={handleSubmit} />);

    // Text input
    await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');

    // Email input
    await user.type(screen.getByPlaceholderText('john@example.com'), 'test@example.com');

    // Number input
    const ageInput = screen.getByRole('spinbutton', { name: /age/i });
    await user.clear(ageInput);
    await user.type(ageInput, '30');

    // Textarea with character limit
    const bioTextarea = screen.getByPlaceholderText('Tell us about yourself...');
    await user.type(bioTextarea, 'I am a software developer interested in Tokyo apartments.');

    // Checkbox
    const notificationCheckbox = screen.getByRole('checkbox', { name: /enable notifications/i });
    await user.click(notificationCheckbox); // Uncheck (default is checked)

    // Select
    const themeSelect = screen.getByRole('combobox', { name: /theme/i });
    await user.click(themeSelect);
    await user.click(screen.getByText('Dark'));

    // Submit
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        age: 30,
        bio: 'I am a software developer interested in Tokyo apartments.',
        preferences: {
          notifications: false,
          theme: 'dark',
        },
      });
    });
  });

  it('shows field-level validation in real-time', async () => {
    const user = userEvent.setup();
    const handleSubmit = jest.fn();

    render(<UserProfileForm onSubmit={handleSubmit} />);

    // Type invalid email
    const emailInput = screen.getByPlaceholderText('john@example.com');
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Blur to trigger validation

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });

    // Correct the email
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');
    await user.tab();

    await waitFor(() => {
      expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument();
    });
  });

  it('handles form reset functionality', async () => {
    const user = userEvent.setup();
    
    function ResettableForm() {
      const form = useForm({
        defaultValues: {
          name: '',
          email: '',
        },
      });

      return (
        <Form form={form} onSubmit={jest.fn()}>
          <FormField name="name" label="Name">
            <FormInput placeholder="Enter name" />
          </FormField>
          <FormField name="email" label="Email">
            <FormInput placeholder="Enter email" />
          </FormField>
          <button type="button" onClick={() => form.reset()}>
            Reset Form
          </button>
          <FormSubmit>Submit</FormSubmit>
        </Form>
      );
    }

    render(<ResettableForm />);

    // Fill in fields
    await user.type(screen.getByPlaceholderText('Enter name'), 'Test Name');
    await user.type(screen.getByPlaceholderText('Enter email'), 'test@example.com');

    // Reset form
    await user.click(screen.getByRole('button', { name: /reset form/i }));

    // Fields should be cleared
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Enter email')).toHaveValue('');
    });
  });

  it('handles conditional fields', async () => {
    const user = userEvent.setup();
    
    function ConditionalForm() {
      const form = useForm({
        defaultValues: {
          hasVehicle: false,
          vehicleType: '',
          parkingRequired: false,
        },
      });

      const hasVehicle = form.watch('hasVehicle');

      return (
        <Form form={form} onSubmit={jest.fn()}>
          <FormField name="hasVehicle" label="Do you have a vehicle?">
            <FormInput type="checkbox" />
          </FormField>
          
          {hasVehicle && (
            <>
              <FormField name="vehicleType" label="Vehicle Type" required>
                <FormSelect
                  options={[
                    { value: 'car', label: 'Car' },
                    { value: 'motorcycle', label: 'Motorcycle' },
                    { value: 'bicycle', label: 'Bicycle' },
                  ]}
                />
              </FormField>
              
              <FormField name="parkingRequired" label="Parking Required">
                <FormInput type="checkbox" />
              </FormField>
            </>
          )}
          
          <FormSubmit>Submit</FormSubmit>
        </Form>
      );
    }

    render(<ConditionalForm />);

    // Initially, conditional fields should not be visible
    expect(screen.queryByText('Vehicle Type')).not.toBeInTheDocument();

    // Check the checkbox
    await user.click(screen.getByRole('checkbox', { name: /do you have a vehicle/i }));

    // Conditional fields should appear
    await waitFor(() => {
      expect(screen.getByText('Vehicle Type')).toBeInTheDocument();
      expect(screen.getByText('Parking Required')).toBeInTheDocument();
    });

    // Fill conditional fields
    const vehicleSelect = screen.getByRole('combobox', { name: /vehicle type/i });
    await user.click(vehicleSelect);
    await user.click(screen.getByText('Car'));
  });

  it('handles form submission states', async () => {
    const user = userEvent.setup();
    let resolveSubmit: any;
    
    const handleSubmit = jest.fn(() => 
      new Promise(resolve => {
        resolveSubmit = resolve;
      })
    );

    function AsyncForm() {
      const form = useForm({
        defaultValues: { name: '' },
      });

      return (
        <Form form={form} onSubmit={handleSubmit}>
          <FormField name="name" label="Name">
            <FormInput placeholder="Enter name" />
          </FormField>
          <FormSubmit>
            {form.formState.isSubmitting ? 'Submitting...' : 'Submit'}
          </FormSubmit>
        </Form>
      );
    }

    render(<AsyncForm />);

    await user.type(screen.getByPlaceholderText('Enter name'), 'Test');
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    // Resolve the submission
    resolveSubmit();

    // Button should return to normal state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('integrates with external validation', async () => {
    const user = userEvent.setup();
    
    const checkEmailAvailability = jest.fn(async (email: string) => {
      if (email === 'taken@example.com') {
        return false;
      }
      return true;
    });

    function AsyncValidationForm() {
      const form = useForm({
        schema: z.object({
          email: z.string().email(),
        }),
        defaultValues: { email: '' },
      });

      const validateEmail = async () => {
        const email = form.getValues('email');
        if (email) {
          const isAvailable = await checkEmailAvailability(email);
          if (!isAvailable) {
            form.setError('email', {
              type: 'manual',
              message: 'Email is already taken',
            });
          }
        }
      };

      return (
        <Form form={form} onSubmit={jest.fn()}>
          <FormField name="email" label="Email">
            <FormInput 
              type="email" 
              placeholder="Enter email"
              onBlur={validateEmail}
            />
          </FormField>
          <FormSubmit>Submit</FormSubmit>
        </Form>
      );
    }

    render(<AsyncValidationForm />);

    // Type taken email
    await user.type(screen.getByPlaceholderText('Enter email'), 'taken@example.com');
    await user.tab(); // Blur to trigger async validation

    // Should show error after async validation
    await waitFor(() => {
      expect(screen.getByText('Email is already taken')).toBeInTheDocument();
    });

    // Type available email
    await user.clear(screen.getByPlaceholderText('Enter email'));
    await user.type(screen.getByPlaceholderText('Enter email'), 'available@example.com');
    await user.tab();

    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByText('Email is already taken')).not.toBeInTheDocument();
    });
  });
});