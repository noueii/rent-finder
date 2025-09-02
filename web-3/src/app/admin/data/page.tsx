"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { PageContainer, PageLoading } from "~/components/layout";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { motion } from "framer-motion";
import { 
  Database, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  MapPin,
  Copy,
  Image,
  RefreshCw,
  Archive,
  Search
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function DataManagementPage() {
  const { data: overview, isLoading, refetch } = api.admin.getDataOverview.useQuery();
  const cleanupDuplicates = api.admin.cleanupDuplicates.useMutation();
  const cleanupOldData = api.admin.cleanupOldData.useMutation();
  const clearCache = api.admin.clearCache.useMutation();
  const { data: cacheStats } = api.admin.getCacheStats.useQuery();

  const [cleanupDays, setCleanupDays] = useState(30);
  const [cachePattern, setCachePattern] = useState("");
  const [showDuplicatePreview, setShowDuplicatePreview] = useState(false);
  const [showOldDataPreview, setShowOldDataPreview] = useState(false);

  const handleCleanupDuplicates = async (dryRun = true) => {
    try {
      const result = await cleanupDuplicates.mutateAsync({ dryRun });
      console.log("Cleanup result:", result);
      if (!dryRun) {
        await refetch();
        setShowDuplicatePreview(false);
      }
    } catch (error) {
      console.error("Failed to cleanup duplicates:", error);
    }
  };

  const handleCleanupOldData = async (dryRun = true) => {
    try {
      const result = await cleanupOldData.mutateAsync({
        olderThanDays: cleanupDays,
        includeApartments: true,
        includeSearchSessions: true,
        dryRun,
      });
      console.log("Cleanup result:", result);
      if (!dryRun) {
        await refetch();
        setShowOldDataPreview(false);
      }
    } catch (error) {
      console.error("Failed to cleanup old data:", error);
    }
  };

  const handleClearCache = async () => {
    try {
      const result = await clearCache.mutateAsync({
        pattern: cachePattern || undefined,
      });
      console.log("Cache cleared:", result);
      setCachePattern("");
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading />
      </PageContainer>
    );
  }

  if (!overview) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load data overview</p>
        </div>
      </PageContainer>
    );
  }

  // Prepare chart data
  const sourceData = overview.bySource.map(item => ({
    name: item.sourceSite,
    value: item._count.id,
  }));

  const availabilityData = overview.byAvailability.map(item => ({
    name: item.availability,
    value: item._count.id,
  }));

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Data Management</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and maintain apartment data quality
            </p>
          </div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Data Issues */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing Coordinates</p>
                <p className="text-2xl font-bold">{overview.issues.missingCoordinates}</p>
              </div>
              <MapPin className="w-8 h-8 text-yellow-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Duplicate Apartments</p>
                <p className="text-2xl font-bold">{overview.issues.duplicates}</p>
              </div>
              <Copy className="w-8 h-8 text-orange-600" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Orphaned Images</p>
                <p className="text-2xl font-bold">{overview.issues.orphanedImages}</p>
              </div>
              <Image className="w-8 h-8 text-red-600" />
            </div>
          </Card>
        </div>

        {/* Data Distribution Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Apartments by Source</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Apartments by Availability</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={availabilityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {availabilityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Cleanup Actions */}
        <div className="space-y-6 mb-8">
          {/* Duplicate Cleanup */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Duplicate Apartments</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove duplicate apartment listings from the same source
                </p>
              </div>
              <Badge variant="secondary">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {overview.issues.duplicates} duplicates
              </Badge>
            </div>

            {showDuplicatePreview ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <p className="text-sm">
                    This will remove {overview.issues.duplicates} duplicate apartments,
                    keeping only the newest version of each listing.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCleanupDuplicates(false)}
                    disabled={cleanupDuplicates.isPending}
                  >
                    {cleanupDuplicates.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirm Cleanup
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDuplicatePreview(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setShowDuplicatePreview(true);
                  handleCleanupDuplicates(true);
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                Preview Cleanup
              </Button>
            )}
          </Card>

          {/* Old Data Cleanup */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Old Data Cleanup</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove old apartments and search sessions
                </p>
              </div>
              <Badge variant="secondary">
                <Archive className="w-4 h-4 mr-1" />
                Clean after {cleanupDays} days
              </Badge>
            </div>

            <div className="mb-4">
              <Label htmlFor="cleanup-days">Days to keep data</Label>
              <Input
                id="cleanup-days"
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(Number(e.target.value))}
                min={7}
                max={365}
                className="w-32 mt-1"
              />
            </div>

            {showOldDataPreview ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <p className="text-sm">
                    This will remove data older than {cleanupDays} days.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCleanupOldData(false)}
                    disabled={cleanupOldData.isPending}
                  >
                    {cleanupOldData.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Cleaning...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirm Cleanup
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOldDataPreview(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setShowOldDataPreview(true);
                  handleCleanupOldData(true);
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                Preview Cleanup
              </Button>
            )}
          </Card>

          {/* Cache Management */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Cache Management</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Clear search result cache
                </p>
              </div>
              {cacheStats && (
                <Badge variant="secondary">
                  <Database className="w-4 h-4 mr-1" />
                  {cacheStats.size} entries
                </Badge>
              )}
            </div>

            {cacheStats && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cache Size</p>
                  <p className="font-medium">{cacheStats.size} entries</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hit Rate</p>
                  <p className="font-medium">
                    {cacheStats.hits + cacheStats.misses > 0
                      ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="cache-pattern">Pattern (optional)</Label>
                <Input
                  id="cache-pattern"
                  value={cachePattern}
                  onChange={(e) => setCachePattern(e.target.value)}
                  placeholder="e.g., search:tokyo"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to clear all cache
                </p>
              </div>

              <Button
                onClick={handleClearCache}
                disabled={clearCache.isPending}
                variant="destructive"
              >
                {clearCache.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Cache
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </motion.div>
    </PageContainer>
  );
}