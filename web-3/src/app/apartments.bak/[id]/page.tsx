"use client";

import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { CommutePath } from "~/components/commute-path";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  MapPin, 
  Train, 
  Home, 
  Calendar, 
  Maximize, 
  Heart,
  Share2,
  ExternalLink
} from "lucide-react";

// Dynamic import for map component to avoid SSR issues
const ApartmentDetailMap = dynamic(
  () => import("~/components/map").then((mod) => mod.ApartmentDetailMap),
  { 
    ssr: false,
    loading: () => (
      <div className="aspect-square rounded bg-muted animate-pulse">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <MapPin className="h-8 w-8" />
        </div>
      </div>
    )
  }
);

export default function ApartmentPage() {
  const params = useParams();
  const { data: session } = useSession();
  const id = params?.id as string;
  
  // Fetch apartment data
  const { data: apartment, isLoading } = api.apartment.getById.useQuery({ id }, {
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!apartment) {
    notFound();
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/search">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Search
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Heart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <Card className="overflow-hidden">
              <div className="relative aspect-[16/9]">
                {apartment.images.length > 0 ? (
                  <Image
                    src={apartment.images[0]?.url || ""}
                    alt={apartment.title}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <Home className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              {apartment.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 p-4">
                  {apartment.images.slice(1, 5).map((image, index) => (
                    <div key={image.id} className="relative aspect-square overflow-hidden rounded">
                      <Image
                        src={image.url}
                        alt={`${apartment.title} - Image ${index + 2}`}
                        fill
                        className="object-cover"
                      />
                      {index === 3 && apartment.images.length > 5 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <span className="text-lg font-semibold text-white">
                            +{apartment.images.length - 5}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Property Details */}
            <Card className="p-6">
              <h1 className="mb-4 text-2xl font-bold">{apartment.title}</h1>
              
              <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {apartment.address}
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-xl font-semibold">{formatPrice(apartment.price)}/month</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Size</p>
                  <p className="text-xl font-semibold">{apartment.size}m²</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Layout</p>
                  <p className="text-xl font-semibold">{apartment.layout || "N/A"}</p>
                </div>
                {apartment.floor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Floor</p>
                    <p className="text-xl font-semibold">
                      {apartment.floor}F{apartment.totalFloors && ` / ${apartment.totalFloors}F`}
                    </p>
                  </div>
                )}
                {apartment.buildingAge && (
                  <div>
                    <p className="text-sm text-muted-foreground">Building Age</p>
                    <p className="text-xl font-semibold">{apartment.buildingAge} years</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Availability</p>
                  <Badge variant={apartment.availability === "available" ? "default" : "secondary"}>
                    {apartment.availability}
                  </Badge>
                </div>
              </div>

              {apartment.description && (
                <div className="border-t pt-6">
                  <h3 className="mb-3 text-lg font-semibold">Description</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {apartment.description}
                  </p>
                </div>
              )}

              {apartment.amenities.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="mb-3 text-lg font-semibold">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {apartment.amenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Nearest Stations */}
            {apartment.nearestStations.length > 0 && (
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold">Nearest Stations</h3>
                <div className="space-y-3">
                  {apartment.nearestStations.map((ns) => (
                    <div key={ns.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Train className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{ns.station.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {ns.distance ? `${ns.distance}m` : "Distance unknown"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{ns.walkingMinutes} min walk</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Location Map */}
            {(apartment.latitude && apartment.longitude) && (
              <Card className="overflow-hidden">
                <div className="p-6 pb-0">
                  <h3 className="mb-4 text-lg font-semibold">Location Map</h3>
                </div>
                <ApartmentDetailMap 
                  apartment={apartment} 
                  height="h-[500px]"
                  className="border-t"
                />
              </Card>
            )}

            {/* Commute Information */}
            {session && (
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-semibold">Commute Information</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in and set your workplace to see commute times from this apartment.
                </p>
                {/* CommutePath component would be used here when routes are available */}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <Card className="p-6">
              <div className="mb-4 text-center">
                <p className="text-3xl font-bold">{formatPrice(apartment.price)}</p>
                <p className="text-sm text-muted-foreground">per month</p>
              </div>
              
              <div className="space-y-3">
                <Button className="w-full" size="lg" asChild>
                  <a href={apartment.sourceUrl} target="_blank" rel="noopener noreferrer">
                    View on {apartment.sourceSite}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                {session && (
                  <>
                    <Button variant="outline" className="w-full">
                      <Heart className="mr-2 h-4 w-4" />
                      Add to Favorites
                    </Button>
                    <Button variant="outline" className="w-full">
                      Add to List
                    </Button>
                  </>
                )}
              </div>
            </Card>

            {/* Quick Info */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Quick Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Listed</span>
                  <span>{formatDate(apartment.scrapedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Property ID</span>
                  <span className="font-mono">{apartment.externalId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span>{apartment.sourceSite}</span>
                </div>
              </div>
            </Card>

            {/* Interactive Map */}
            <Card className="overflow-hidden">
              <div className="p-6 pb-0">
                <h3 className="mb-4 text-lg font-semibold">Location</h3>
              </div>
              <ApartmentDetailMap 
                apartment={apartment} 
                height="h-[400px]"
                className="border-t"
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}