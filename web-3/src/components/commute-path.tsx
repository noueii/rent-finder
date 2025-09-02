"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Train, Clock, ArrowRight, MapPin, Footprints } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Station } from "~/types";
import type { TrainLine } from "@prisma/client";

interface RouteSegment {
  type: "walk" | "train";
  from: string;
  to: string;
  line?: TrainLine;
  duration: number;
  stations?: number;
}

interface CommutePathProps {
  from: Station;
  to: Station;
  totalMinutes: number;
  transfers: number;
  segments: RouteSegment[];
  className?: string;
}

export function CommutePath({
  from,
  to,
  totalMinutes,
  transfers,
  segments,
  className,
}: CommutePathProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Train className="h-5 w-5 text-primary" />
            <span>Commute Path</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-normal">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {totalMinutes} min
            </Badge>
            {transfers > 0 && (
              <Badge variant="outline" className="gap-1">
                {transfers} transfer{transfers > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Start Station */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{from.name}</p>
              {from.nameEn && <p className="text-sm text-muted-foreground">{from.nameEn}</p>}
            </div>
          </motion.div>

          {/* Route Segments */}
          <div className="relative ml-5 space-y-2 border-l-2 border-dashed border-muted pl-7">
            {segments.map((segment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className={cn(
                  "relative -ml-[33px] flex items-center gap-3",
                  index === 0 && "mt-2"
                )}
              >
                {segment.type === "walk" ? (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Footprints className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Walk {segment.duration} min
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: segment.line?.color ? `${segment.line.color}20` : "hsl(var(--primary) / 0.1)",
                      }}
                    >
                      <Train
                        className="h-4 w-4"
                        style={{
                          color: segment.line?.color || "hsl(var(--primary))",
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="h-5 px-2 text-xs"
                          style={{
                            borderColor: segment.line?.color || undefined,
                            color: segment.line?.color || undefined,
                          }}
                        >
                          {segment.line?.nameEn || "Train"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {segment.duration} min
                        </span>
                        {segment.stations && (
                          <span className="text-xs text-muted-foreground">
                            ({segment.stations} stops)
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {segment.from} <ArrowRight className="inline h-3 w-3" /> {segment.to}
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>

          {/* End Station */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + segments.length * 0.1 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">{to.name}</p>
              {to.nameEn && <p className="text-sm text-muted-foreground">{to.nameEn}</p>}
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}