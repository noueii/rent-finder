"use client";

import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function PageContainer({ 
  children, 
  className,
  animate = true 
}: PageContainerProps) {
  const content = (
    <div className={cn("container mx-auto px-4 py-8", className)}>
      {children}
    </div>
  );

  if (!animate) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {content}
    </motion.div>
  );
}