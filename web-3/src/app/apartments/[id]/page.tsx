"use client";

import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Card } from "~/presentation/components/ui";
import { CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/presentation/components/ui";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { ApartmentImages, ApartmentPrice, ApartmentActions } from "~/presentation/components/apartment";
import { MatchScoreBadge } from "~/components/match-score-badge";
import { ImageGallery, Price, Score } from "~/presentation/components/ui";
import { api } from "~/trpc/react";
import { getApartmentMapsUrl } from "~/lib/maps";
import { 
  ArrowLeft,
  MapPin, 
  Train,
  Clock,
  Home,
  Calendar,
  Ruler,
  Bath,
  Bed,
  Building,
  DollarSign,
  Heart,
  Share2,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Bookmark,
  Star,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { RouteDisplay } from "~/components/route-display";
import { useTargetedApartmentScorer } from "~/hooks/use-targeted-apartment-scorer";

export default function ApartmentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const apartmentId = params.id as string;
  const targetStationId = searchParams.get('station');

  // Fetch apartment details
  const { data: apartment, isLoading, error, refetch } = api.apartment.getById.useQuery({ 
    id: apartmentId 
  });
  
  // Refresh mutation
  const refreshMutation = api.apartment.refreshData.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Refetch apartment data after a delay to allow job to process
      setTimeout(() => {
        refetch();
      }, 3000);
    },
    onError: (error) => {
      toast.error(`Failed to refresh: ${error.message}`);
    },
  });
  
  // Fetch target station details if provided
  const { data: targetStation } = api.station.getById.useQuery(
    { id: targetStationId! },
    { enabled: !!targetStationId }
  );

  // Calculate apartment score
  const { scoreApartments } = useTargetedApartmentScorer({ targetStationId: targetStationId || undefined });
  const scoredApartment = apartment ? scoreApartments([apartment])[0] : null;

  if (isLoading) {
    return (
      <div className="container px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-96 w-full" />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !apartment) {
    return (
      <div className="container px-4 py-8 max-w-6xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || "Apartment not found"}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = (apartment.images || []).map(img => ({
    url: img.url,
    caption: img.caption || undefined
  }));
  const hasMultipleImages = images.length > 1;

  return (
    <div className="container px-4 py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            {/* List toggle buttons are now in the apartment info section */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refreshMutation.mutate({ id: apartment.id })}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshMutation.isPending && "animate-spin")} />
              {refreshMutation.isPending ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Link href={apartment.sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Original
              </Button>
            </Link>
          </div>
        </div>

        {/* Removal Alert */}
        {apartment.removed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This listing has been removed from the source website and may no longer be available.
              {apartment.lastDetailCheck && (
                <span className="block mt-1 text-xs">
                  Last checked: {new Date(apartment.lastDetailCheck).toLocaleString()}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content - Mobile First Layout */}
        <div className="space-y-8">
          {/* Image Gallery - Full width on all screens */}
          <div className="max-w-2xl mx-auto">
            <ApartmentImages images={images} title={apartment.title} />
          </div>

          {/* Title, Price and Property Details - Right after images on mobile */}
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-4 md:col-span-2 order-2 md:order-1">
              {/* Location/Map */}
              <Card>
                <CardHeader>
                  <CardTitle>Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-[4/3] rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-12 w-12 mx-auto mb-2" />
                      <p>Map will be displayed here</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 md:col-span-1 order-1 md:order-2">
            {/* Title and Price */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl font-bold">{apartment.title}</h1>
                {scoredApartment?.score !== undefined && (
                  <MatchScoreBadge score={scoredApartment.score} className="flex-shrink-0" />
                )}
              </div>
              <ApartmentPrice 
                apartment={apartment}
                showBreakdown={true}
              />
              
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <MapPin className="h-3 w-3 mr-1" />
                  {apartment.address || "Address not available"}
                </Badge>
                {apartment.latitude && apartment.longitude && (
                  <Link
                    href={getApartmentMapsUrl(
                      apartment,
                      targetStation || apartment.nearestStations?.[0]?.station
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {targetStation ? "Directions" : "View on Map"}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Property Details */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Size</span>
                      <span className="ml-auto font-medium">
                        {apartment.size ? `${apartment.size} m²` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Layout</span>
                      <span className="ml-auto font-medium">
                        {apartment.layout || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Floor</span>
                      <span className="ml-auto font-medium">
                        {apartment.floor ? `${apartment.floor}F` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Age</span>
                      <span className="ml-auto font-medium">
                        {apartment.buildingAge ? `${apartment.buildingAge} years` : 'N/A'}
                      </span>
                    </div>
                    {apartment.feesJson && typeof apartment.feesJson === 'object' && (
                      <>
                        {(apartment.feesJson as any).deposit !== undefined && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Deposit</span>
                            <span className="ml-auto font-medium">
                              ¥{((apartment.feesJson as any).deposit).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {(apartment.feesJson as any).keyMoney !== undefined && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Key Money</span>
                            <span className="ml-auto font-medium">
                              ¥{((apartment.feesJson as any).keyMoney).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Property */}
            <Link href={apartment.sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Contact Property
              </Button>
            </Link>

            {/* Quick list actions */}
            <ApartmentActions apartment={apartment} />

            {/* Route Display - Show target station route if available */}
            {targetStationId && apartment.routes && (() => {
              const targetRoute = apartment.routes.find(route => route.toStationId === targetStationId);
              if (targetRoute) {
                return (
                  <RouteDisplay 
                    route={targetRoute} 
                    variant="compact"
                    highlighted={true}
                  />
                );
              }
              return null;
            })()}

            {/* Nearest Stations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nearest Stations</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {apartment.nearestStations && apartment.nearestStations.length > 0 ? (
                  <div className="space-y-3">
                    {apartment.nearestStations.map((ns, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Train className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium text-sm">{ns.station.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm">{ns.walkingMinutes} min</div>
                          <div className="text-xs text-muted-foreground">walk</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No station information available
                  </p>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </div>

        {/* Property Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Property Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Property ID</span>
                <p className="font-medium">{apartment.externalId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Source</span>
                <p className="font-medium">{apartment.sourceSite}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Listed</span>
                <p className="font-medium">
                  {new Date(apartment.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Updated</span>
                <p className="font-medium">
                  {new Date(apartment.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            {/* Commute time information if available */}
            {apartment.routes && apartment.routes.length > 0 ? (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Commute Times
                </h4>
                <div className="space-y-2">
                  {apartment.routes.map((route, index) => {
                    const isTargetStation = targetStationId && route.toStationId === targetStationId;
                    console.log('Route data:', route); // Debug log
                    return (
                      <RouteDisplay
                        key={index}
                        route={route}
                        variant="compact"
                        highlighted={isTargetStation || undefined}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
                No commute information available for this apartment
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amenities */}
        {apartment.amenities && apartment.amenities.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Features & Amenities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {apartment.amenities.map((amenity, index) => (
                  <Badge key={index} variant="secondary">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description - At the very bottom */}
        {apartment.description && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {apartment.description}
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}