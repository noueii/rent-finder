"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "~/lib/utils";
import { motion } from "framer-motion";

interface Breadcrumb {
  label: string;
  href?: string;
}

function generateBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ label: "Home", href: "/" }];

  const pathMap: Record<string, string> = {
    search: "Search",
    apartments: "Apartments",
    lists: "My Lists",
    browse: "Browse",
    components: "Components",
    admin: "Admin",
    scraping: "Scraping",
    testing: "Testing",
    database: "Database",
    jobs: "Jobs",
    settings: "Settings",
  };

  segments.forEach((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = pathMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    breadcrumbs.push({
      label,
      href: index === segments.length - 1 ? undefined : href,
    });
  });

  return breadcrumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname);

  if (breadcrumbs.length <= 1) return null;

  return (
    <motion.nav
      className="flex items-center space-x-1 text-sm text-muted-foreground"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="mx-1 h-4 w-4" />}
          {breadcrumb.href ? (
            <Link
              href={breadcrumb.href}
              className={cn(
                "flex items-center hover:text-foreground transition-colors",
                index === 0 && "gap-1"
              )}
            >
              {index === 0 && <Home className="h-3 w-3" />}
              {breadcrumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">
              {breadcrumb.label}
            </span>
          )}
        </div>
      ))}
    </motion.nav>
  );
}