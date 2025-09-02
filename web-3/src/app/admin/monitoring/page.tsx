"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { PageContainer, PageLoading } from "~/components/layout";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { motion } from "framer-motion";
import { 
  Activity, 
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Calendar,
  Clock,
  XCircle,
  Database,
  FileText,
  Zap,
  Gauge,
  MapPin,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ScraperLogs } from "~/components/admin/scraper-logs";
import { toast } from "sonner";

function GeocodingTab() {
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [updateLimit, setUpdateLimit] = useState<number | "all">(20);
  const [geocodeLimit, setGeocodeLimit] = useState(100);

  const { data: geocodingStats, isLoading: statsLoading, refetch: refetchStats } = api.admin.getGeocodingStats.useQuery();
  
  const updateMutation = api.admin.updateApartmentsWithoutCoordinates.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      refetchStats();
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const batchGeocodeMutation = api.admin.batchGeocode.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      refetchStats();
    },
    onError: (error) => {
      toast.error(`Geocoding failed: ${error.message}`);
    },
  });

  if (statsLoading) {
    return <Card className="p-6"><PageLoading /></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Geocoding Statistics */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Geocoding Statistics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Apartments</p>
            <p className="text-2xl font-bold">{geocodingStats?.total || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Missing Coordinates</p>
            <p className="text-2xl font-bold text-orange-600">{geocodingStats?.missingCoords || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Can Geocode</p>
            <p className="text-2xl font-bold text-green-600">{geocodingStats?.hasAddress || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Percentage Missing</p>
            <p className="text-2xl font-bold">{geocodingStats?.percentMissing || '0%'}</p>
          </div>
        </div>

        {/* Missing by Source */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Missing Coordinates by Source</h3>
          <div className="space-y-2">
            {geocodingStats?.bySource?.map((source) => (
              <div key={source.source} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-medium">{source.source}</span>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{source.count} apartments</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateMutation.mutate({
                        sourceSite: source.source,
                        limit: undefined, // Update all when using quick button
                      });
                    }}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Update
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Update Apartments Without Coordinates */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Update Missing Coordinates</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Re-scrape apartments that are missing GPS coordinates from their original source.
        </p>
        
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Source Site</label>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select a source site" />
              </SelectTrigger>
              <SelectContent>
                {geocodingStats?.bySource?.map((source) => (
                  <SelectItem key={source.source} value={source.source}>
                    {source.source} ({source.count} missing)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-32">
            <label className="text-sm font-medium mb-2 block">Limit</label>
            <Select value={String(updateLimit)} onValueChange={(v) => setUpdateLimit(v === "all" ? "all" : Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              if (selectedSource) {
                updateMutation.mutate({
                  sourceSite: selectedSource,
                  limit: updateLimit === "all" ? undefined : updateLimit,
                });
              }
            }}
            disabled={!selectedSource || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Update Apartments
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Batch Geocoding */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Batch Geocoding</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use OpenStreetMap Nominatim API to geocode apartments that have addresses but missing coordinates.
        </p>
        
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium">{geocodingStats?.hasAddress || 0}</span> apartments can be geocoded
            </p>
          </div>
          
          <div className="w-32">
            <label className="text-sm font-medium mb-2 block">Limit</label>
            <Select value={String(geocodeLimit)} onValueChange={(v) => setGeocodeLimit(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              batchGeocodeMutation.mutate({ limit: geocodeLimit });
            }}
            disabled={batchGeocodeMutation.isPending || !geocodingStats?.hasAddress}
          >
            {batchGeocodeMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Geocoding...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Start Geocoding
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Geocoding uses the OpenStreetMap Nominatim API with a rate limit of 1 request per second.
            Large batches may take several minutes to complete.
          </p>
        </div>
      </Card>
    </div>
  );
}

interface ErrorItemProps {
  error: {
    id: string;
    type: string;
    error?: string | null;
    timestamp?: Date | null;
    attempts: number;
  };
}

function ErrorItem({ error }: ErrorItemProps) {
  return (
    <div className="border rounded p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium">{error.type}</p>
            <p className="text-sm text-muted-foreground">
              Job ID: {error.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">Failed</Badge>
          {error.attempts > 1 && (
            <Badge variant="outline">
              {error.attempts} attempts
            </Badge>
          )}
        </div>
      </div>
      
      {error.error && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-800 font-mono">{error.error}</p>
        </div>
      )}
      
      {error.timestamp && (
        <p className="text-xs text-muted-foreground">
          {new Date(error.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function RemovalsTab() {
  const { data: removalStats, isLoading, refetch } = api.admin.getRemovalStats.useQuery();
  const [batchSize, setBatchSize] = useState(10);
  const [selectedSource, setSelectedSource] = useState<string>("");

  const checkRemovals = api.admin.checkApartmentRemovals.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Checked ${result.checked} apartments. Found ${result.removed} removed listings.`
      );
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to check removals: ${error.message}`);
    },
  });

  const handleCheckRemovals = () => {
    checkRemovals.mutate({
      sourceSite: selectedSource || undefined,
      batchSize,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Removed</p>
              <p className="text-2xl font-bold">{removalStats?.totalRemoved || 0}</p>
            </div>
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Recently Removed (7d)</p>
              <p className="text-2xl font-bold">{removalStats?.recentlyRemoved || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Never Checked</p>
              <p className="text-2xl font-bold">{removalStats?.checkStatus?.neverChecked || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Need Checking</p>
              <p className="text-2xl font-bold">{removalStats?.checkStatus?.needsCheck || 0}</p>
            </div>
            <RefreshCw className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Removal by Source */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Removals by Source</h3>
        <div className="space-y-3">
          {removalStats?.removedBySource && Object.entries(removalStats.removedBySource).map(([source, count]) => (
            <div key={source} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">{source}</span>
              <Badge variant="secondary">{count} removed</Badge>
            </div>
          ))}
          {(!removalStats?.removedBySource || Object.keys(removalStats.removedBySource).length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No removed apartments yet</p>
          )}
        </div>
      </Card>

      {/* Check for Removals */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Check for Removed Listings</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Source Site</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All sources</SelectItem>
                  <SelectItem value="yolo-japan">YOLO Japan</SelectItem>
                  <SelectItem value="wagaya-japan">Wagaya Japan</SelectItem>
                  <SelectItem value="realestate">RealEstate.co.jp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Batch Size</label>
              <Select value={String(batchSize)} onValueChange={(v) => setBatchSize(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 apartments</SelectItem>
                  <SelectItem value="10">10 apartments</SelectItem>
                  <SelectItem value="20">20 apartments</SelectItem>
                  <SelectItem value="50">50 apartments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleCheckRemovals}
            disabled={checkRemovals.isPending}
            className="w-full"
          >
            {checkRemovals.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking apartments...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Check for Removals
              </>
            )}
          </Button>

          <div className="text-sm text-muted-foreground">
            <p>This will check if apartments are still available on their source websites.</p>
            <p>Apartments older than 7 days will be checked first.</p>
          </div>
        </div>
      </Card>

      {/* Recent Check Results */}
      {checkRemovals.data && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Check Results</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Checked:</span>
              <span className="font-medium">{checkRemovals.data.checked}</span>
            </div>
            <div className="flex justify-between">
              <span>Removed:</span>
              <span className="font-medium text-red-600">{checkRemovals.data.removed}</span>
            </div>
            <div className="flex justify-between">
              <span>Errors:</span>
              <span className="font-medium text-yellow-600">{checkRemovals.data.errors}</span>
            </div>
          </div>

          {checkRemovals.data.details.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Details:</h4>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {checkRemovals.data.details.map((detail, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded ${
                      detail.result === 'removed'
                        ? 'bg-red-100 text-red-700'
                        : detail.result === 'error'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    <span className="font-medium">{detail.sourceSite} - {detail.externalId}:</span>{' '}
                    {detail.result === 'removed' && detail.reason ? detail.reason : detail.result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const [errorLimit, setErrorLimit] = useState(20);
  const [historyDays, setHistoryDays] = useState(7);
  const [scraperFilter, setScraperFilter] = useState<string | undefined>(undefined);

  const { data: errors, isLoading: errorsLoading } = api.admin.getRecentErrors.useQuery({
    limit: errorLimit,
  });

  const { data: scrapingHistory, isLoading: historyLoading, refetch } = api.admin.getScrapingHistory.useQuery({
    scraperType: scraperFilter,
    days: historyDays,
  });

  const { data: health } = api.admin.getSystemHealth.useQuery();

  if (errorsLoading || historyLoading) {
    return (
      <PageContainer>
        <PageLoading />
      </PageContainer>
    );
  }

  // Process scraping history for chart
  const chartData = scrapingHistory
    ? Object.entries(
        scrapingHistory.reduce((acc, item) => {
          const date = new Date(item.date).toLocaleDateString();
          if (!acc[date]) {
            acc[date] = { date };
          }
          acc[date][item.source] = item.count;
          return acc;
        }, {} as Record<string, any>)
      )
        .map(([_, data]) => data)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  // Get unique scraper types from history
  const scraperTypes = Array.from(
    new Set(scrapingHistory?.map(item => item.source) || [])
  );

  // Calculate total scraped
  const totalScraped = scrapingHistory?.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-muted-foreground mt-1">
              Track system health and scraping activity
            </p>
          </div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <p className="text-lg font-semibold">
                  {health?.status === "healthy" ? "Healthy" : "Degraded"}
                </p>
              </div>
              <Activity 
                className={`w-8 h-8 ${
                  health?.status === "healthy" ? "text-green-600" : "text-red-600"
                }`} 
              />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Errors</p>
                <p className="text-lg font-semibold">{errors?.length || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scraped</p>
                <p className="text-lg font-semibold">{totalScraped.toLocaleString()}</p>
              </div>
              <Database className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sources</p>
                <p className="text-lg font-semibold">{scraperTypes.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </Card>
        </div>

        {/* Tabs for different monitoring views */}
        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="logs">Scraper Logs</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="geocoding">Geocoding</TabsTrigger>
            <TabsTrigger value="removals">Removals</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            {/* Scraping History Chart */}
            <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Scraping Activity</h2>
            <div className="flex gap-2">
              <Select value={String(historyDays)} onValueChange={(v) => setHistoryDays(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={scraperFilter || "all"} onValueChange={(v) => setScraperFilter(v === "all" ? undefined : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scrapers</SelectItem>
                  {scraperTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                {scraperTypes.map((type, index) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke={`hsl(${index * 60}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Scraper Mode</p>
                    <p className="text-lg font-semibold">
                      {process.env.NEXT_PUBLIC_USE_FAST_SCRAPERS === 'true' ? 'Fast' : 'Standard'}
                    </p>
                  </div>
                  <Zap className="w-8 h-8 text-yellow-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Proxy Strategy</p>
                    <p className="text-lg font-semibold">
                      {process.env.NEXT_PUBLIC_PROXY_ROTATION_STRATEGY || 'round-robin'}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Concurrency</p>
                    <p className="text-lg font-semibold">5 requests</p>
                  </div>
                  <Gauge className="w-8 h-8 text-green-600" />
                </div>
              </Card>
            </div>

            {/* Performance Comparison */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Scraper Performance Comparison</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground">
                  <div>Scraper</div>
                  <div>Avg Response Time</div>
                  <div>Success Rate</div>
                  <div>Requests/min</div>
                </div>
                {scraperTypes.map(type => (
                  <div key={type} className="grid grid-cols-4 gap-4 py-2 border-t">
                    <div className="font-medium">{type}</div>
                    <div>1.2s</div>
                    <div className="text-green-600">98%</div>
                    <div>45</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Proxy Health */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Proxy Health Status</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Proxies</span>
                  <span className="font-medium">1000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Healthy Proxies</span>
                  <span className="font-medium text-green-600">850</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Latency</span>
                  <span className="font-medium">1.2s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Blacklisted</span>
                  <span className="font-medium text-red-600">150</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Optimization Tips:</p>
                <ul className="text-sm space-y-1">
                  <li>• Run <code className="text-xs bg-muted px-1 py-0.5 rounded">npx tsx optimize-proxy-config.ts</code> to refresh proxy list</li>
                  <li>• Enable fast scrapers with <code className="text-xs bg-muted px-1 py-0.5 rounded">USE_FAST_SCRAPERS=true</code></li>
                  <li>• Use performance rotation strategy for best speed</li>
                </ul>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <ScraperLogs />
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            {/* Recent Errors */}
            <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Errors</h2>
            <Select value={String(errorLimit)} onValueChange={(v) => setErrorLimit(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Last 10</SelectItem>
                <SelectItem value="20">Last 20</SelectItem>
                <SelectItem value="50">Last 50</SelectItem>
                <SelectItem value="100">Last 100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errors && errors.length > 0 ? (
            <div className="space-y-4">
              {errors.map((error) => (
                <ErrorItem key={error.id} error={error} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent errors found</p>
            </div>
          )}
            </Card>
          </TabsContent>

          <TabsContent value="geocoding" className="space-y-4">
            <GeocodingTab />
          </TabsContent>

          <TabsContent value="removals" className="space-y-4">
            <RemovalsTab />
          </TabsContent>
        </Tabs>
      </motion.div>
    </PageContainer>
  );
}