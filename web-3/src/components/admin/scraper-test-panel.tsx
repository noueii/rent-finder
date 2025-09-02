"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { 
  TestTube, 
  Search, 
  Link as LinkIcon,
  Copy,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Turtle,
  Code,
  Image,
  MapPin,
  Home,
  DollarSign,
  Ruler,
  Calendar,
  Trash2,
  Ban
} from "lucide-react";
import { cn } from "~/lib/utils";

interface ScraperTestPanelProps {
  scraperType: string;
  scraperName: string;
}

const EXAMPLE_URLS = {
  'realestate': 'https://realestate.co.jp/en/rent/view/1249374',
  'yolo-japan': 'https://home.yolo-japan.com/en/property/1411616',
  'wagaya-japan': 'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
  'e-housing': 'https://e-housing.jp/rent/tokyo/sumida/isle-premium-oshiage-nord/505',
  'metro-residences': 'https://www.metroresidences.com/jp-en/apartment-rental/tokyo/chuo/grand-palace-tokyo-yaesu-avenue/45032',
} as const;

export function ScraperTestPanel({ scraperType, scraperName }: ScraperTestPanelProps) {
  const [detailUrl, setDetailUrl] = useState('');
  const [mode, setMode] = useState<'fast' | 'normal'>('normal');
  const [searchParams, setSearchParams] = useState({
    minPrice: 50000,
    maxPrice: 200000,
    minSize: 20,
    maxSize: 80,
    limit: 10,
    fetchAll: false,
    updatedWithin: undefined as number | undefined,
  });
  const [showRawData, setShowRawData] = useState(false);

  // Test detail page mutation - now with mode support
  const testDetail = api.admin.testScraperDetail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Detail page scraped successfully!');
      } else {
        toast.error(`Scraping failed: ${data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Test search mutation - now with mode support
  const testSearch = api.admin.testScraperSearch.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const count = data.data?.length || 0;
        toast.success(`Found ${count} apartments!`);
      } else {
        toast.error(`Search failed: ${data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleTestDetail = () => {
    if (!detailUrl) {
      toast.error('Please enter a detail page URL');
      return;
    }
    
    // For now, detail page testing always uses normal mode
    // since fast scrapers don't support detail pages
    testDetail.mutate({
      scraperType: scraperType as any,
      url: detailUrl,
    });
  };

  const handleTestSearch = () => {
    // Pass the scraper type as-is, the factory will handle mode selection
    testSearch.mutate({
      scraperType: scraperType as any,
      params: searchParams,
      mode, // We'll need to add this to the API
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test {scraperName}
        </CardTitle>
        <CardDescription>
          Test the scraper's functionality with different modes and parameters
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mode Selection */}
        <div className="mb-6">
          <Label>Scraper Mode</Label>
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'fast' | 'normal')} className="mt-2">
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="normal" id={`${scraperType}-normal`} />
              <Label htmlFor={`${scraperType}-normal`} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Turtle className="h-4 w-4" />
                  <span className="font-medium">Normal Mode</span>
                  <Badge variant="secondary">Full Details</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Fetches detail pages for comprehensive data
                </p>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="fast" id={`${scraperType}-fast`} />
              <Label htmlFor={`${scraperType}-fast`} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Fast Mode</span>
                  <Badge variant="secondary">Quick Scan</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Quick updates from search results only
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Tabs defaultValue="detail" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detail">Detail Page Test (Normal Mode Only)</TabsTrigger>
            <TabsTrigger value="search">Search Test</TabsTrigger>
          </TabsList>

          {/* Detail Page Test Tab */}
          <TabsContent value="detail" className="space-y-4">
            {mode === 'fast' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Detail page testing always uses normal mode. Fast scrapers only support search operations.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label>Detail Page URL</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={detailUrl}
                  onChange={(e) => setDetailUrl(e.target.value)}
                  placeholder={EXAMPLE_URLS[scraperType as keyof typeof EXAMPLE_URLS]}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDetailUrl(EXAMPLE_URLS[scraperType as keyof typeof EXAMPLE_URLS] || '')}
                  title="Use example URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(detailUrl, '_blank')}
                  disabled={!detailUrl}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button 
              onClick={handleTestDetail} 
              disabled={testDetail.isPending || !detailUrl}
              className="w-full"
            >
              {testDetail.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Testing Detail Page...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Detail Page Scraping
                </>
              )}
            </Button>

            {/* Detail Test Results */}
            {testDetail.data && (
              <div className="space-y-4">
                <Alert className={testDetail.data.success ? 'border-green-500' : 'border-red-500'}>
                  <div className="flex items-center gap-2">
                    {testDetail.data.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <AlertDescription className="font-medium">
                      {testDetail.data.success ? 'Successfully scraped detail page' : 'Failed to scrape detail page'}
                    </AlertDescription>
                  </div>
                </Alert>

                {testDetail.data.success && testDetail.data.data && (
                  <div className="space-y-4">
                    {/* Check if listing is removed */}
                    {testDetail.data.data._isRemoved && (
                      <Alert variant="destructive" className="border-orange-500">
                        <Ban className="h-4 w-4" />
                        <AlertDescription>
                          <span className="font-semibold">This listing has been removed!</span>
                          <br />
                          <span className="text-sm">{testDetail.data.data._removalReason || 'Property is no longer available'}</span>
                          {testDetail.data.data._removalConfidence && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {testDetail.data.data._removalConfidence} confidence
                            </Badge>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Summary Card */}
                    <Card className={testDetail.data.data._isRemoved ? 'opacity-60' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{testDetail.data.data.title || 'Property Details'}</CardTitle>
                          {testDetail.data.data._isRemoved && (
                            <Badge variant="destructive" className="ml-2">
                              <Trash2 className="h-3 w-3 mr-1" />
                              Removed
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Price:</span>
                              <span className="font-medium">¥{testDetail.data.data.price?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Ruler className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Size:</span>
                              <span className="font-medium">{testDetail.data.data.size}m²</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Layout:</span>
                              <span className="font-medium">{testDetail.data.data.layout || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Area:</span>
                              <span className="font-medium">{testDetail.data.data.area || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Age:</span>
                              <span className="font-medium">{testDetail.data.data.buildingAge || 'N/A'} years</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Image className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Images:</span>
                              <span className="font-medium">{testDetail.data.data.images?.length || 0}</span>
                            </div>
                          </div>
                        </div>

                        {/* Address */}
                        {testDetail.data.data.address && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-muted-foreground">Address</p>
                            <p className="text-sm">{testDetail.data.data.address}</p>
                          </div>
                        )}

                        {/* Stations */}
                        {testDetail.data.data.nearestStations && testDetail.data.data.nearestStations.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-muted-foreground mb-2">Nearest Stations</p>
                            <div className="space-y-1">
                              {testDetail.data.data.nearestStations.map((station: any, idx: number) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{station.name}</span>
                                  <span className="text-muted-foreground"> - {station.walkingMinutes} min walk</span>
                                  {station.lines && station.lines.length > 0 && (
                                    <span className="text-muted-foreground"> ({station.lines.join(', ')})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Extracted Data Indicators */}
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground mb-2">Extracted Data</p>
                          <div className="flex flex-wrap gap-2">
                            {testDetail.data.data.description && (
                              <Badge variant="secondary">Description</Badge>
                            )}
                            {testDetail.data.data.amenities && testDetail.data.data.amenities.length > 0 && (
                              <Badge variant="secondary">{testDetail.data.data.amenities.length} Amenities</Badge>
                            )}
                            {testDetail.data.data.latitude && testDetail.data.data.longitude && (
                              <Badge variant="secondary">Coordinates</Badge>
                            )}
                            {testDetail.data.data.feesTotal !== undefined && testDetail.data.data.feesTotal !== null && (
                              <Badge variant="secondary">Fees: ¥{testDetail.data.data.feesTotal.toLocaleString()}</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* HTTP Response Details (for removed listings) */}
                    {testDetail.data.data._isRemoved && testDetail.data.data._httpResponse && (
                      <Card className="border-orange-500/50">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            HTTP Response Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Status Code:</span>
                              <Badge variant={testDetail.data.data._httpResponse.statusCode === 404 ? 'destructive' : 'secondary'}>
                                {testDetail.data.data._httpResponse.statusCode} {testDetail.data.data._httpResponse.statusText}
                              </Badge>
                            </div>
                            {testDetail.data.data._httpResponse.redirected && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Redirected:</span>
                                  <Badge variant="destructive">Yes</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Redirect Count:</span>
                                  <span>{testDetail.data.data._httpResponse.redirectCount}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-muted-foreground">Final URL:</span>
                                  <code className="text-xs bg-muted p-1 rounded break-all">
                                    {testDetail.data.data._httpResponse.finalUrl}
                                  </code>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Raw Data */}
                    <Collapsible open={showRawData} onOpenChange={setShowRawData}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <Code className="mr-2 h-4 w-4" />
                          {showRawData ? 'Hide' : 'Show'} Raw Data
                          <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", showRawData && "rotate-180")} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <Card>
                          <CardContent className="pt-6">
                            <pre className="text-xs overflow-auto max-h-96 p-4 bg-muted rounded-lg">
                              {JSON.stringify(testDetail.data.data, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {!testDetail.data.success && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {testDetail.data.error || 'Unknown error occurred'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          {/* Search Test Tab */}
          <TabsContent value="search" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price Range (¥)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    value={searchParams.minPrice}
                    onChange={(e) => setSearchParams(p => ({ ...p, minPrice: parseInt(e.target.value) || 0 }))}
                    placeholder="Min"
                  />
                  <Input
                    type="number"
                    value={searchParams.maxPrice}
                    onChange={(e) => setSearchParams(p => ({ ...p, maxPrice: parseInt(e.target.value) || 0 }))}
                    placeholder="Max"
                  />
                </div>
              </div>

              <div>
                <Label>Size Range (m²)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    value={searchParams.minSize}
                    onChange={(e) => setSearchParams(p => ({ ...p, minSize: parseInt(e.target.value) || 0 }))}
                    placeholder="Min"
                  />
                  <Input
                    type="number"
                    value={searchParams.maxSize}
                    onChange={(e) => setSearchParams(p => ({ ...p, maxSize: parseInt(e.target.value) || 0 }))}
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Result Limit</Label>
                <Input
                  type="number"
                  value={searchParams.limit}
                  onChange={(e) => setSearchParams(p => ({ ...p, limit: parseInt(e.target.value) || 5 }))}
                  min={1}
                  max={50}
                  className="w-32 mt-2"
                  disabled={searchParams.fetchAll}
                />
              </div>
              
              {/* Updated Within filter - only for RealEstate.co.jp */}
              {scraperType === 'realestate' && (
                <div>
                  <Label>Updated Within</Label>
                  <select
                    value={searchParams.updatedWithin || ''}
                    onChange={(e) => setSearchParams(p => ({ ...p, updatedWithin: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="mt-2 block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value="">All</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`${scraperType}-fetchAll`}
                checked={searchParams.fetchAll}
                onChange={(e) => setSearchParams(p => ({ ...p, fetchAll: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor={`${scraperType}-fetchAll`} className="cursor-pointer">
                Fetch all available pages (ignores limit{scraperType === 'realestate' && searchParams.updatedWithin ? `, respects updated within filter` : ''})
              </Label>
            </div>

            <Button 
              onClick={handleTestSearch} 
              disabled={testSearch.isPending}
              className="w-full"
            >
              {testSearch.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Test Search
                </>
              )}
            </Button>

            {/* Search Results */}
            {testSearch.data && (
              <div className="space-y-4">
                <Alert className={testSearch.data.success ? 'border-green-500' : 'border-red-500'}>
                  <div className="flex items-center gap-2">
                    {testSearch.data.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <AlertDescription className="font-medium">
                      {testSearch.data.success 
                        ? `Found ${testSearch.data.data?.length || 0} apartments`
                        : 'Search failed'}
                    </AlertDescription>
                  </div>
                </Alert>

                {testSearch.data.success && testSearch.data.data && testSearch.data.data.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing first {Math.min(5, testSearch.data.data.length)} results:
                      </p>
                      {testSearch.data.data.some((apt: any) => apt._isRemoved) && (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {testSearch.data.data.filter((apt: any) => apt._isRemoved).length} removed
                        </Badge>
                      )}
                    </div>
                    {testSearch.data.data.slice(0, 5).map((apt: any, idx: number) => (
                      <Card key={idx} className={apt._isRemoved ? 'border-red-500/50 opacity-75' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{apt.title}</p>
                                {apt._isRemoved && (
                                  <Badge variant="destructive" className="text-xs">
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Removed
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                <span>¥{apt.price ? apt.price.toLocaleString() : '0'}</span>
                                <span>{apt.size || 0}m²</span>
                                {apt.layout && <span>{apt.layout}</span>}
                                {apt.availability && (
                                  <Badge 
                                    variant={apt.availability === 'available' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {apt.availability}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{apt.address}</p>
                              {apt._isRemoved && apt._removalReason && (
                                <p className="text-xs text-red-600 mt-1">
                                  {apt._removalReason}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(apt.sourceUrl, '_blank')}
                                title="Open in browser"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              {apt._isRemoved && (
                                <div className="flex items-center justify-center w-8 h-8">
                                  <Ban className="h-4 w-4 text-red-500" />
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {testSearch.data.data.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ... and {testSearch.data.data.length - 5} more
                      </p>
                    )}
                  </div>
                )}

                {!testSearch.data.success && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {testSearch.data.error || 'Unknown error occurred'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}