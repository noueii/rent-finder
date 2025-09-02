import { renderHook } from '@testing-library/react';
import { useIntersectionObserver, useLazyLoad } from '../useIntersectionObserver';

// Mock IntersectionObserver
class IntersectionObserverMock {
  private callback: IntersectionObserverCallback;
  private elements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Helper method to trigger intersection
  triggerIntersection(entries: Array<{ isIntersecting: boolean }>) {
    const observerEntries = entries.map((entry) => ({
      isIntersecting: entry.isIntersecting,
      target: document.createElement('div'),
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: entry.isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    })) as IntersectionObserverEntry[];

    this.callback(observerEntries, this as any);
  }
}

describe('useIntersectionObserver', () => {
  let observerMap: Map<Element, IntersectionObserverMock>;
  let observerInstances: IntersectionObserverMock[];

  beforeEach(() => {
    observerMap = new Map();
    observerInstances = [];

    global.IntersectionObserver = jest.fn().mockImplementation((callback, options) => {
      const observer = new IntersectionObserverMock(callback, options);
      observerInstances.push(observer);
      return observer;
    }) as any;
  });

  afterEach(() => {
    (global.IntersectionObserver as any).mockRestore();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    
    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.ref.current).toBe(null);
    expect(result.current.entry).toBeUndefined();
  });

  it('should observe element when ref is set', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    
    const element = document.createElement('div');
    result.current.ref.current = element;

    // Re-render to trigger effect
    const { rerender } = renderHook(() => useIntersectionObserver());
    rerender();

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      { threshold: 0, root: null, rootMargin: '0px' }
    );
  });

  it('should update isIntersecting when element becomes visible', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    
    const element = document.createElement('div');
    result.current.ref.current = element;

    // Re-render to trigger effect
    renderHook(() => useIntersectionObserver());

    // Trigger intersection
    const observer = observerInstances[0];
    observer.triggerIntersection([{ isIntersecting: true }]);

    expect(result.current.isIntersecting).toBe(true);
  });

  it('should freeze observer when freezeOnceVisible is true', () => {
    const { result } = renderHook(() => 
      useIntersectionObserver({ freezeOnceVisible: true })
    );
    
    const element = document.createElement('div');
    result.current.ref.current = element;

    renderHook(() => useIntersectionObserver({ freezeOnceVisible: true }));

    const observer = observerInstances[0];
    const disconnectSpy = jest.spyOn(observer, 'disconnect');

    // Trigger intersection
    observer.triggerIntersection([{ isIntersecting: true }]);

    expect(disconnectSpy).toHaveBeenCalled();
    expect(result.current.isIntersecting).toBe(true);
  });

  it('should use custom options', () => {
    const options = {
      threshold: 0.5,
      root: document.body,
      rootMargin: '10px',
    };

    renderHook(() => useIntersectionObserver(options));

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      options
    );
  });

  it('should use initialIsIntersecting value', () => {
    const { result } = renderHook(() => 
      useIntersectionObserver({ initialIsIntersecting: true })
    );

    expect(result.current.isIntersecting).toBe(true);
  });

  it('should handle missing IntersectionObserver support', () => {
    (global as any).IntersectionObserver = undefined;

    const { result } = renderHook(() => useIntersectionObserver());
    
    expect(result.current.isIntersecting).toBe(true); // Defaults to true when not supported
  });
});

describe('useLazyLoad', () => {
  let observerInstances: IntersectionObserverMock[];

  beforeEach(() => {
    observerInstances = [];

    global.IntersectionObserver = jest.fn().mockImplementation((callback, options) => {
      const observer = new IntersectionObserverMock(callback, options);
      observerInstances.push(observer);
      return observer;
    }) as any;
  });

  afterEach(() => {
    (global.IntersectionObserver as any).mockRestore();
  });

  it('should call onVisible when element becomes visible', () => {
    const onVisible = jest.fn();
    const { result } = renderHook(() => useLazyLoad(onVisible));

    const element = document.createElement('div');
    result.current.current = element;

    // Re-render to trigger effect
    renderHook(() => useLazyLoad(onVisible));

    // Trigger intersection
    const observer = observerInstances[0];
    observer.triggerIntersection([{ isIntersecting: true }]);

    expect(onVisible).toHaveBeenCalled();
  });

  it('should only call onVisible once with freezeOnceVisible', () => {
    const onVisible = jest.fn();
    const { result } = renderHook(() => useLazyLoad(onVisible));

    const element = document.createElement('div');
    result.current.current = element;

    renderHook(() => useLazyLoad(onVisible));

    const observer = observerInstances[0];
    
    // Trigger intersection multiple times
    observer.triggerIntersection([{ isIntersecting: true }]);
    observer.triggerIntersection([{ isIntersecting: false }]);
    observer.triggerIntersection([{ isIntersecting: true }]);

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('should accept custom options', () => {
    const onVisible = jest.fn();
    const options = { threshold: 0.8, rootMargin: '20px' };
    
    renderHook(() => useLazyLoad(onVisible, options));

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: 0.8,
        rootMargin: '20px',
        freezeOnceVisible: true,
      })
    );
  });
});