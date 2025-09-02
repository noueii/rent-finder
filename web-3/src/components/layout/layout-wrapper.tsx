"use client";

import { cn } from "~/lib/utils";
import { motion } from "framer-motion";

interface LayoutWrapperProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

export function LayoutWrapper({ children, sidebar, className }: LayoutWrapperProps) {
  if (!sidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      {/* Sidebar */}
      <motion.aside
        className="w-full md:w-64 lg:w-72 border-r bg-background"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {sidebar}
      </motion.aside>
      
      {/* Main content */}
      <motion.main
        className={cn("flex-1", className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {children}
      </motion.main>
    </div>
  );
}