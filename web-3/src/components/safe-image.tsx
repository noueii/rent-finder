import Image from 'next/image';
import { useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}

/**
 * A wrapper around Next.js Image that handles external images safely
 * Uses unoptimized for external URLs to avoid domain configuration
 */
export function SafeImage({ src, alt, ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  
  // Check if it's an external URL
  const isExternal = src?.startsWith('http://') || src?.startsWith('https://');
  
  // Fallback image
  const fallbackSrc = '/images/placeholder-apartment.jpg';
  
  if (error || !src) {
    return (
      <Image
        {...props}
        src={fallbackSrc}
        alt={alt}
        unoptimized
      />
    );
  }
  
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={isExternal}
      onError={() => setError(true)}
    />
  );
}