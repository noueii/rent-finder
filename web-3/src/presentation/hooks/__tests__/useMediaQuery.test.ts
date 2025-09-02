import { renderHook } from '@testing-library/react';
import { 
  useMediaQuery, 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop,
  useIsDarkMode,
  useIsReducedMotion
} from '../useMediaQuery';

// Mock window.matchMedia
const createMatchMediaMock = (matches: boolean) => {
  const listeners: Array<(event: MediaQueryListEvent) => void> = [];
  
  return jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.push(handler);
      }
    }),
    removeEventListener: jest.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }),
    // Legacy methods for older browsers
    addListener: jest.fn((handler: (event: MediaQueryListEvent) => void) => {
      listeners.push(handler);
    }),
    removeListener: jest.fn((handler: (event: MediaQueryListEvent) => void) => {
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }),
    // Helper to trigger changes
    _triggerChange: (newMatches: boolean) => {
      const event = {
        matches: newMatches,
        media: query,
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  }));
};

describe('useMediaQuery', () => {
  let matchMediaMock: ReturnType<typeof createMatchMediaMock>;

  beforeEach(() => {
    matchMediaMock = createMatchMediaMock(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
  });

  it('should return initial match state', () => {
    matchMediaMock = createMatchMediaMock(true);
    window.matchMedia = matchMediaMock;

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('should update when media query match changes', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    
    expect(result.current).toBe(false);

    // Trigger a change
    const mediaQueryList = matchMediaMock('(min-width: 768px)');
    mediaQueryList._triggerChange(true);

    expect(result.current).toBe(true);
  });

  it('should handle multiple queries', () => {
    const { result: result1 } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    const { result: result2 } = renderHook(() => useMediaQuery('(max-width: 480px)'));

    expect(result1.current).toBe(false);
    expect(result2.current).toBe(false);
  });

  it('should cleanup listeners on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    
    const mediaQueryList = matchMediaMock('(min-width: 768px)');
    const removeEventListenerSpy = jest.spyOn(mediaQueryList, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should use legacy methods if addEventListener is not available', () => {
    const legacyMatchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    window.matchMedia = legacyMatchMedia;

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    
    const mediaQueryList = legacyMatchMedia('(min-width: 768px)');
    expect(mediaQueryList.addListener).toHaveBeenCalled();

    unmount();
    expect(mediaQueryList.removeListener).toHaveBeenCalled();
  });
});

describe('Pre-configured hooks', () => {
  let matchMediaMock: ReturnType<typeof createMatchMediaMock>;

  beforeEach(() => {
    matchMediaMock = createMatchMediaMock(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
  });

  it('useIsMobile should check max-width: 639px', () => {
    renderHook(() => useIsMobile());
    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 639px)');
  });

  it('useIsTablet should check tablet range', () => {
    renderHook(() => useIsTablet());
    expect(matchMediaMock).toHaveBeenCalledWith('(min-width: 640px) and (max-width: 1023px)');
  });

  it('useIsDesktop should check min-width: 1024px', () => {
    renderHook(() => useIsDesktop());
    expect(matchMediaMock).toHaveBeenCalledWith('(min-width: 1024px)');
  });

  it('useIsDarkMode should check prefers-color-scheme', () => {
    renderHook(() => useIsDarkMode());
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('useIsReducedMotion should check prefers-reduced-motion', () => {
    renderHook(() => useIsReducedMotion());
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});