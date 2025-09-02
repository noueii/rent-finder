"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface SidebarNavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  className?: string;
}

export function SidebarNav({ items, className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-1", className)}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || 
          (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              href={item.href}
              className={cn(
                "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.title}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {item.badge !== undefined && (
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {item.badge}
                  </span>
                )}
                
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )} />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}