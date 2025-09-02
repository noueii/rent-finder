"use client";

import { api } from "~/trpc/react";
import { PageContainer, PageLoading, SkeletonLoader } from "~/components/layout";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { 
  Home, 
  Users, 
  List, 
  Search, 
  Database,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

// Color palette for charts
const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#8b5cf6"];

interface StatCardProps {
  title: string;
  value: string | number;
  growth?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ title, value, growth, icon, trend = "neutral" }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {growth && (
            <p className={`text-sm mt-1 ${
              trend === "up" ? "text-green-600" : 
              trend === "down" ? "text-red-600" : 
              "text-muted-foreground"
            }`}>
              {growth}
            </p>
          )}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = api.admin.getStats.useQuery();
  const { data: health } = api.admin.getSystemHealth.useQuery();

  if (isLoading) {
    return (
      <PageContainer>
        <PageLoading />
      </PageContainer>
    );
  }

  if (!stats) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load dashboard statistics</p>
        </div>
      </PageContainer>
    );
  }

  // Prepare data for charts
  const systemHealthData = health?.checks
    ? Object.entries(health.checks).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: value ? 1 : 0,
      }))
    : [];

  const popularStationsData = stats.popularStations.map((item) => ({
    name: item.station?.name || "Unknown",
    apartments: item.apartmentCount,
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
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              System overview and statistics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={health?.status === "healthy" ? "outline" : "destructive"}>
              {health?.status === "healthy" ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  System Healthy
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-1" />
                  System Degraded
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={stats.users.total.toLocaleString()}
            growth={stats.users.growth}
            icon={<Users className="w-8 h-8" />}
            trend="up"
          />
          <StatCard
            title="Total Apartments"
            value={stats.apartments.total.toLocaleString()}
            growth={stats.apartments.growth}
            icon={<Home className="w-8 h-8" />}
            trend="up"
          />
          <StatCard
            title="Active Lists"
            value={stats.lists.active.toLocaleString()}
            growth={stats.lists.growth}
            icon={<List className="w-8 h-8" />}
            trend="up"
          />
          <StatCard
            title="Searches (24h)"
            value={stats.searches.last24h.toLocaleString()}
            growth={stats.searches.growth}
            icon={<Search className="w-8 h-8" />}
            trend="up"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* System Health Chart */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">System Health</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={systemHealthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 1]} ticks={[0, 1]} />
                  <Tooltip 
                    formatter={(value) => value === 1 ? "Healthy" : "Unhealthy"}
                  />
                  <Bar dataKey="value" fill="#2563eb">
                    {systemHealthData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.value === 1 ? "#16a34a" : "#dc2626"} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Popular Stations Chart */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Popular Stations</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularStationsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="apartments" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Job Queue Stats */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Job Queue Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.scraping.jobs.total}</p>
              <p className="text-sm text-muted-foreground">Total Jobs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {stats.scraping.jobs.pending}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats.scraping.jobs.processing}
              </p>
              <p className="text-sm text-muted-foreground">Processing</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.scraping.jobs.completed}
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="font-medium">Active Scraping Sources</p>
                <p className="text-sm text-muted-foreground">
                  Number of configured scrapers
                </p>
              </div>
              <Badge>{stats.scraping.activeSources}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="font-medium">Recently Scraped</p>
                <p className="text-sm text-muted-foreground">
                  Apartments scraped in last 24h
                </p>
              </div>
              <Badge>{stats.apartments.recentlyScraped}</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Database Status</p>
                <p className="text-sm text-muted-foreground">
                  Connection health
                </p>
              </div>
              <Badge variant={health?.checks.database ? "outline" : "destructive"}>
                {health?.checks.database ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
        </Card>
      </motion.div>
    </PageContainer>
  );
}