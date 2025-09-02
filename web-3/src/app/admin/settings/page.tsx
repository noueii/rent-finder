"use client";

import { PageContainer } from "~/components/layout";
import { Card } from "~/components/ui/card";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure system-wide settings and preferences
          </p>
        </div>

        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <Settings className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Settings Coming Soon</h2>
            <p className="text-muted-foreground max-w-md">
              This page will contain system configuration options, API keys management,
              notification settings, and other administrative controls.
            </p>
          </div>
        </Card>
      </motion.div>
    </PageContainer>
  );
}