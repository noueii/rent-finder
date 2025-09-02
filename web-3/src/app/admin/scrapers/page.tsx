"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { PageContainer, PageLoading } from "~/components/layout";
import { Card, Badge } from "~/presentation/components/ui";
import { Button } from "~/components/ui/button";
import { SelectItem } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FormInput, FormSelect } from "~/presentation/components/forms";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, 
  Play, 
  Pause, 
  Settings, 
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Link,
  Search,
  TestTube,
  Copy,
  ExternalLink,
  X
} from "lucide-react";
import { ScraperControlPanel } from "~/components/admin/scraper-control-panel";
import { ScraperTestPanel } from "~/components/admin/scraper-test-panel";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const manualScrapeSchema = z.object({
  scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']),
  priceMin: z.number().min(0),
  priceMax: z.number().max(500000),
  sizeMin: z.number().min(0),
  sizeMax: z.number().max(200),
  layout: z.array(z.string()).optional(),
  maxPages: z.number().min(1).max(10),
  includeDetails: z.boolean(),
});

type ManualScrapeForm = z.infer<typeof manualScrapeSchema>;

// Scraper configuration with example URLs
const SCRAPER_INFO = {
  'realestate': { 
    name: 'RealEstate.co.jp', 
    baseUrl: 'https://realestate.co.jp',
    exampleDetail: 'https://realestate.co.jp/en/rent/view/1249374'
  },
  'yolo-japan': { 
    name: 'YOLO Japan', 
    baseUrl: 'https://home.yolo-japan.com',
    exampleDetail: 'https://home.yolo-japan.com/en/property/1411616'
  },
  'wagaya-japan': { 
    name: 'Wagaya Japan', 
    baseUrl: 'https://wagaya-japan.com',
    exampleDetail: 'https://wagaya-japan.com/en/chintai_detail.php?id=2600102'
  },
  'e-housing': { 
    name: 'E-Housing', 
    baseUrl: 'https://e-housing.jp',
    exampleDetail: 'https://e-housing.jp/rent/tokyo/sumida/isle-premium-oshiage-nord/505'
  },
  'metro-residences': { 
    name: 'Metro Residences', 
    baseUrl: 'https://www.metroresidences.com',
    exampleDetail: 'https://www.metroresidences.com/jp-en/apartment-rental/tokyo/chuo/grand-palace-tokyo-yaesu-avenue/45032'
  },
};


function SequentialUpdateRun({ scrapers, onClose }: { scrapers: any[], onClose: () => void }) {
  const [selectedScrapers, setSelectedScrapers] = useState<string[]>([]);
  const [updateLimit, setUpdateLimit] = useState<number | undefined>(10);
  const [isRunning, setIsRunning] = useState(false);
  
  // Get count of apartments needing details for each scraper
  const { data: needingDetailsCounts } = api.admin.getApartmentsNeedingDetailsCounts.useQuery();
  
  const runUpdatesSequentially = api.admin.runUpdatesSequentially.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.jobsCreated.length} sequential update jobs`);
      if (data.errors.length > 0) {
        data.errors.forEach(err => {
          toast.warning(`${err.scraperType}: ${err.error}`);
        });
      }
      setIsRunning(false);
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to run updates: ${error.message}`);
      setIsRunning(false);
    },
  });
  
  const handleRun = () => {
    if (selectedScrapers.length === 0) {
      toast.error('Please select at least one provider');
      return;
    }
    
    setIsRunning(true);
    const mutationData: any = {
      scraperTypes: selectedScrapers as any[],
    };
    
    // Only include limit if it has a value
    if (updateLimit !== undefined) {
      mutationData.limit = updateLimit;
    }
    
    runUpdatesSequentially.mutate(mutationData);
  };
  
  const toggleScraper = (scraperType: string) => {
    setSelectedScrapers(prev => 
      prev.includes(scraperType) 
        ? prev.filter(s => s !== scraperType)
        : [...prev, scraperType]
    );
  };
  
  const activeScrapers = scrapers.filter(s => s.isActive);
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Run Updates Sequentially by Provider</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Select Providers to Update</p>
          <div className="grid grid-cols-2 gap-2">
            {activeScrapers.map((scraper) => {
              console.log(scraper)
              console.log(needingDetailsCounts)
              const count = needingDetailsCounts?.[scraper.type] || 0;
              return (
                <label
                  key={scraper.type}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedScrapers.includes(scraper.type)}
                      onChange={() => toggleScraper(scraper.type)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{scraper.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count} need updates
                  </Badge>
                </label>
              );
            })}
          </div>
        </div>
        
        <FormInput
          label="Number of apartments to update per provider"
          type="number"
          value={updateLimit || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpdateLimit(e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="Leave empty to update all"
          inputClassName="w-48"
          description="Leave empty to update all"
          min={1}
          max={1000}
        />
        
        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">
            {selectedScrapers.length} provider(s) selected
          </div>
          <Button
            onClick={handleRun}
            disabled={isRunning || selectedScrapers.length === 0}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating Update Jobs...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Updates Sequentially
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SequentialScraperRun({ scrapers, onClose }: { scrapers: any[], onClose: () => void }) {
  const [selectedScrapers, setSelectedScrapers] = useState<string[]>([]);
  const [fetchAll, setFetchAll] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: 50000,
    maxPrice: 300000,
    minSize: 20,
    maxSize: 100,
  });
  
  const runSequentially = api.admin.runScrapersSequentially.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.jobsCreated.length} sequential jobs`);
      if (data.errors.length > 0) {
        data.errors.forEach(err => {
          toast.warning(`${err.scraperType}: ${err.error}`);
        });
      }
      setIsRunning(false);
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to run scrapers: ${error.message}`);
      setIsRunning(false);
    },
  });
  
  const handleRun = () => {
    if (selectedScrapers.length === 0) {
      toast.error('Please select at least one scraper');
      return;
    }
    
    setIsRunning(true);
    runSequentially.mutate({
      scraperTypes: selectedScrapers as any[],
      params: {
        ...filters,
        fetchAll,
      },
    });
  };
  
  const toggleScraper = (scraperType: string) => {
    setSelectedScrapers(prev => 
      prev.includes(scraperType) 
        ? prev.filter(s => s !== scraperType)
        : [...prev, scraperType]
    );
  };
  
  const activeScrapers = scrapers.filter(s => s.isActive);
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Run Scrapers Sequentially</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Select Scrapers to Run</p>
          <div className="grid grid-cols-2 gap-2">
            {activeScrapers.map((scraper) => (
              <label
                key={scraper.type}
                className="flex items-center space-x-2 p-2 border rounded hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedScrapers.includes(scraper.type)}
                  onChange={() => toggleScraper(scraper.type)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{scraper.name}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Price Range (¥)</p>
            <div className="flex gap-2">
              <FormInput
                label=""
                type="number"
                value={filters.minPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters(f => ({ ...f, minPrice: parseInt(e.target.value) || 0 }))}
                placeholder="Min"
              />
              <FormInput
                label=""
                type="number"
                value={filters.maxPrice}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters(f => ({ ...f, maxPrice: parseInt(e.target.value) || 0 }))}
                placeholder="Max"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">Size Range (m²)</p>
            <div className="flex gap-2">
              <FormInput
                label=""
                type="number"
                value={filters.minSize}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters(f => ({ ...f, minSize: parseInt(e.target.value) || 0 }))}
                placeholder="Min"
              />
              <FormInput
                label=""
                type="number"
                value={filters.maxSize}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters(f => ({ ...f, maxSize: parseInt(e.target.value) || 0 }))}
                placeholder="Max"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="fetchAll"
            checked={fetchAll}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFetchAll(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="fetchAll" className="cursor-pointer">
            Fetch all available apartments (may take a long time)
          </Label>
        </div>
        
        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">
            {selectedScrapers.length} scraper(s) selected
          </div>
          <Button
            onClick={handleRun}
            disabled={isRunning || selectedScrapers.length === 0}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating Jobs...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Sequentially
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function BulkUpdateTab({ selectedScraper }: { selectedScraper: string }) {
  const [updateLimit, setUpdateLimit] = useState<number | undefined>(10);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Get apartments needing details
  const { data: needingDetails, isLoading: loadingApartments, refetch } = api.admin.getApartmentsNeedingDetails.useQuery({
    scraperType: selectedScraper as any,
    limit: updateLimit,
  });
  
  // Bulk update mutation
  const updateApartments = api.admin.updateApartmentsByUrls.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.jobs.length} update job(s) for ${data.jobs.reduce((sum, job) => sum + (job.urlCount || 0), 0)} apartments`);
      setIsUpdating(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
      setIsUpdating(false);
    },
  });
  
  const handleBulkUpdate = () => {
    if (!needingDetails?.apartments.length) {
      toast.error('No apartments found needing detail updates');
      return;
    }
    
    setIsUpdating(true);
    const urls = needingDetails.apartments.map(apt => apt.sourceUrl);
    updateApartments.mutate({
      urls,
      scraperType: selectedScraper as any,
    });
  };
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Bulk Update Apartment Details</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Fetch detailed information for apartments that haven't been fully scraped yet.
          This will update station distances, images, and other details.
        </p>
      </div>
      
      <div className="space-y-4">
        <FormInput
          label="Number of apartments to update"
          type="number"
          value={updateLimit || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpdateLimit(e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="Leave empty to update all"
          inputClassName="w-48"
          description="Leave empty to update all"
          min={1}
          max={1000}
        />
        
        {loadingApartments ? (
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading apartments...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Total needing details:</p>
                  <p className="text-2xl font-bold">{needingDetails?.totalNeedingDetails || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Will update:</p>
                  <p className="text-2xl font-bold text-primary">
                    {needingDetails?.apartments.length || 0}
                  </p>
                </div>
              </div>
            </div>
            
            {needingDetails?.apartments && needingDetails.apartments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Sample apartments to update:</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {needingDetails.apartments.slice(0, 5).map((apt) => (
                    <div key={apt.id} className="p-2 bg-background border rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {apt.area} {apt.ward && `· ${apt.ward}`} · ¥{apt.price.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(apt.sourceUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {needingDetails.apartments.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ... and {needingDetails.apartments.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <Button
              onClick={handleBulkUpdate}
              disabled={!needingDetails?.apartments.length || isUpdating}
              className="w-full"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating update jobs...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Update {needingDetails?.apartments.length || 0} Apartments
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScrapersPage() {
  const { data: scrapers, isLoading, refetch } = api.admin.getScrapers.useQuery(undefined, {
    refetchInterval: 3000, // Refetch every 3 seconds to update scraper states
    refetchIntervalInBackground: true,
  });
  const updateScraper = api.admin.updateScraperConfig.useMutation();
  const startScraping = api.admin.startScraping.useMutation();

  const [showManualScrape, setShowManualScrape] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [showSequentialRun, setShowSequentialRun] = useState(false);
  const [showSequentialUpdate, setShowSequentialUpdate] = useState(false);
  const [activeTab, setActiveTab] = useState<'scrapers' | 'tester' | 'manual'>('scrapers');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ManualScrapeForm>({
    resolver: zodResolver(manualScrapeSchema),
    defaultValues: {
      scraperType: 'realestate',
      priceMin: 50000,
      priceMax: 200000,
      sizeMin: 20,
      sizeMax: 80,
      maxPages: 5,
      includeDetails: true,
    },
  });

  const handleUpdateScraper = async (id: string, updates: any) => {
    try {
      await updateScraper.mutateAsync({ id, updates });
      await refetch();
    } catch (error) {
      console.error("Failed to update scraper:", error);
    }
  };

  const onSubmitManualScrape = async (data: ManualScrapeForm) => {
    try {
      const result = await startScraping.mutateAsync({
        scraperType: data.scraperType,
        filters: {
          priceRange: { min: data.priceMin, max: data.priceMax },
          sizeRange: { min: data.sizeMin, max: data.sizeMax },
          layout: data.layout,
        },
        options: {
          maxPages: data.maxPages,
          includeDetails: data.includeDetails,
        },
      });
      
      toast.success(`Scraping job ${result.jobId} started!`);
      setShowManualScrape(false);
    } catch (error) {
      toast.error('Failed to start scraping');
      console.error("Failed to start scraping:", error);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading />
      </PageContainer>
    );
  }

  if (!scrapers) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load scrapers</p>
        </div>
      </PageContainer>
    );
  }

  const registeredSet = new Set(scrapers.registered);

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Scraper Management</h1>
            <p className="text-muted-foreground mt-1">
              Configure and control apartment data scrapers
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSequentialRun(!showSequentialRun)}
            >
              <Play className="w-4 h-4 mr-2" />
              Run All Sequentially
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSequentialUpdate(!showSequentialUpdate)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Update All Sequentially
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTester(!showTester)}
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test Scrapers
            </Button>
            <Button onClick={() => setShowManualScrape(!showManualScrape)}>
              <Play className="w-4 h-4 mr-2" />
              Manual Scrape
            </Button>
          </div>
        </div>

        {/* Scraper Tester */}
        <AnimatePresence>
          {showTester && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="grid gap-4">
                {SCRAPER_INFO && Object.entries(SCRAPER_INFO).map(([type, info]) => (
                  <ScraperTestPanel 
                    key={type}
                    scraperType={type}
                    scraperName={info.name}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sequential Run */}
        <AnimatePresence>
          {showSequentialRun && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <SequentialScraperRun 
                scrapers={scrapers.configured} 
                onClose={() => setShowSequentialRun(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sequential Update */}
        <AnimatePresence>
          {showSequentialUpdate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <SequentialUpdateRun 
                scrapers={scrapers.configured} 
                onClose={() => setShowSequentialUpdate(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Scrape Form */}
        <AnimatePresence>
          {showManualScrape && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Manual Scraping</h2>
                <form onSubmit={handleSubmit(onSubmitManualScrape)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormSelect
                      label="Scraper Type"
                      value={watch("scraperType")}
                      onValueChange={(value) => setValue("scraperType", value as any)}
                      placeholder="Select a scraper"
                    >
                      {scrapers.registered.map((type) => (
                        <SelectItem key={type} value={type}>
                          {SCRAPER_INFO[type as keyof typeof SCRAPER_INFO]?.name || type}
                        </SelectItem>
                      ))}
                    </FormSelect>

                    <FormInput
                      label="Max Pages"
                      type="number"
                      {...register("maxPages", { valueAsNumber: true })}
                      min={1}
                      max={10}
                    />

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Price Range (¥)</p>
                      <div className="flex gap-2">
                        <FormInput
                          label=""
                          type="number"
                          placeholder="Min"
                          {...register("priceMin", { valueAsNumber: true })}
                        />
                        <FormInput
                          label=""
                          type="number"
                          placeholder="Max"
                          {...register("priceMax", { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Size Range (㎡)</p>
                      <div className="flex gap-2">
                        <FormInput
                          label=""
                          type="number"
                          placeholder="Min"
                          {...register("sizeMin", { valueAsNumber: true })}
                        />
                        <FormInput
                          label=""
                          type="number"
                          placeholder="Max"
                          {...register("sizeMax", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        {...register("includeDetails")}
                        className="rounded border-gray-300"
                      />
                      <span>Include apartment details</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={startScraping.isPending}>
                      {startScraping.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Scraping
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowManualScrape(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registered</p>
                <p className="text-2xl font-bold">{scrapers.registered.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Configured</p>
                <p className="text-2xl font-bold">{scrapers.configured.length}</p>
              </div>
              <Settings className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {scrapers.configured.filter((s) => s.isActive).length}
                </p>
              </div>
              <Play className="w-8 h-8 text-green-600" />
            </div>
          </Card>
        </div>

        {/* Scrapers Grid */}
        <div className="grid grid-cols-1 gap-4">
          {scrapers.configured.map((scraper) => (
            <ScraperControlPanel
              key={scraper.id}
              scraper={{
                id: scraper.id,
                name: scraper.name,
                type: scraper.type,
                baseUrl: scraper.baseUrl,
                isActive: scraper.isActive,
                lastScraped: scraper.updatedAt,
                rateLimit: scraper.rateLimit,
              }}
            />
          ))}
        </div>
      </motion.div>
    </PageContainer>
  );
}