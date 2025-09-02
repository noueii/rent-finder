import { useState, useEffect } from 'react';

/**
 * Hook that tracks whether a media query matches
 * 
 * @param query - The media query string
 * @returns Boolean indicating if the query matches
 * 
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
 * const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Prevent SSR issues
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);

    // Define event handler
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add event listener
    if (media.addEventListener) {
      media.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      media.addListener(handler);
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handler);
      } else {
        // Fallback for older browsers
        media.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Pre-configured media query hooks for common breakpoints
 */
export const useIsMobile = () => useMediaQuery('(max-width: 639px)');
export const useIsTablet = () => useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsDarkMode = () => useMediaQuery('(prefers-color-scheme: dark)');
export const useIsReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');