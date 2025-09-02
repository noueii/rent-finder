"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import type { Job } from "~/lib/jobs/queue";
import { PageContainer, PageLoading } from "~/components/layout";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  Trash2,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface JobCardProps {
  job: {
    id: string;
    type: string;
    status: "pending" | "processing" | "completed" | "failed";
    createdAt: Date;
    startedAt?: Date | null;
    completedAt?: Date | null;
    data: any;
    error?: string | null;
    progress?: number;
    progressData?: {
      current: number;
      total: number;
      message?: string;
      estimatedTimeRemaining?: number;
    };
    result?: any;
    attempts: number;
  };
  onCancel: (jobId: string) => void;
  onRefresh: () => void;
}

function JobCard({ job, onCancel, onRefresh }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (job.status) {
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "processing":
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusVariant = () => {
    switch (job.status) {
      case "pending":
        return "secondary";
      case "processing":
        return "default";
      case "completed":
        return "outline";
      case "failed":
        return "destructive";
    }
  };

  const getDuration = () => {
    if (!job.startedAt) return null;
    const start = new Date(job.startedAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const duration = Math.round((end - start) / 1000);
    return `${duration}s`;
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const seconds = Math.round(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s remaining`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s remaining`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m remaining`;
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium">
              {job.type === 'scrape-apartment-list' && job.data?.scraperName 
                ? `${job.data.scraperName} - ${job.data.action === 'fetch-all' ? 'Fetch All' : 'Search'}`
                : job.type}
            </p>
            <p className="text-sm text-muted-foreground">
              Created {new Date(job.createdAt).toLocaleString()}
              {job.data?.userName && ` by ${job.data.userName}`}
            </p>
            {job.type === 'scrape-apartment-list' && job.data?.expectedLimit && (
              <p className="text-xs text-muted-foreground">
                Expected: {job.data.expectedLimit} apartments
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant()}>{job.status}</Badge>
          {job.attempts > 1 && (
            <Badge variant="outline">Attempt {job.attempts}</Badge>
          )}
        </div>
      </div>

      {job.status === "processing" && (
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>
              {job.progressData && job.progressData.total > 0
                ? `${job.progressData.current} / ${job.progressData.total} (${Math.round((job.progressData.current / job.progressData.total) * 100)}%)`
                : `${job.progress || 0}%`}
            </span>
          </div>
          {job.progressData?.message && (
            <p className="text-xs text-muted-foreground mb-1">{job.progressData.message}</p>
          )}
          {job.progressData?.estimatedTimeRemaining && job.progressData.estimatedTimeRemaining > 0 && (
            <p className="text-xs text-muted-foreground mb-1">
              {formatTimeRemaining(job.progressData.estimatedTimeRemaining)}
            </p>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${
                  job.progressData && job.progressData.total > 0
                    ? Math.round((job.progressData.current / job.progressData.total) * 100)
                    : job.progress || 0
                }%` 
              }}
            />
          </div>
        </div>
      )}

      {getDuration() && (
        <p className="text-sm text-muted-foreground mb-3">
          Duration: {getDuration()}
          {job.status === "completed" && job.result?.apartmentsFound !== undefined && (
            <span className="ml-2">• Found {job.result.apartmentsFound} apartments</span>
          )}
        </p>
      )}

      {job.error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-sm text-red-800">{job.error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Show Details
            </>
          )}
        </Button>
        
        {(job.status === "pending" || job.status === "processing") && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onCancel(job.id)}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t space-y-3"
          >
            {job.type === 'scrape-apartment-list' && job.data && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Scraper</p>
                  <p>{job.data.scraperName} ({job.data.scraperType})</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Base URL</p>
                  <p className="truncate">{job.data.scraperUrl}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Action</p>
                  <p>{job.data.action === 'fetch-all' ? 'Fetch All Pages' : 'Search'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">User</p>
                  <p>{job.data.userName}</p>
                </div>
                {job.data.params && (
                  <>
                    {job.data.params.minPrice && (
                      <div>
                        <p className="font-medium text-muted-foreground">Price Range</p>
                        <p>¥{job.data.params.minPrice.toLocaleString()} - ¥{job.data.params.maxPrice?.toLocaleString() || '∞'}</p>
                      </div>
                    )}
                    {job.data.params.minSize && (
                      <div>
                        <p className="font-medium text-muted-foreground">Size Range</p>
                        <p>{job.data.params.minSize}m² - {job.data.params.maxSize || '∞'}m²</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <details className="cursor-pointer">
              <summary className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Raw Job Data
              </summary>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64 mt-2">
                {JSON.stringify(job.data, null, 2)}
              </pre>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  const { data: jobs, isLoading, refetch } = api.admin.getJobs.useQuery(
    {
      type: typeFilter === "all" ? undefined : typeFilter,
      status: statusFilter === "all" ? undefined : statusFilter as any,
      limit: 50,
    },
    {
      // Poll frequently to show real-time progress updates
      refetchInterval: 1000, // Refetch every second
      refetchIntervalInBackground: true,
    }
  );

  const cancelJob = api.admin.cancelJob.useMutation();
  const cleanupJobs = api.admin.cleanupJobs.useMutation();

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob.mutateAsync({ jobId });
      await refetch();
    } catch (error) {
      console.error("Failed to cancel job:", error);
    }
  };

  const handleCleanup = async () => {
    try {
      await cleanupJobs.mutateAsync({ olderThanHours: 24 });
      await refetch();
    } catch (error) {
      console.error("Failed to cleanup jobs:", error);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading />
      </PageContainer>
    );
  }

  // Extract unique job types from the jobs
  const typedJobs = (jobs || []) as Job[];
  const jobTypes = Array.from(new Set(typedJobs.map((j) => j.type)));

  // Calculate stats
  const stats = {
    total: typedJobs.length,
    pending: typedJobs.filter((j) => j.status === "pending").length,
    processing: typedJobs.filter((j) => j.status === "processing").length,
    completed: typedJobs.filter((j) => j.status === "completed").length,
    failed: typedJobs.filter((j) => j.status === "failed").length,
  };

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Job Queue Management</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage background jobs
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleCleanup}>
              <Trash2 className="w-4 h-4 mr-2" />
              Cleanup Old Jobs
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">{stats.processing}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {jobTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {typedJobs.length > 0 ? (
            typedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onCancel={handleCancelJob}
                onRefresh={refetch}
              />
            ))
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No jobs found</p>
            </Card>
          )}
        </div>
      </motion.div>
    </PageContainer>
  );
}