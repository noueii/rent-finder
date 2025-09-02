import { z } from "zod";
import { ListType } from "@prisma/client";

// Advanced filter form schema
export const advancedFilterSchema = z.object({
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  sizeMin: z.number().min(0).optional(),
  sizeMax: z.number().min(0).optional(),
  layout: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  stationIds: z.array(z.string()).optional(),
  maxAge: z.number().min(0).max(100).optional(),
  availability: z.enum(["available", "occupied", "unknown"]).optional(),
}).refine(data => {
  if (data.priceMin && data.priceMax) {
    return data.priceMin <= data.priceMax;
  }
  return true;
}, {
  message: "Minimum price must be less than maximum price",
  path: ["priceMax"],
}).refine(data => {
  if (data.sizeMin && data.sizeMax) {
    return data.sizeMin <= data.sizeMax;
  }
  return true;
}, {
  message: "Minimum size must be less than maximum size",
  path: ["sizeMax"],
});

// User preferences form schema
export const userPreferencesSchema = z.object({
  maxCommute: z.number().min(5).max(120).nullable().optional(),
  preferredStations: z.array(z.string()).optional(),
  priceRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).nullable().optional(),
  sizeRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).nullable().optional(),
  savedFilters: z.any().nullable().optional(),
});

// List creation form schema
export const createListSchema = z.object({
  name: z.string().min(1, "List name is required").max(100, "List name is too long"),
  type: z.nativeEnum(ListType),
  isPublic: z.boolean().default(false),
  searchParams: z.any().optional(),
});

// Report issue form schema
export const reportIssueSchema = z.object({
  apartmentId: z.string().optional(),
  issueType: z.enum([
    "incorrect_info",
    "unavailable",
    "duplicate",
    "inappropriate",
    "technical",
    "other"
  ]),
  title: z.string().min(5, "Title must be at least 5 characters").max(100, "Title is too long"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000, "Description is too long"),
  contactEmail: z.string().email("Invalid email address").optional(),
});

// Commute configuration form schema
export const commuteConfigSchema = z.object({
  workplaceStationId: z.string().min(1, "Please select a workplace station"),
  maxCommuteMinutes: z.number().min(5).max(120),
  filters: advancedFilterSchema.optional(),
});

// Type exports
export type AdvancedFilterFormData = z.infer<typeof advancedFilterSchema>;
export type UserPreferencesFormData = z.infer<typeof userPreferencesSchema>;
export type CreateListFormData = z.infer<typeof createListSchema>;
export type ReportIssueFormData = z.infer<typeof reportIssueSchema>;
export type CommuteConfigFormData = z.infer<typeof commuteConfigSchema>;