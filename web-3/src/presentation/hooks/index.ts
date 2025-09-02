/**
 * Shared hooks for the presentation layer
 * 
 * These hooks provide common functionality that can be reused across components
 */

export { useDebounce } from './useDebounce';
export { useLocalStorage } from './useLocalStorage';
export { 
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsDarkMode,
  useIsReducedMotion
} from './useMediaQuery';
export { 
  useIntersectionObserver,
  useLazyLoad,
  type UseIntersectionObserverOptions,
  type IntersectionObserverResult
} from './useIntersectionObserver';