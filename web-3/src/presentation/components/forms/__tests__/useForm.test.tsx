import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm, useFormField, useFormReset, useFormSubmit } from '../useForm';
import { z } from 'zod';

describe('useForm', () => {
  it('creates form without schema', () => {
    const { result } = renderHook(() => useForm());
    
    expect(result.current).toBeDefined();
    expect(result.current.register).toBeDefined();
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.formState).toBeDefined();
  });

  it('creates form with zod schema', async () => {
    const schema = z.object({
      name: z.string().min(3, 'Name must be at least 3 characters'),
      age: z.number().min(18, 'Must be at least 18'),
    });

    const { result } = renderHook(() => useForm({ schema }));

    // Test validation
    await act(async () => {
      const isValid = await result.current.trigger();
      expect(isValid).toBe(false);
    });

    // Set valid values
    act(() => {
      result.current.setValue('name', 'John');
      result.current.setValue('age', 25);
    });

    await act(async () => {
      const isValid = await result.current.trigger();
      expect(isValid).toBe(true);
    });
  });

  it('passes through react-hook-form options', () => {
    const defaultValues = { name: 'Default Name' };
    const { result } = renderHook(() => useForm({ defaultValues }));
    
    expect(result.current.getValues('name')).toBe('Default Name');
  });
});

describe('useFormField', () => {
  it('returns field state and value', async () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
    });

    const { result } = renderHook(() => {
      const form = useForm({ schema });
      const field = useFormField(form, 'email');
      return { form, field };
    });

    // Initial state
    expect(result.current.field.value).toBeUndefined();
    expect(result.current.field.error).toBeUndefined();
    expect(result.current.field.isDirty).toBe(false);
    expect(result.current.field.isTouched).toBe(false);
    expect(result.current.field.isValid).toBe(true);

    // Set invalid value
    act(() => {
      result.current.form.setValue('email', 'invalid');
    });

    await act(async () => {
      await result.current.form.trigger('email');
    });

    expect(result.current.field.value).toBe('invalid');
    expect(result.current.field.error).toBe('Invalid email');
    expect(result.current.field.isValid).toBe(false);

    // Set valid value
    act(() => {
      result.current.form.setValue('email', 'test@example.com');
    });

    await act(async () => {
      await result.current.form.trigger('email');
    });

    expect(result.current.field.value).toBe('test@example.com');
    expect(result.current.field.error).toBeUndefined();
    expect(result.current.field.isValid).toBe(true);
  });
});

describe('useFormReset', () => {
  it('resets form with animation delay', async () => {
    const defaultValues = { name: 'Initial' };
    const { result } = renderHook(() => {
      const form = useForm({ defaultValues });
      const resetUtil = useFormReset(form);
      return { form, resetUtil };
    });

    // Change value
    act(() => {
      result.current.form.setValue('name', 'Changed');
    });

    expect(result.current.form.getValues('name')).toBe('Changed');

    // Reset form
    act(() => {
      result.current.resetUtil.reset();
    });

    expect(result.current.resetUtil.isResetting).toBe(true);

    // Wait for animation delay
    await waitFor(() => {
      expect(result.current.resetUtil.isResetting).toBe(false);
    });

    expect(result.current.form.getValues('name')).toBe('Initial');
  });

  it('resets with new values', async () => {
    const { result } = renderHook(() => {
      const form = useForm();
      const resetUtil = useFormReset(form);
      return { form, resetUtil };
    });

    const newValues = { name: 'New Value' };

    act(() => {
      result.current.resetUtil.reset(newValues);
    });

    await waitFor(() => {
      expect(result.current.resetUtil.isResetting).toBe(false);
    });

    expect(result.current.form.getValues('name')).toBe('New Value');
  });
});

describe('useFormSubmit', () => {
  it('handles successful submission', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFormSubmit(onSubmit));

    const formData = { name: 'Test' };

    await act(async () => {
      await result.current.handleSubmit(formData);
    });

    expect(onSubmit).toHaveBeenCalledWith(formData);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toBeNull();
  });

  it('handles submission error', async () => {
    const error = new Error('Submission failed');
    const onSubmit = jest.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useFormSubmit(onSubmit));

    const formData = { name: 'Test' };

    await act(async () => {
      await result.current.handleSubmit(formData);
    });

    expect(onSubmit).toHaveBeenCalledWith(formData);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toBe('Submission failed');
  });

  it('handles non-Error rejection', async () => {
    const onSubmit = jest.fn().mockRejectedValue('String error');
    const { result } = renderHook(() => useFormSubmit(onSubmit));

    await act(async () => {
      await result.current.handleSubmit({ name: 'Test' });
    });

    expect(result.current.submitError).toBe('An error occurred');
  });

  it('tracks submitting state', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });

    const onSubmit = jest.fn().mockReturnValue(submitPromise);
    const { result } = renderHook(() => useFormSubmit(onSubmit));

    expect(result.current.isSubmitting).toBe(false);

    // Start submission
    let submissionPromise: Promise<void>;
    act(() => {
      submissionPromise = result.current.handleSubmit({ name: 'Test' });
    });

    expect(result.current.isSubmitting).toBe(true);

    // Resolve submission
    act(() => {
      resolveSubmit!();
    });

    await act(async () => {
      await submissionPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('clears previous error on new submission', async () => {
    const onSubmit = jest.fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useFormSubmit(onSubmit));

    // First submission fails
    await act(async () => {
      await result.current.handleSubmit({ name: 'Test' });
    });

    expect(result.current.submitError).toBe('First error');

    // Second submission succeeds
    await act(async () => {
      await result.current.handleSubmit({ name: 'Test' });
    });

    expect(result.current.submitError).toBeNull();
  });
});