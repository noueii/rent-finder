"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { RefreshCw, Trash2, Download, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LOG_LEVEL_CONFIG = {
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  warn: { icon: AlertTriangle, color: 'text-yellow-500', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  error: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  debug: { icon: Bug, color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
};

export function ScraperLogs() {
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');
  const [selectedScraper, setSelectedScraper] = useState<string>('all');
  
  const { data: logs, isLoading, refetch } = api.admin.getScraperLogs.useQuery({
    level: selectedLevel === 'all' ? undefined : selectedLevel,
    scraperType: selectedScraper === 'all' ? undefined : selectedScraper,
    limit: 500,
  });

  const { data: stats } = api.admin.getScraperLogStats.useQuery();
  
  const clearLogsMutation = api.admin.clearScraperLogs.useMutation({
    onSuccess: () => {
      toast.success("All scraper logs have been cleared.");
      refetch();
    },
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleClearLogs = () => {
    if (confirm("Are you sure you want to clear all scraper logs?")) {
      clearLogsMutation.mutate();
    }
  };

  const exportLogs = () => {
    if (!logs) return;
    
    const csvContent = [
      ['Timestamp', 'Job ID', 'Scraper', 'Level', 'Message', 'Metadata'].join(','),
      ...logs.map(log => [
        log.timestamp.toISOString(),
        log.jobId,
        log.scraperType,
        log.level,
        `"${log.message.replace(/"/g, '""')}"`,
        log.metadata ? `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"` : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraper-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.byLevel.info}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.byLevel.warn}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.byLevel.error}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scraper Logs</CardTitle>
              <CardDescription>
                Real-time logs from scraping jobs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={!logs || logs.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
                disabled={clearLogsMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as LogLevel | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedScraper} onValueChange={setSelectedScraper}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by scraper" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scrapers</SelectItem>
                {stats && Object.keys(stats.byScraperType).map(scraper => (
                  <SelectItem key={scraper} value={scraper}>
                    {scraper} ({stats.byScraperType[scraper]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Logs List */}
          <ScrollArea className="h-[600px] w-full border rounded-md">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  Loading logs...
                </div>
              ) : logs && logs.length > 0 ? (
                logs.map((log) => {
                  const config = LOG_LEVEL_CONFIG[log.level];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(log.timestamp, 'HH:mm:ss.SSS')}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.scraperType}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {log.jobId.substring(0, 8)}...
                            </span>
                          </div>
                          <div className="text-sm">{log.message}</div>
                          {log.metadata && (
                            <pre className="text-xs text-muted-foreground bg-background/50 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No logs found
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Recent Errors */}
          {stats && stats.recentErrors.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Recent Errors</h3>
              <div className="space-y-2">
                {stats.recentErrors.slice(0, 5).map((error) => (
                  <div key={error.id} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{error.scraperType}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(error.timestamp, 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs">{error.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}