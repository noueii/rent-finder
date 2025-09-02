/**
 * Performance Optimization Utilities
 * Various utilities to improve application performance
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Lazy load images with Intersection Observer
 */
export function useLazyLoad<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  return ref;
}

/**
 * Debounce hook for performance optimization
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex,
  };
}

/**
 * Prefetch data on hover/focus
 */
export function usePrefetch(prefetchFn: () => void, delay = 200) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const startPrefetch = useCallback(() => {
    timeoutRef.current = setTimeout(prefetchFn, delay);
  }, [prefetchFn, delay]);
  
  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);
  
  useEffect(() => {
    return () => {
      cancelPrefetch();
    };
  }, [cancelPrefetch]);
  
  return {
    onMouseEnter: startPrefetch,
    onMouseLeave: cancelPrefetch,
    onFocus: startPrefetch,
    onBlur: cancelPrefetch,
  };
}

/**
 * Optimize re-renders with memo comparison
 */
export function arePropsEqual<T extends Record<string, any>>(
  prevProps: T,
  nextProps: T,
  keysToCompare?: Array<keyof T>
): boolean {
  const keys = keysToCompare || Object.keys(prevProps) as Array<keyof T>;
  
  return keys.every(key => 
    Object.is(prevProps[key], nextProps[key])
  );
}

/**
 * Resource hints for preloading
 */
export function preloadResource(
  href: string,
  as: 'script' | 'style' | 'image' | 'font' | 'fetch'
) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  
  document.head.appendChild(link);
}

/**
 * Batch DOM updates
 */
export function batchDOMUpdates(updates: Array<() => void>) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      updates.forEach(update => update());
    });
  } else {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }
}

/**
 * Memory-efficient image loading
 */
export function loadImageWithCleanup(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };
    
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    
    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${src}`));
    };
    
    img.src = src;
  });
}

/**
 * Web Worker utility for heavy computations
 */
export function createWorker<T, R>(
  workerFunction: (data: T) => R
): (data: T) => Promise<R> {
  const workerCode = `
    self.onmessage = function(e) {
      const result = (${workerFunction.toString()})(e.data);
      self.postMessage(result);
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  
  return (data: T) => {
    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        resolve(e.data);
      };
      
      worker.onerror = reject;
      worker.postMessage(data);
    });
  };
}

// Import React after using it
import { useState } from 'react';