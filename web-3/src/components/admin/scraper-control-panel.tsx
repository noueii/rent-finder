'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Slider } from '~/components/ui/slider';
import { 
  Play, 
  Pause, 
  Download, 
  Settings, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface ScraperConfig {
  enabled: boolean;
  rateLimit: number;
  maxPages: number;
  fetchAll: boolean;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxSize?: number;
    layout?: string[];
    updatedWithin?: number; // For RealEstate.co.jp
  };
}

interface ScraperControlPanelProps {
  scraper: {
    id: string;
    name: string;
    type: string;
    baseUrl: string;
    isActive: boolean;
    lastScraped?: Date | null;
    rateLimit: number;
  };
}

export function ScraperControlPanel({ scraper }: ScraperControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [config, setConfig] = useState<ScraperConfig>({
    enabled: scraper.isActive,
    rateLimit: scraper.rateLimit,
    maxPages: 10,
    fetchAll: false,
    filters: {
      minPrice: 50000,
      maxPrice: 300000,
      minSize: 20,
      maxSize: 100,
    }
  });

  const utils = api.useContext();
  
  // Check if this scraper is currently running
  const { data: jobs } = api.admin.getJobs.useQuery(
    {
      type: 'scrape-apartment-list',
      status: 'processing',
    },
    {
      refetchInterval: 2000, // Refetch every 2 seconds when a scraper is running
      refetchIntervalInBackground: true,
    }
  );
  
  const isScraperRunning = jobs?.some(
    (job: any) => job.data?.scraperType === scraper.type && job.status === 'processing'
  ) || false;
  
  // Mutations
  const updateScraperMutation = api.admin.updateScraperConfig.useMutation({
    onSuccess: () => {
      toast.success('Scraper configuration updated');
      utils.admin.getScrapers.invalidate();
    },
  });

  const runScraperMutation = api.admin.runScraper.useMutation({
    onSuccess: (data) => {
      toast.success(`Scraper started: ${data.jobId}`);
      // Invalidate jobs query to show the new job immediately
      utils.admin.getJobs.invalidate();
    },
    onError: (error) => {
      if (error.message.includes('already running')) {
        toast.warning(error.message);
      } else {
        toast.error(`Failed to start scraper: ${error.message}`);
      }
    },
  });

  const fetchAllMutation = api.admin.fetchAllFromScraper.useMutation({
    onSuccess: (data) => {
      toast.success(`Fetch all started: ${data.jobId}`);
      // Invalidate jobs query to show the new job immediately
      utils.admin.getJobs.invalidate();
    },
    onError: (error) => {
      if (error.message.includes('already running')) {
        toast.warning(error.message);
      } else {
        toast.error(`Failed to start fetch all: ${error.message}`);
      }
    },
  });

  const handleUpdateConfig = () => {
    updateScraperMutation.mutate({
      id: scraper.id,
      updates: {
        isActive: config.enabled,
        rateLimit: config.rateLimit,
      }
    });
  };

  const handleRunScraper = () => {
    runScraperMutation.mutate({
      scraperType: scraper.type,
      params: {
        ...config.filters,
        limit: config.fetchAll ? undefined : config.maxPages * 15, // 15 items per page
        fetchAll: false,
        updatedWithin: config.filters.updatedWithin, // Include updatedWithin
      }
    });
  };

  const handleFetchAll = () => {
    const confirmMessage = scraper.type === 'realestate' && config.filters.updatedWithin
      ? `This will fetch ALL apartments updated within the last ${config.filters.updatedWithin} days from RealEstate.co.jp. This may take a long time. Continue?`
      : 'This will fetch ALL available apartments from this source. This may take a long time and should be used carefully. Continue?';
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    fetchAllMutation.mutate({
      scraperType: scraper.type,
      params: {
        ...config.filters,
        fetchAll: true,
        updatedWithin: config.filters.updatedWithin, // Include updatedWithin
      }
    });
  };

  const getStatusBadge = () => {
    // Only show running if there's an actual job in the database
    if (isScraperRunning) {
      return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
    }
    if (config.enabled) {
      return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    }
    return <Badge variant="outline"><Pause className="w-3 h-3 mr-1" />Inactive</Badge>;
  };

  const isRunning = isScraperRunning;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`w-full ${isRunning ? 'border-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Globe className={`w-6 h-6 ${isRunning ? 'text-blue-500 animate-pulse' : 'text-muted-foreground'}`} />
              <div>
                <CardTitle className="text-lg">{scraper.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs">{scraper.baseUrl}</span>
                  {scraper.lastScraped && (
                    <span className="text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last run: {new Date(scraper.lastScraped).toLocaleDateString()}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={handleRunScraper}
                disabled={!config.enabled || isRunning || runScraperMutation.isPending}
                size="sm"
              >
                <Play className="w-4 h-4 mr-1" />
                Run Now
              </Button>
              <Button 
                onClick={handleFetchAll}
                disabled={!config.enabled || isRunning || fetchAllMutation.isPending}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-1" />
                Fetch All
              </Button>
              <Button
                onClick={handleUpdateConfig}
                disabled={updateScraperMutation.isPending}
                variant="outline"
                size="sm"
              >
                <Settings className="w-4 h-4 mr-1" />
                Save Config
              </Button>
            </div>

            {/* Configuration */}
            <div className="space-y-4">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <Label htmlFor={`enable-${scraper.id}`} className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Enable Scraper
                </Label>
                <Switch
                  id={`enable-${scraper.id}`}
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              {/* Rate Limit */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Rate Limit</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {config.rateLimit}ms between requests
                  </span>
                </Label>
                <Slider
                  value={[config.rateLimit]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, rateLimit: value ?? prev.rateLimit }))}
                  min={500}
                  max={5000}
                  step={100}
                  className="w-full"
                />
              </div>

              {/* Max Pages */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Max Pages (Regular Run)</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ~{config.maxPages * 15} apartments
                  </span>
                </Label>
                <Slider
                  value={[config.maxPages]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, maxPages: value ?? prev.maxPages }))}
                  min={1}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Filters */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium">Search Filters</h4>
                
                {/* Price Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`minPrice-${scraper.id}`}>Min Price (¥)</Label>
                    <Input
                      id={`minPrice-${scraper.id}`}
                      type="number"
                      value={config.filters.minPrice}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, minPrice: parseInt(e.target.value) || undefined }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`maxPrice-${scraper.id}`}>Max Price (¥)</Label>
                    <Input
                      id={`maxPrice-${scraper.id}`}
                      type="number"
                      value={config.filters.maxPrice}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, maxPrice: parseInt(e.target.value) || undefined }
                      }))}
                    />
                  </div>
                </div>

                {/* Size Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`minSize-${scraper.id}`}>Min Size (m²)</Label>
                    <Input
                      id={`minSize-${scraper.id}`}
                      type="number"
                      value={config.filters.minSize}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, minSize: parseInt(e.target.value) || undefined }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`maxSize-${scraper.id}`}>Max Size (m²)</Label>
                    <Input
                      id={`maxSize-${scraper.id}`}
                      type="number"
                      value={config.filters.maxSize}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, maxSize: parseInt(e.target.value) || undefined }
                      }))}
                    />
                  </div>
                </div>

                {/* Updated Within filter - only for RealEstate.co.jp */}
                {scraper.type === 'realestate' && (
                  <div className="space-y-2">
                    <Label htmlFor={`updatedWithin-${scraper.id}`}>Updated Within</Label>
                    <Select
                      value={config.filters.updatedWithin?.toString() || 'all'}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, updatedWithin: value === 'all' ? undefined : parseInt(value) }
                      }))}
                    >
                      <SelectTrigger id={`updatedWithin-${scraper.id}`}>
                        <SelectValue placeholder="All listings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All listings</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Status Info */}
              {isRunning && (
                <div className="flex flex-col gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Scraper is running...</span>
                  </div>
                  {isScraperRunning && jobs && (
                    <>
                      {jobs
                        .filter((job: any) => job.data?.scraperType === scraper.type)
                        .map((job: any) => (
                          <div key={job.id} className="text-xs ml-6">
                            {job.progressData ? (
                              <>
                                Progress: {job.progressData.current} / {job.progressData.total} apartments
                                {job.progressData.details && (
                                  <div className="flex gap-4 mt-1">
                                    <span className="text-green-600">✓ Success: {job.progressData.details.completed || 0}</span>
                                    <span className="text-red-600">✗ Failed: {job.progressData.details.failed || 0}</span>
                                  </div>
                                )}
                                {job.progressData.message && (
                                  <span className="block text-xs opacity-75 mt-1">{job.progressData.message}</span>
                                )}
                              </>
                            ) : (
                              `Progress: ${job.progress || 0}%`
                            )}
                          </div>
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}