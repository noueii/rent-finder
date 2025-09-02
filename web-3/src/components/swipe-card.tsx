"use client";

import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Price, CostCalculator } from "~/presentation/components/ui";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building, Maximize, MapPin, Clock, Train, Heart, X, ExternalLink } from "lucide-react";
import React, { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { getApartmentMapsUrl } from "~/lib/maps";
import { ListToggleButton } from "~/components/list-toggle-button";
import { MatchScoreBadge } from "~/components/match-score-badge";
import { useTargetedApartmentScorer } from "~/hooks/use-targeted-apartment-scorer";

interface SwipeCardProps {
  card: any;
  index: number;
  isTop: boolean;
  onSwipe: (direction: 'left' | 'right') => void;
  listType?: string;
  targetStationId?: string;
  showScore?: boolean;
}

// Helper function to get commute time color
function getCommuteTimeColor(minutes: number): string {
  if (minutes <= 10) return "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400";
  if (minutes <= 30) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400";
  if (minutes <= 45) return "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400";
  return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400";
}

// Helper function to calculate 2-year total cost
function calculate2YearCost(apartment: any): number {
  const monthlyRent = apartment.price;
  const fees = apartment.feesJson as { deposit?: number; keyMoney?: number; agencyFee?: number; reikin?: number } | null;
  const deposit = fees?.deposit || (apartment.price * 2); // Default 2 months
  const keyMoney = fees?.keyMoney || 0;
  const reikin = fees?.reikin || 0;
  const agencyFee = fees?.agencyFee || apartment.price; // Default 1 month
  
  // Initial costs + 24 months of rent
  return deposit + keyMoney + reikin + agencyFee + (monthlyRent * 24);
}


export function SwipeCard({ card, index, isTop, onSwipe, listType, targetStationId, showScore = false }: SwipeCardProps) {
  const router = useRouter();
  const controls = useAnimation();
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // Motion values for smooth drag
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 150], [-15, 15]);
  
  // Indicators opacity
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  
  const images = card.apartment.images || [];
  const hasMultipleImages = images.length > 1;
  
  // Calculate values
  const twoYearCost = calculate2YearCost(card.apartment);
  const monthlyAverage = Math.round(twoYearCost / 24);
  
  // Score apartment if requested
  const { scoreApartment } = useTargetedApartmentScorer({ targetStationId });
  const scoredApartment = React.useMemo(() => {
    if (!showScore) return null;
    return scoreApartment(card.apartment);
  }, [showScore, card.apartment, scoreApartment]);

  // Reset position when not top card
  useEffect(() => {
    if (!isTop) {
      controls.start({ x: 0, y: 0 });
      setCurrentImageIndex(0); // Reset image index when card becomes inactive
    }
  }, [isTop, controls]);

  // Preload ALL images for the card
  useEffect(() => {
    if (images.length > 0 && typeof window !== 'undefined' && index <= 2) {
      let loadedCount = 0;
      const totalImages = images.length;
      
      images.forEach((image: any) => {
        const img = new window.Image();
        img.onload = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setImagesLoaded(true);
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setImagesLoaded(true);
          }
        };
        img.src = image.url;
      });
    } else if (images.length === 0) {
      setImagesLoaded(true);
    }
  }, [images, index]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    
    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      // Trigger swipe
      const direction = offset > 0 ? 'right' : 'left';
      setExitDirection(direction);
      
      // Notify parent to remove card - AnimatePresence will handle the exit animation
      onSwipe(direction);
    } else {
      // Spring back
      controls.start({ 
        x: 0, 
        transition: {
          type: "spring",
          stiffness: 200,
          damping: 25
        }
      });
    }
  };

  return (
    <motion.div
      className={`absolute inset-0 transform-gpu ${isTop ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: exitDirection ? 200 : isTop ? 100 : 10 - index, // Highest z-index when exiting
        willChange: isTop ? "transform" : "auto",
      }}
      animate={controls}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      dragMomentum={false}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={{ 
        scale: 1 - (index * 0.05), 
        opacity: 1,
        y: index * 10,
        transition: {
          type: "spring",
          stiffness: 200,
          damping: 20,
          mass: 1.2
        }
      }}
      exit={{
        x: exitDirection === 'right' ? window.innerWidth * 0.8 : exitDirection === 'left' ? -window.innerWidth * 0.8 : 0,
        opacity: 0,
        rotate: exitDirection === 'right' ? 25 : exitDirection === 'left' ? -25 : 0,
        scale: 0.9,
        transition: {
          duration: 0.3,
          ease: "easeOut"
        }
      }}
    >
      <div className={`h-full w-full px-4 ${isTop ? '' : 'pointer-events-none'}`}>
        <Card className={`h-full flex flex-col overflow-hidden p-0 ${isTop ? 'shadow-2xl' : 'shadow-lg'}`}>
          {/* Swipe Indicators */}
          {isTop && (
            <>
              <motion.div
                className="absolute left-4 top-4 z-10 pointer-events-none"
                style={{ opacity: likeOpacity }}
              >
                <div className="rounded-full bg-gradient-to-br from-green-400 to-green-600 p-3 shadow-lg">
                  <Heart className="h-8 w-8 text-white fill-white" />
                </div>
              </motion.div>
              <motion.div
                className="absolute right-4 top-4 z-10 pointer-events-none"
                style={{ opacity: nopeOpacity }}
              >
                <div className="rounded-full bg-gradient-to-br from-red-400 to-red-600 p-3 shadow-lg">
                  <X className="h-8 w-8 text-white" />
                </div>
              </motion.div>
            </>
          )}

          {/* Image Section - Fixed 50% height */}
          <div className="relative flex-none h-1/2 bg-muted">
            {images.length > 0 ? (
              <>
                {/* Loading placeholder - only show before any images are loaded */}
                {!imagesLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-30">
                    <Building className="h-12 w-12 text-muted-foreground animate-pulse" />
                  </div>
                )}
                
                {/* Render all images but only show current one */}
                {images.map((image: any, idx: number) => (
                  <div
                    key={`${card.id}-${idx}`}
                    className={cn(
                      "absolute inset-0",
                      idx === currentImageIndex ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <Image
                      src={image.url}
                      alt={card.apartment.title}
                      fill
                      className="object-contain bg-black/5 dark:bg-white/5"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={isTop && idx === 0}
                      loading="eager"
                      quality={85}
                    />
                  </div>
                ))}
                
                {/* Left/Right click zones for image navigation */}
                {hasMultipleImages && isTop && (
                  <>
                    <div 
                      className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => 
                          prev === 0 ? images.length - 1 : prev - 1
                        );
                      }}
                    />
                    <div 
                      className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex((prev) => 
                          prev === images.length - 1 ? 0 : prev + 1
                        );
                      }}
                    />
                  </>
                )}
                
                {/* Image indicators */}
                {hasMultipleImages && (
                  <div className="absolute top-4 left-0 right-0 z-20 flex justify-center gap-1 px-4">
                    {images.map((_: any, idx: number) => (
                      <div
                        key={idx}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-all duration-200 shadow-sm",
                          idx === currentImageIndex 
                            ? "bg-white shadow-md" 
                            : "bg-white/40 backdrop-blur-sm"
                        )}
                        style={{
                          maxWidth: '60px',
                          boxShadow: idx === currentImageIndex 
                            ? '0 2px 4px rgba(0, 0, 0, 0.3)' 
                            : '0 1px 2px rgba(0, 0, 0, 0.2)'
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <Building className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            
            {/* Price Badge */}
            <div className="absolute left-4 bottom-4">
              <Price
                value={card.apartment.price}
                variant="badge"
                size="lg"
                suffix="/mo"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="absolute right-4 bottom-4 z-20 flex gap-2">
              {/* External Link Button */}
              {card.apartment.url && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="backdrop-blur-sm bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(card.apartment.url, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              
              {/* View Full Button */}
              <Button
                size="icon"
                variant="secondary"
                className="backdrop-blur-sm bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/apartments/${card.apartment.id}`);
                }}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Details Section - Flexible height */}
          <div className="flex-1 min-h-0 space-y-2 p-3 overflow-y-auto h-full">
            <div>
              <h2 className="text-lg font-semibold line-clamp-1">{card.apartment.title}</h2>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Determine destination: prefer user-assigned station, then route destination, then nearest station
                  let destination = null;
                  if (card.apartment.preferredStation) {
                    destination = card.apartment.preferredStation;
                  } else if (listType === 'SEARCH_RESULT' && card.apartment.routes?.[0]?.toStation) {
                    destination = card.apartment.routes[0].toStation;
                  } else if (card.apartment.nearestStations?.[0]?.station) {
                    destination = card.apartment.nearestStations[0].station;
                  }
                  const url = getApartmentMapsUrl(card.apartment, destination);
                  window.open(url, '_blank');
                }}
                className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="line-clamp-1">{card.apartment.address}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
            
            {/* Apartment Score */}
            {scoredApartment?.score !== undefined && (
              <div className="flex items-center justify-between p-2 rounded-md bg-primary/5">
                <span className="text-sm font-medium">Match Score</span>
                <MatchScoreBadge score={scoredApartment.score} />
              </div>
            )}
            
            {/* 2-Year Cost Calculation */}
            <CostCalculator
              monthlyRent={card.apartment.price}
              initialCosts={{
                deposit: (card.apartment.feesJson as any)?.deposit || card.apartment.price * 2,
                keyMoney: (card.apartment.feesJson as any)?.keyMoney || 0,
                agencyFee: (card.apartment.feesJson as any)?.agencyFee || card.apartment.price,
              }}
              period={24}
            />
            
            {/* Property Details */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Layout:</span>
                <span className="font-medium">{card.apartment.layout || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span className="font-medium">{card.apartment.size}m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Floor:</span>
                <span className="font-medium">
                  {card.apartment.floor || 'N/A'}/{card.apartment.totalFloors || 'N/A'}F
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age:</span>
                <span className="font-medium">
                  {card.apartment.buildingAge ? `${card.apartment.buildingAge}y` : 'N/A'}
                </span>
              </div>
            </div>
            
            {/* Station Info */}
            {card.apartment.nearestStations?.length > 0 && card.apartment.nearestStations[0]?.station && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{card.apartment.nearestStations[0].station.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {card.apartment.nearestStations[0].walkingMinutes}min walk
                </Badge>
              </div>
            )}
            
            {/* Commute Time for Search Results */}
            {listType === 'SEARCH_RESULT' && card.apartment.routes?.length > 0 && (
              <div className={cn(
                "rounded-lg p-3",
                getCommuteTimeColor(card.apartment.routes[0].duration)
              )}>
                <div className="flex items-center justify-between text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{card.apartment.routes[0].duration} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Train className="h-4 w-4" />
                    <span>{card.apartment.routes[0].transfers} transfer{card.apartment.routes[0].transfers !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {card.apartment.routes[0].toStation && (
                  <div className="text-xs mt-1 opacity-80">
                    to {card.apartment.routes[0].toStation.name}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer Buttons - Auto height */}
          <div className="flex-none flex items-center gap-1.5 px-3 py-2 border-t bg-background">
            {/* External Link Button - Full Width */}
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (card.apartment.sourceUrl) {
                  window.open(card.apartment.sourceUrl, '_blank');
                }
              }}
              disabled={!card.apartment.sourceUrl}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View Original
            </Button>
            
            {/* Favorite Button (Star) */}
            <ListToggleButton
              apartmentId={card.apartment.id}
              listType="FAVORITED"
              className="h-8 w-8"
            />
            
            {/* Bookmark Button (Save for later) */}
            <ListToggleButton
              apartmentId={card.apartment.id}
              listType="BOOKMARKED"
              className="h-8 w-8"
            />
          </div>
        </Card>
      </div>
    </motion.div>
  );
}