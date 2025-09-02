import { useEffect, useRef, useState, RefObject } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /**
   * Whether to freeze the observer once the element is visible
   */
  freezeOnceVisible?: boolean;
  /**
   * Initial visibility state
   */
  initialIsIntersecting?: boolean;
}

interface IntersectionObserverResult {
  /**
   * Ref to attach to the element to observe
   */
  ref: RefObject<Element | null>;
  /**
   * Whether the element is currently intersecting
   */
  isIntersecting: boolean;
  /**
   * The latest IntersectionObserverEntry
   */
  entry?: IntersectionObserverEntry;
}

/**
 * Hook that uses IntersectionObserver to track element visibility
 * 
 * @param options - IntersectionObserver options
 * @returns Object with ref, isIntersecting, and entry
 * 
 * @example
 * ```tsx
 * // Basic usage for lazy loading
 * const { ref, isIntersecting } = useIntersectionObserver();
 * 
 * return (
 *   <div ref={ref}>
 *     {isIntersecting && <ExpensiveComponent />}
 *   </div>
 * );
 * 
 * // With options
 * const { ref, isIntersecting } = useIntersectionObserver({
 *   threshold: 0.5,
 *   rootMargin: '100px',
 *   freezeOnceVisible: true
 * });
 * ```
 */
export function useIntersectionObserver({
  threshold = 0,
  root = null,
  rootMargin = '0px',
  freezeOnceVisible = false,
  initialIsIntersecting = false,
}: UseIntersectionObserverOptions = {}): IntersectionObserverResult {
  const [entry, setEntry] = useState<IntersectionObserverEntry>();
  const [isIntersecting, setIsIntersecting] = useState(initialIsIntersecting);
  const frozen = useRef(false);
  const ref = useRef<Element | null>(null);

  useEffect(() => {
    // Skip if we're frozen (element was visible and freezeOnceVisible is true)
    if (frozen.current) return;

    // Skip if IntersectionObserver is not supported
    if (typeof IntersectionObserver === 'undefined') {
      setIsIntersecting(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        const isElementIntersecting = entry.isIntersecting;
        setIsIntersecting(isElementIntersecting);

        // If element is intersecting and freezeOnceVisible is true, freeze the observer
        if (isElementIntersecting && freezeOnceVisible) {
          frozen.current = true;
          observer.disconnect();
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, freezeOnceVisible]);

  return { ref, isIntersecting, entry };
}

/**
 * Hook for implementing lazy loading with IntersectionObserver
 * 
 * @param onVisible - Callback when element becomes visible
 * @param options - IntersectionObserver options
 * @returns Ref to attach to the element
 * 
 * @example
 * ```tsx
 * const ref = useLazyLoad(() => {
 *   console.log('Element is visible!');
 *   loadMoreData();
 * });
 * 
 * return <div ref={ref}>Load more trigger</div>;
 * ```
 */
export function useLazyLoad(
  onVisible: () => void,
  options: UseIntersectionObserverOptions = {}
): RefObject<Element | null> {
  const { ref, isIntersecting } = useIntersectionObserver({
    ...options,
    freezeOnceVisible: true,
  });

  useEffect(() => {
    if (isIntersecting) {
      onVisible();
    }
  }, [isIntersecting, onVisible]);

  return ref;
}