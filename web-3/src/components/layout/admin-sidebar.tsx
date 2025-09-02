"use client";

import { 
  LayoutDashboard, 
  Globe, 
  Activity,
  Settings,
  Database,
  RefreshCw
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Scrapers",
    href: "/admin/scrapers",
    icon: Globe,
  },
  {
    title: "Jobs",
    href: "/admin/jobs",
    icon: RefreshCw,
  },
  {
    title: "Data Management",
    href: "/admin/data",
    icon: Database,
  },
  {
    title: "Monitoring",
    href: "/admin/monitoring",
    icon: Activity,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
      </div>
      
      <div className="flex-1 px-3">
        <SidebarNav items={adminNavItems} />
      </div>
      
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Admin access only
        </p>
      </div>
    </div>
  );
}