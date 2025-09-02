/**
 * ApartmentImages Component
 * Handles image carousel and navigation for apartment photos
 */

import * as React from "react";
import { ImageGallery } from "~/presentation/components/ui";
import { cn } from "~/lib/utils";

interface ApartmentImagesProps {
  images: Array<{ url: string; caption?: string }>;
  title: string;
  className?: string;
  height?: string | number;
}

export function ApartmentImages({
  images = [],
  title,
  className,
  height = 240
}: ApartmentImagesProps) {
  // Transform images to ImageGallery format
  const galleryImages = React.useMemo(
    () => images.map(img => ({
      url: img.url,
      alt: title,
      caption: img.caption
    })),
    [images, title]
  );

  return (
    <ImageGallery
      images={galleryImages}
      defaultAlt={title}
      height={height}
      variant="carousel"
      showIndicators={true}
      showNavigation={true}
      className={cn("rounded-t-lg", className)}
    />
  );
}