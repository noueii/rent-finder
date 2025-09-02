"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, Badge } from "~/presentation/components/ui";
import { CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import { 
  Layers, 
  Clock, 
  Users, 
  Lock,
  ChevronRight,
  Search,
  Heart,
  AlertCircle,
  LogIn
} from "lucide-react";

export default function BrowsePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedType, setSelectedType] = useState<'search' | 'custom' | 'system'>('search');

  // Fetch user's lists (only if authenticated)
  const { data: lists, isLoading, error } = api.list.getUserLists.useQuery(
    { includeCount: true },
    { enabled: status === 'authenticated' }
  );

  const handleSelectList = (listId: string) => {
    router.push(`/browse/${listId}`);
  };

  // Filter lists by type
  const searchLists = lists?.filter(list => list.type === 'SEARCH_RESULT') || [];
  const customLists = lists?.filter(list => list.type === 'CUSTOM') || [];
  const systemLists = lists?.filter(list => 
    list.type === 'BOOKMARKED' || 
    list.type === 'LIKED' || 
    list.type === 'FAVORITED' ||
    list.type === 'HIDDEN'
  ) || [];
  
  const displayLists = selectedType === 'search' ? searchLists : 
                       selectedType === 'custom' ? customLists : 
                       systemLists;
  
  // Debug logging - must be before any conditional returns
  useEffect(() => {
    console.log('Browse page debug:');
    console.log('- Loading:', isLoading);
    console.log('- Error:', error);
    console.log('- All lists:', lists);
    console.log('- Search lists:', searchLists);
    console.log('- Custom lists:', customLists);
    console.log('- System lists:', systemLists);
    console.log('- Selected type:', selectedType);
    console.log('- Display lists:', displayLists);
  }, [lists, isLoading, error, selectedType, searchLists, customLists, systemLists, displayLists]);

  // Show login prompt if not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="container px-4 py-8">
        <Card className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <LogIn className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You need to sign in to browse your apartment lists
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/auth/signin">
                Sign In to Continue
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || status === 'loading') {
    return (
      <div className="container px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Failed to load lists:', error);
    return (
      <div className="container px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load lists: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  return (
    <div className="container px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Browse Apartments</h1>
          <p className="mt-2 text-muted-foreground">
            Select a list to start swiping through apartments
          </p>
        </div>

        {/* List Type Selector */}
        <div className="mb-6 flex justify-center gap-2 flex-wrap">
          <Button
            variant={selectedType === 'search' ? 'default' : 'outline'}
            onClick={() => setSelectedType('search')}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            Search Results ({searchLists.length})
          </Button>
          <Button
            variant={selectedType === 'custom' ? 'default' : 'outline'}
            onClick={() => setSelectedType('custom')}
            className="gap-2"
          >
            <Layers className="h-4 w-4" />
            My Lists ({customLists.length})
          </Button>
          <Button
            variant={selectedType === 'system' ? 'default' : 'outline'}
            onClick={() => setSelectedType('system')}
            className="gap-2"
          >
            <Heart className="h-4 w-4" />
            Saved Lists ({systemLists.length})
          </Button>
        </div>

        {/* Lists Grid */}
        {displayLists.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent>
              <p className="text-muted-foreground">
                {selectedType === 'search' 
                  ? "You haven't performed any searches yet."
                  : selectedType === 'custom'
                  ? "You haven't created any custom lists yet."
                  : "You haven't saved any apartments to your lists yet."}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push(selectedType === 'search' ? '/search' : '/lists')}
              >
                {selectedType === 'search' ? 'Search Apartments' : 
                 selectedType === 'custom' ? 'Create a List' : 
                 'Browse Apartments'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {displayLists.map((list) => (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <Card 
                  className="cursor-pointer transition-shadow hover:shadow-lg"
                  onClick={() => handleSelectList(list.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="line-clamp-1">
                          {list.name}
                        </CardTitle>
                        {list.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {list.description}
                          </CardDescription>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-2 min-w-0">
                        <Badge variant="secondary" className="gap-1">
                          <Layers className="h-3 w-3" />
                          {list.totalApartments || list._count?.apartments || 0} apartments
                        </Badge>
                        {list.type === 'SEARCH_RESULT' && (
                          <Badge variant="outline" className="gap-1">
                            Commute
                          </Badge>
                        )}
                        {list.type === 'CUSTOM' && (
                          <Badge variant="outline" className="gap-1">
                            Custom
                          </Badge>
                        )}
                        {list.type !== 'SEARCH_RESULT' && list.type !== 'CUSTOM' && (
                          <Badge variant="outline" className="gap-1">
                            {list.type.charAt(0) + list.type.slice(1).toLowerCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {list.isPublic ? (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(list.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}