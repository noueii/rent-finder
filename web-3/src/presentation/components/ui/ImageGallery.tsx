/**
 * Reusable Image Gallery Component
 * For displaying multiple images with navigation
 */

import * as React from "react";
import { cn } from "~/lib/utils";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "~/components/ui/button";

export interface ImageItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface ImageGalleryProps {
  images: ImageItem[];
  defaultAlt?: string;
  height?: string | number;
  variant?: "carousel" | "grid" | "stack";
  showIndicators?: boolean;
  showNavigation?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  onImageClick?: (index: number) => void;
  className?: string;
}

export const ImageGallery = React.forwardRef<HTMLDivElement, ImageGalleryProps>(
  (
    {
      images = [],
      defaultAlt = "Image",
      height = 240,
      variant = "carousel",
      showIndicators = true,
      showNavigation = true,
      autoPlay = false,
      autoPlayInterval = 5000,
      onImageClick,
      className,
    },
    ref
  ) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [imageErrors, setImageErrors] = React.useState<Set<number>>(new Set());
    const [isHovered, setIsHovered] = React.useState(false);

    const hasMultipleImages = images.length > 1;
    const currentImage = images[currentIndex];

    // Auto-play functionality
    React.useEffect(() => {
      if (!autoPlay || !hasMultipleImages || isHovered) return;

      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }, autoPlayInterval);

      return () => clearInterval(interval);
    }, [autoPlay, autoPlayInterval, hasMultipleImages, images.length, isHovered]);

    const handlePrevious = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      },
      [images.length]
    );

    const handleNext = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      },
      [images.length]
    );

    const handleImageError = (index: number) => {
      setImageErrors((prev) => new Set(prev).add(index));
    };

    // Carousel variant
    if (variant === "carousel") {
      return (
        <div
          ref={ref}
          className={cn("relative overflow-hidden rounded-lg bg-muted", className)}
          style={{ height }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {currentImage && !imageErrors.has(currentIndex) ? (
            <>
              <img
                src={currentImage.url}
                alt={currentImage.alt || defaultAlt}
                className="h-full w-full object-contain bg-black/5 dark:bg-white/5"
                onError={() => handleImageError(currentIndex)}
                onClick={() => onImageClick?.(currentIndex)}
                style={{ cursor: onImageClick ? "pointer" : "default" }}
              />

              {/* Navigation controls */}
              {showNavigation && hasMultipleImages && (
                <>
                  {/* Click zones for touch devices */}
                  <div
                    className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer md:hidden"
                    onClick={handlePrevious}
                    aria-label="Previous image"
                  />
                  <div
                    className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer md:hidden"
                    onClick={handleNext}
                    aria-label="Next image"
                  />

                  {/* Button navigation for desktop */}
                  <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 hover:opacity-100 transition-opacity hidden md:flex">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                      onClick={handlePrevious}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* Indicators */}
              {showIndicators && hasMultipleImages && (
                <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1 px-4">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(idx);
                      }}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-all duration-200 shadow-sm",
                        idx === currentIndex
                          ? "bg-white shadow-md"
                          : "bg-white/40 backdrop-blur-sm hover:bg-white/60"
                      )}
                      style={{
                        maxWidth: "40px",
                        boxShadow:
                          idx === currentIndex
                            ? "0 2px 4px rgba(0, 0, 0, 0.3)"
                            : "0 1px 2px rgba(0, 0, 0, 0.2)",
                      }}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Caption */}
              {currentImage.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <p className="text-white text-sm">{currentImage.caption}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <ImageOff className="h-12 w-12 text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">No Image Available</span>
            </div>
          )}
        </div>
      );
    }

    // Grid variant
    if (variant === "grid") {
      return (
        <div
          ref={ref}
          className={cn(
            "grid gap-2",
            images.length === 1 && "grid-cols-1",
            images.length === 2 && "grid-cols-2",
            images.length >= 3 && "grid-cols-3",
            className
          )}
        >
          {images.map((image, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-lg bg-muted aspect-square"
              onClick={() => onImageClick?.(idx)}
              style={{ cursor: onImageClick ? "pointer" : "default" }}
            >
              {!imageErrors.has(idx) ? (
                <img
                  src={image.url}
                  alt={image.alt || defaultAlt}
                  className="h-full w-full object-cover"
                  onError={() => handleImageError(idx)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Stack variant
    if (variant === "stack") {
      return (
        <div ref={ref} className={cn("relative", className)} style={{ height }}>
          {images.slice(0, 3).map((image, idx) => (
            <div
              key={idx}
              className="absolute inset-0 overflow-hidden rounded-lg bg-muted shadow-md transition-all"
              style={{
                transform: `translateX(${idx * 10}px) translateY(${idx * 10}px) scale(${1 - idx * 0.05})`,
                zIndex: images.length - idx,
              }}
              onClick={() => onImageClick?.(0)}
            >
              {!imageErrors.has(idx) ? (
                <img
                  src={image.url}
                  alt={image.alt || defaultAlt}
                  className="h-full w-full object-cover"
                  onError={() => handleImageError(idx)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {images.length > 3 && (
            <div
              className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium"
              style={{ zIndex: images.length + 1 }}
            >
              +{images.length - 3} more
            </div>
          )}
        </div>
      );
    }

    return null;
  }
);
ImageGallery.displayName = "ImageGallery";