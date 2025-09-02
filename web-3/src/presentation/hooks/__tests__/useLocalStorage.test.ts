import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('should return initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('initial');
  });

  it('should read existing value from localStorage', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [, setValue] = result.current;

    act(() => {
      setValue('new-value');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify('new-value')
    );
    
    const [newValue] = result.current;
    expect(newValue).toBe('new-value');
  });

  it('should accept a function updater', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 0));
    const [, setValue] = result.current;

    act(() => {
      setValue((prev) => prev + 1);
    });

    const [value] = result.current;
    expect(value).toBe(1);
  });

  it('should remove value from localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [, setValue, removeValue] = result.current;

    act(() => {
      setValue('stored-value');
    });

    act(() => {
      removeValue();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    const [value] = result.current;
    expect(value).toBe('initial');
  });

  it('should handle complex data types', () => {
    const complexData = {
      user: { id: 1, name: 'John' },
      settings: { theme: 'dark', notifications: true },
      list: [1, 2, 3],
    };

    const { result } = renderHook(() => 
      useLocalStorage('complex-key', complexData)
    );
    const [value, setValue] = result.current;

    expect(value).toEqual(complexData);

    const updatedData = { ...complexData, settings: { ...complexData.settings, theme: 'light' } };
    act(() => {
      setValue(updatedData);
    });

    const [newValue] = result.current;
    expect(newValue).toEqual(updatedData);
  });

  it('should handle localStorage errors gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Simulate localStorage.setItem throwing an error
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [, setValue] = result.current;

    act(() => {
      setValue('new-value');
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('should sync across multiple hooks using the same key', () => {
    const { result: hook1 } = renderHook(() => useLocalStorage('shared-key', 'initial'));
    const { result: hook2 } = renderHook(() => useLocalStorage('shared-key', 'initial'));

    const [value1] = hook1.current;
    const [value2] = hook2.current;
    expect(value1).toBe('initial');
    expect(value2).toBe('initial');

    const [, setValue1] = hook1.current;
    
    act(() => {
      setValue1('updated');
      // Dispatch the custom event that the hook listens for
      window.dispatchEvent(new Event('local-storage'));
    });

    const [newValue1] = hook1.current;
    const [newValue2] = hook2.current;
    expect(newValue1).toBe('updated');
    expect(newValue2).toBe('updated');
  });

  it('should handle storage events from other tabs', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'test-key',
        newValue: JSON.stringify('external-update'),
        oldValue: JSON.stringify('initial'),
        storageArea: window.localStorage,
      });
      window.dispatchEvent(event);
    });

    const [value] = result.current;
    expect(value).toBe('external-update');
  });
});