"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Home,
  Ruler,
  Star,
  Zap,
  Turtle,
  Globe
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

interface UpdateApartmentDetailsDialogProps {
  listId: string;
  listName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function UpdateApartmentDetailsDialog({
  listId,
  listName,
  open,
  onOpenChange,
  onComplete,
}: UpdateApartmentDetailsDialogProps) {
  const [minSize, setMinSize] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [limit, setLimit] = useState(0); // 0 means no limit
  const [mode, setMode] = useState<'fast' | 'normal'>('normal');
  const [source, setSource] = useState<string>('all');
  const [jobId, setJobId] = useState<string | null>(null);

  // Get apartments that need details in this list
  const { data: listStats, isLoading: statsLoading } = api.list.getApartmentStats.useQuery(
    { listId },
    { enabled: open }
  );

  // Mutation to start the update job
  const updateDetailsMutation = api.admin.updateApartmentDetailsForList.useMutation({
    onSuccess: (result) => {
      setJobId(result.jobId);
      toast.success("Update job started! You can close this dialog.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start update job");
    },
  });

  // Query job status if we have a jobId
  const { data: jobStatus } = api.admin.getJobDetails.useQuery(
    { jobId: jobId! },
    { 
      enabled: !!jobId,
      refetchInterval: jobId ? 2000 : false,
    }
  );

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setJobId(null);
      setMinSize(0);
      setMinScore(0);
      setLimit(0);
      setMode('normal');
      setSource('all');
    }
  }, [open]);

  // Call onComplete when job finishes successfully
  useEffect(() => {
    if (jobStatus?.status === 'completed' && onComplete) {
      onComplete();
    }
  }, [jobStatus?.status, onComplete]);

  const handleStartUpdate = () => {
    updateDetailsMutation.mutate({
      listId,
      filters: {
        minSize: minSize > 0 ? minSize : undefined,
        minScore: minScore > 0 ? minScore : undefined,
        limit: limit > 0 ? limit : undefined, // undefined means no limit
        source: source !== 'all' ? source : undefined,
      },
      mode,
    });
  };

  const needingDetails = listStats?.needingDetails || 0;
  const filteredCount = 0; // Not tracking filtered count for now

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Update Apartment Details</DialogTitle>
          <DialogDescription>
            Fetch comprehensive details for apartments in "{listName}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {statsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : jobId ? (
            // Job Progress View
            <div className="space-y-4">
            {jobStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {jobStatus.status === 'processing' && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {jobStatus.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {jobStatus.status === 'failed' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {jobStatus.status === 'processing' && 'Processing...'}
                      {jobStatus.status === 'completed' && 'Completed!'}
                      {jobStatus.status === 'failed' && 'Failed'}
                      {jobStatus.status === 'pending' && 'Pending...'}
                    </span>
                  </div>
                  <Badge variant={
                    jobStatus.status === 'completed' ? 'secondary' :
                    jobStatus.status === 'failed' ? 'destructive' :
                    'default'
                  }>
                    {jobStatus.status}
                  </Badge>
                </div>

                {jobStatus.progress !== undefined && jobStatus.progress > 0 && (
                  <div className="space-y-2">
                    <Progress value={jobStatus.progress} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      {jobStatus.progress}% complete
                    </p>
                  </div>
                )}

                {jobStatus.progressData && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    {jobStatus.progressData.message && (
                      <p className="text-sm">{jobStatus.progressData.message}</p>
                    )}
                    {jobStatus.progressData.current !== undefined && jobStatus.progressData.total !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Processing {jobStatus.progressData.current} of {jobStatus.progressData.total} apartments
                      </p>
                    )}
                    {jobStatus.progressData.details && (() => {
                      const details = jobStatus.progressData.details as any;
                      return (
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          {details.successfulFetches !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Fetched:</span>{' '}
                              <span className="font-medium">{details.successfulFetches}</span>
                            </div>
                          )}
                          {details.successfulUpdates !== undefined && (
                            <div>
                              <span className="text-muted-foreground">Updated:</span>{' '}
                              <span className="font-medium text-green-600">{details.successfulUpdates}</span>
                            </div>
                          )}
                          {details.fetchFailures !== undefined && details.fetchFailures > 0 && (
                            <div>
                              <span className="text-muted-foreground">Fetch failures:</span>{' '}
                              <span className="font-medium text-orange-600">{details.fetchFailures}</span>
                            </div>
                          )}
                          {details.updateFailures !== undefined && details.updateFailures > 0 && (
                            <div>
                              <span className="text-muted-foreground">Update failures:</span>{' '}
                              <span className="font-medium text-red-600">{details.updateFailures}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {jobStatus.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{jobStatus.error}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        ) : (
          // Configuration View
          <div className="space-y-4">
            {/* Stats Alert */}
            <Alert>
              <Home className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>
                    Found <span className="font-semibold">{needingDetails}</span> apartments that need detail updates.
                  </p>
                  {filteredCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ({filteredCount} will be filtered out based on your criteria)
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* Source Selection */}
            <div className="space-y-2">
              <Label htmlFor="source" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Data Source
              </Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="yolo-japan">YOLO Japan</SelectItem>
                  <SelectItem value="wagaya-japan">Wagaya Japan</SelectItem>
                  <SelectItem value="e-housing">E-Housing</SelectItem>
                  <SelectItem value="metro-residences">Metro Residences</SelectItem>
                  <SelectItem value="realestate">RealEstate.co.jp</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select which website to fetch apartment details from
              </p>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>Update Mode</Label>
              <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'fast' | 'normal')}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Turtle className="h-4 w-4" />
                      <span className="font-medium">Normal Mode</span>
                      <Badge variant="secondary">Recommended</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fetches detail pages for comprehensive data including descriptions, amenities, and high-quality images
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="fast" id="fast" />
                  <Label htmlFor="fast" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span className="font-medium">Fast Mode</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quick updates from search results only - limited data available
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Filter Apartments (Optional)</h4>
              
              {/* Minimum Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="minSize" className="flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Minimum Size
                  </Label>
                  <span className="text-sm text-muted-foreground">{minSize} m²</span>
                </div>
                <Slider
                  id="minSize"
                  min={0}
                  max={100}
                  step={1}
                  value={[minSize]}
                  onValueChange={(value) => setMinSize(value[0] || 0)}
                />
              </div>

              {/* Minimum Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="minScore" className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Minimum Score
                  </Label>
                  <span className="text-sm text-muted-foreground">{minScore}%</span>
                </div>
                <Slider
                  id="minScore"
                  min={0}
                  max={100}
                  step={5}
                  value={[minScore]}
                  onValueChange={(value) => setMinScore(value[0] || 0)}
                />
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <Label htmlFor="limit">
                  Maximum apartments to update (0 = all)
                </Label>
                <Input
                  id="limit"
                  type="number"
                  min={0}
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave as 0 to update all apartments, or set a specific limit
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium mb-2">Update Summary</h4>
              <div className="space-y-1 text-sm">
                <p>
                  Will update <span className="font-medium">{limit > 0 ? Math.min(limit, needingDetails) : needingDetails}</span> apartments
                </p>
                {minSize > 0 && (
                  <p>• Only apartments ≥ {minSize} m²</p>
                )}
                {minScore > 0 && (
                  <p>• Only apartments with score ≥ {minScore}%</p>
                )}
                <p>• Using {mode === 'fast' ? 'fast' : 'normal (detailed)'} scraping mode</p>
                {source !== 'all' && (
                  <p>• From {source.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} only</p>
                )}
              </div>
            </div>
          </div>
        )}
        </div>

        <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-2">
          {!jobId ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleStartUpdate}
                disabled={updateDetailsMutation.isPending || needingDetails === 0}
              >
                {updateDetailsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start Update
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => onOpenChange(false)}
              variant={jobStatus?.status === 'completed' ? 'default' : 'outline'}
            >
              {jobStatus?.status === 'completed' ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}