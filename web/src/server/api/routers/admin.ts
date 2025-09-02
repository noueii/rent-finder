import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Schema for unified apartment data
const unifiedApartmentSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceId: z.string(),
  url: z.string(),

  building: z.object({
    name: z.string(),
    nameJa: z.string(),
    type: z.string(),
    yearBuilt: z.number().nullable(),
    totalFloors: z.number().nullable(),
    totalUnits: z.number().nullable(),
    structure: z.string(),
    features: z.array(z.string()),
  }),

  unit: z.object({
    title: z.string(),
    roomNumber: z.string(),
    floor: z.number().nullable(),
    layout: z.string(),
    layoutType: z.string(),
    bedrooms: z.number(),
    hasLivingRoom: z.boolean(),
    hasDiningKitchen: z.boolean(),
    hasKitchen: z.boolean(),
    hasServiceRoom: z.boolean(),
  }),

  size: z.object({
    totalArea: z.number(),
    unit: z.string(),
    balconyArea: z.number(),
    hasBalcony: z.boolean(),
  }),

  location: z.object({
    address: z.string(),
    area: z.string(),
    ward: z.string(),
    wardJa: z.string(),
    city: z.string(),
    prefecture: z.string().optional(),
    postalCode: z.string(),
    coordinates: z.object({
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
    }).optional(),
  }),

  pricing: z.object({
    monthlyRent: z.number(),
    deposit: z.number(),
    keyMoney: z.number(),
    guaranteeFee: z.number(),
    managementFee: z.number(),
    commonServiceFee: z.number(),
    parkingFee: z.number().optional(),
    initialCost: z.number(),
    totalMonthlyCost: z.number(),
  }),

  stations: z.array(z.object({
    name: z.string(),
    line: z.string(),
    walkingMinutes: z.number(),
    distance: z.number().nullable().optional(),
    stationId: z.string().nullable().optional(),
    matchedWith: z.string().optional(),
    matchedWithJa: z.string().optional(),
    matchStatus: z.string().optional(),
  })),

  features: z.array(z.string()),
  amenities: z.array(z.string()),

  images: z.object({
    main: z.array(z.string()),
    floorPlan: z.string(),
    all: z.array(z.string()),
  }),

  availability: z.object({
    status: z.string(),
    availableFrom: z.string().nullable(),
    moveInDate: z.string().nullable(),
    lastUpdated: z.string().nullable(),
  }),

  agency: z.object({
    name: z.string(),
    contact: z.string(),
    phone: z.string(),
    email: z.string(),
  }),

  metadata: z.object({
    scrapedAt: z.string(),
    lastModified: z.string(),
    dataVersion: z.string(),
  }),
});

export const adminRouter = createTRPCRouter({
  // Import stations from transit graph
  importStationsFromGraph: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Read the transit graph
        const fs = await import('fs');
        const path = await import('path');
        const graphPath = path.join(process.cwd(), '../lines/tokyo_transit_graph_complete.json');
        const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

        console.log(`Found ${Object.keys(graphData.stations).length} stations to import`);

        let imported = 0;
        let updated = 0;
        let failed = 0;
        const errors: any[] = [];

        // Import each station
        for (const [stationId, stationData] of Object.entries(graphData.stations as Record<string, any>)) {
          try {
            // Check if station already exists
            const existing = await ctx.db.station.findUnique({
              where: { id: stationId }
            });

            const stationRecord = {
              id: stationId,
              name: stationData.name,
              nameJa: stationData.name_ja || stationData.name,
              lines: JSON.stringify(stationData.lines || []),
              transfers: JSON.stringify(stationData.transfers || []),
              latitude: stationData.coordinates?.[1] || null,
              longitude: stationData.coordinates?.[0] || null,
            };

            if (existing) {
              // Update existing station
              await ctx.db.station.update({
                where: { id: stationId },
                data: stationRecord,
              });
              updated++;
            } else {
              // Create new station
              await ctx.db.station.create({
                data: stationRecord,
              });
              imported++;
            }
          } catch (error) {
            console.error(`Failed to import station ${stationId}:`, error);
            failed++;
            errors.push({ stationId, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }

        const totalStations = await ctx.db.station.count();

        return {
          success: true,
          imported,
          updated,
          failed,
          totalStations,
          errors: errors.slice(0, 10), // Return first 10 errors for debugging
        };
      } catch (error) {
        console.error('Fatal error during import:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to import stations',
        });
      }
    }),
  uploadApartmentData: protectedProcedure
    .input(z.object({
      apartments: z.array(unifiedApartmentSchema),
      metadata: z.any().optional(),
      isFirstBatch: z.boolean(),
      isLastBatch: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const stats = {
        totalApartments: input.apartments.length,
        imported: 0,
        updated: 0,
        failed: 0,
        unmatchedStations: 0,
        bySource: {} as Record<string, number>,
        failureReasons: {} as Record<string, number>,
      };

      // Generate import batch ID for this session
      const importBatchId = input.isFirstBatch ? `import_${Date.now()}` : input.metadata?.importBatchId || `import_${Date.now()}`;

      // Start transaction for batch processing
      const results = await ctx.db.$transaction(async (tx) => {
        const processedResults = [];

        // Log batch info
        if (input.isFirstBatch) {
          console.log('=== Starting apartment import ===');
          console.log(`Total apartments in batch: ${input.apartments.length}`);
          const sources = new Set(input.apartments.map(a => a.source));
          console.log(`Sources in batch: ${Array.from(sources).join(', ')}`);
        }

        for (const apartment of input.apartments) {
          try {
            // Track source
            const source = apartment.source || 'unknown';
            stats.bySource[source] = (stats.bySource[source] || 0) + 1;

            // This will be determined after we try to match stations

            // Process stations - match by name instead of relying on stationId
            const stationMatches = [];
            const unmatchedStations = [];

            // Check if apartment has stations
            if (!apartment.stations || apartment.stations.length === 0) {
              console.log(`Skipping apartment ${apartment.id} (${apartment.source}): No stations data`);
              stats.failed++;
              stats.failureReasons['no_stations_data'] = (stats.failureReasons['no_stations_data'] || 0) + 1;

              // Log the failed import
              await tx.importLog.create({
                data: {
                  importBatchId,
                  externalId: apartment.id,
                  source: apartment.source,
                  sourceUrl: apartment.url,
                  status: 'failed',
                  issueType: 'no_stations_data',
                  issueDetails: JSON.stringify({
                    reason: 'Apartment has no station data',
                    buildingName: apartment.building.name,
                    address: apartment.location.address
                  })
                }
              });

              processedResults.push({
                success: false,
                apartmentId: apartment.id,
                source: apartment.source,
                error: 'No station data available'
              });
              continue;
            }

            for (const aptStation of apartment.stations) {
              // Skip if no station name
              if (!aptStation.name) {
                console.log(`Skipping station without name for apartment ${apartment.id}`);
                continue;
              }

              // First check if we have a station mapping for this name
              const existingMapping = await tx.stationMapping.findFirst({
                where: {
                  aliasName: aptStation.name,
                  aliasLine: aptStation.line || null
                }
              });

              if (existingMapping && existingMapping.stationId) {
                stationMatches.push({
                  stationId: existingMapping.stationId,
                  walkingMinutes: aptStation.walkingMinutes,
                  aliasName: aptStation.name
                });
                continue;
              }

              // Clean up station name for better matching
              let cleanName = aptStation.name.trim();

              // Handle common patterns in station names
              // Remove common suffixes that might not be in the database
              cleanName = cleanName
                .replace(/\s*\(.*?\)\s*$/, '') // Remove content in parentheses
                .replace(/\s+Station$/i, '')    // Remove "Station" suffix
                .replace(/\s+駅$/i, '')         // Remove Japanese "eki" suffix
                .trim();

              // Try to find station by name (exact match first)
              let station = await tx.station.findFirst({
                where: {
                  OR: [
                    { name: cleanName },
                    { nameJa: cleanName },
                    { name: aptStation.name }, // Also try original name
                    { nameJa: aptStation.name }
                  ]
                }
              });

              // If no exact match, try partial match
              if (!station) {
                station = await tx.station.findFirst({
                  where: {
                    OR: [
                      { name: { contains: cleanName } },
                      { nameJa: { contains: cleanName } }
                    ]
                  }
                });
              }

              // If still no match and we have line info, try with line
              if (!station && aptStation.line) {
                const cleanLine = aptStation.line.replace(/line$/i, '').trim();
                station = await tx.station.findFirst({
                  where: {
                    AND: [
                      {
                        OR: [
                          { name: { contains: cleanName } },
                          { nameJa: { contains: cleanName } }
                        ]
                      },
                      {
                        OR: [
                          { lines: { contains: cleanLine } },
                          { transfers: { contains: cleanLine } }
                        ]
                      }
                    ]
                  }
                });
              }

              if (station) {
                stationMatches.push({
                  stationId: station.id,
                  walkingMinutes: aptStation.walkingMinutes,
                  aliasName: aptStation.name
                });

                // Create automatic mapping for future use (check if exists first)
                const existingAutoMapping = await tx.stationMapping.findFirst({
                  where: {
                    aliasName: aptStation.name,
                    aliasLine: aptStation.line || null
                  }
                });

                if (!existingAutoMapping) {
                  await tx.stationMapping.create({
                    data: {
                      aliasName: aptStation.name,
                      aliasLine: aptStation.line || null,
                      stationId: station.id,
                      notes: 'Auto-matched during import',
                      createdAt: new Date()
                    }
                  }).catch((error) => {
                    console.log(`Station mapping already exists for ${aptStation.name}: ${error.message}`);
                  });
                }
              } else {
                unmatchedStations.push({
                  name: aptStation.name,
                  line: aptStation.line,
                  walkingMinutes: aptStation.walkingMinutes
                });
              }
            }

            // If we have unmatched stations, create mapping entries for manual review
            if (unmatchedStations.length > 0) {
              stats.unmatchedStations++;

              // Create unmatched station mapping entries
              for (const unmatched of unmatchedStations) {
                // Check if ANY mapping already exists (mapped or unmapped)
                const existingMapping = await tx.stationMapping.findFirst({
                  where: {
                    aliasName: unmatched.name,
                    aliasLine: unmatched.line || null
                  }
                });

                if (!existingMapping) {
                  await tx.stationMapping.create({
                    data: {
                      aliasName: unmatched.name,
                      aliasLine: unmatched.line || null,
                      stationId: null,  // Null for unmatched stations
                      notes: `Unmatched station from ${apartment.source} import`,
                      createdAt: new Date()
                    }
                  }).catch((error) => {
                    console.log(`Station mapping already exists for ${unmatched.name}: ${error.message}`);
                  });
                }
              }
            }

            // Log warning if no stations could be matched, but continue with import
            if (stationMatches.length === 0) {
              console.log(`Warning: No stations matched for apartment ${apartment.id} (${apartment.source}). Importing with 0 station relations.`);
              console.log(`Unmatched stations: ${unmatchedStations.map(s => s.name).join(', ')}`);

              // Log this as an issue but continue with import
              await tx.importLog.create({
                data: {
                  importBatchId,
                  externalId: apartment.id,
                  source: apartment.source,
                  sourceUrl: apartment.url,
                  status: 'imported_with_issues',
                  issueType: 'unmatched_stations',
                  issueDetails: JSON.stringify({
                    unmatchedStations: unmatchedStations,
                    buildingName: apartment.building.name,
                    address: apartment.location.address
                  })
                }
              });

              // Don't skip - continue with the import
            }

            // Prepare apartment data for database (without station info)
            const apartmentData = {
              externalId: apartment.id,
              source: apartment.source,
              sourceId: apartment.sourceId,
              sourceUrl: apartment.url,
              sourceSite: apartment.source,
              sourceListingId: apartment.sourceId || null,

              // Basic info
              title: apartment.unit.title || apartment.building.name,
              buildingName: apartment.building.name,
              buildingNameJa: apartment.building.nameJa,
              unitNumber: apartment.unit.roomNumber,

              // Pricing
              rentMonthly: apartment.pricing.monthlyRent,
              managementFee: apartment.pricing.managementFee || null,
              deposit: apartment.pricing.deposit || null,
              keyMoney: apartment.pricing.keyMoney || null,
              guaranteeFee: apartment.pricing.guaranteeFee || null,

              // Size and layout
              size: apartment.size.totalArea,
              sizeJo: apartment.size.totalArea / 1.65, // Convert m² to jo
              layout: apartment.unit.layout,
              layoutDetails: JSON.stringify({
                bedrooms: apartment.unit.bedrooms,
                hasLivingRoom: apartment.unit.hasLivingRoom,
                hasDiningKitchen: apartment.unit.hasDiningKitchen,
                hasKitchen: apartment.unit.hasKitchen,
              }),

              // Location
              address: apartment.location.address,
              ward: apartment.location.ward || null,
              area: apartment.location.area || null,
              city: apartment.location.city,
              prefecture: apartment.location.prefecture || 'Tokyo',
              addressDetails: JSON.stringify({
                postalCode: apartment.location.postalCode,
                ward: apartment.location.ward,
                area: apartment.location.area,
              }),

              // Building details
              buildingType: apartment.building.type,
              buildYear: apartment.building.yearBuilt,
              buildingAge: apartment.building.yearBuilt
                ? new Date().getFullYear() - apartment.building.yearBuilt
                : null,
              totalFloors: apartment.building.totalFloors,
              floor: apartment.unit.floor?.toString() || null,

              // Features and amenities
              features: JSON.stringify([...apartment.features, ...apartment.amenities]),
              nearbyFacilities: JSON.stringify(apartment.stations.map(s => `${s.name} Station (${s.walkingMinutes} min walk)`)),

              // Images
              imageUrls: JSON.stringify(apartment.images.all),
              floorPlanUrl: apartment.images.floorPlan,

              // Availability
              isAvailable: apartment.availability.status === 'available',
              availableFrom: apartment.availability.availableFrom
                ? new Date(apartment.availability.availableFrom)
                : null,

              // Metadata
              scrapedAt: new Date(apartment.metadata.scrapedAt),
            };

            // Check if apartment already exists
            const existing = await tx.apartment.findFirst({
              where: {
                OR: [
                  { externalId: apartment.id },
                  { sourceId: apartment.sourceId, source: apartment.source }
                ]
              }
            });

            let apartmentId: string;

            if (existing) {
              // Update existing apartment
              await tx.apartment.update({
                where: { id: existing.id },
                data: apartmentData,
              });
              apartmentId = existing.id;
              stats.updated++;

              // Delete existing station relationships to recreate them
              await tx.apartmentStation.deleteMany({
                where: { apartmentId: existing.id }
              });
            } else {
              // Create new apartment
              const newApartment = await tx.apartment.create({
                data: apartmentData,
              });
              apartmentId = newApartment.id;
              stats.imported++;
            }

            // Create ApartmentStation entries for ALL stations (matched and unmatched)
            const seenStationNames = new Set<string>();

            for (let i = 0; i < apartment.stations.length; i++) {
              const aptStation = apartment.stations[i];

              // Skip if no station name
              if (!aptStation.name) continue;

              // Skip duplicate station names (same station referenced multiple times)
              const stationKey = `${aptStation.name}-${aptStation.line || ''}`;
              if (seenStationNames.has(stationKey)) {
                console.log(`Skipping duplicate station ${aptStation.name} for apartment ${apartment.id}`);
                continue;
              }

              seenStationNames.add(stationKey);

              // Find if this station was matched
              const matchedStation = stationMatches.find(m => m.aliasName === aptStation.name);

              const apartmentStationData = {
                apartmentId,
                stationId: matchedStation?.stationId || null, // null if unmatched
                originalStationName: aptStation.name,
                originalLine: aptStation.line || null,
                walkingMinutes: aptStation.walkingMinutes,
                isPrimary: i === 0, // First station is primary
              };

              try {
                await tx.apartmentStation.create({
                  data: apartmentStationData,
                });
              } catch (error: any) {
                // Check if it's a unique constraint violation
                if (error.code === 'P2002') {
                  console.log(`Station relation already exists for apartment ${apartmentId} and station ${aptStation.name}`);
                } else {
                  throw error; // Re-throw if it's a different error
                }
              }
            }

            // Update the ImportLog entry with the apartment ID if we logged an issue
            if (stationMatches.length === 0) {
              await tx.importLog.updateMany({
                where: {
                  importBatchId,
                  externalId: apartment.id,
                  status: 'imported_with_issues'
                },
                data: {
                  apartmentId: apartmentId
                }
              });
            }

            processedResults.push({ success: true, apartmentId: apartment.id });
          } catch (error) {
            console.error(`Failed to import apartment ${apartment.id} (${apartment.source}):`, error);
            stats.failed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            stats.failureReasons[errorMessage] = (stats.failureReasons[errorMessage] || 0) + 1;

            // Log the failed import
            await tx.importLog.create({
              data: {
                importBatchId,
                externalId: apartment.id,
                source: apartment.source,
                sourceUrl: apartment.url,
                status: 'failed',
                issueType: 'import_error',
                issueDetails: JSON.stringify({
                  error: errorMessage,
                  buildingName: apartment.building?.name,
                  address: apartment.location?.address
                })
              }
            }).catch(err => {
              console.error('Failed to log import error:', err);
            });

            processedResults.push({
              success: false,
              apartmentId: apartment.id,
              source: apartment.source,
              error: errorMessage
            });
          }
        }

        // Store metadata if this is the last batch
        if (input.isLastBatch && input.metadata) {
          await tx.importMetadata.create({
            data: {
              source: 'unified_json',
              importDate: new Date(),
              metadata: JSON.stringify(input.metadata),
              stats: JSON.stringify(stats),
            },
          });
        }

        return processedResults;
      });

      // Log final statistics if last batch
      if (input.isLastBatch) {
        console.log('=== Import Summary ===');
        console.log('Total apartments processed:', stats.totalApartments);
        console.log('By source:', stats.bySource);
        console.log('Imported:', stats.imported);
        console.log('Updated:', stats.updated);
        console.log('Failed:', stats.failed);
        console.log('Failure reasons:', stats.failureReasons);
      }

      return {
        success: true,
        stats,
        results: results,
        importBatchId,
      };
    }),

  // Get station mapping corrections
  getStationMappings: protectedProcedure
    .query(async ({ ctx }) => {
      const mappings = await ctx.db.stationMapping.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return mappings;
    }),

  // Save station mapping correction
  saveStationMapping: protectedProcedure
    .input(z.object({
      aliasName: z.string(),
      aliasLine: z.string().optional(),
      stationId: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const mapping = await ctx.db.stationMapping.create({
        data: {
          aliasName: input.aliasName,
          aliasLine: input.aliasLine || '',
          stationId: input.stationId,
          notes: input.notes,
          createdAt: new Date(),
        },
      });

      return mapping;
    }),

  // Get unmapped stations
  getUnmappedStations: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const unmapped = await ctx.db.stationMapping.findMany({
        where: {
          stationId: null
        },
        orderBy: [
          { aliasName: 'asc' },
          { aliasLine: 'asc' }
        ],
        take: input?.limit || 50,
        skip: input?.offset || 0,
      });

      const total = await ctx.db.stationMapping.count({
        where: { stationId: null }
      });

      return {
        stations: unmapped,
        total,
      };
    }),

  // Get next unmapped station alias
  getNextUnmappedStation: protectedProcedure
    .input(z.object({
      skipId: z.string().optional(), // Skip this ID to get the next one
    }).optional())
    .query(async ({ ctx, input }) => {
      // Get all unmapped aliases (those without stationId)
      const unmappedAliases = await ctx.db.stationMapping.findMany({
        where: {
          stationId: null,
          id: input?.skipId ? { not: input.skipId } : undefined,
        },
        orderBy: [
          { aliasName: 'asc' },
          { aliasLine: 'asc' }
        ],
      });

      if (unmappedAliases.length === 0) {
        return null;
      }

      // Count apartments for each alias and sort by count
      const aliasesWithCounts = await Promise.all(
        unmappedAliases.slice(0, 50).map(async (alias) => {
          // Count apartments that use this station alias
          const count = await ctx.db.apartmentStation.count({
            where: {
              originalStationName: alias.aliasName,
              stationId: null // Only count unmapped apartment-station relationships
            }
          });
          return { ...alias, affectedApartments: count };
        })
      );

      // Filter out aliases with 0 apartments and sort by apartment count (descending)
      const aliasesWithApartments = aliasesWithCounts
        .filter(a => a.affectedApartments > 0)
        .sort((a, b) => b.affectedApartments - a.affectedApartments);

      const next = aliasesWithApartments[0];

      if (!next) {
        return null;
      }

      // Get sample apartments affected by this unmapped alias
      const sampleApartments = await ctx.db.apartmentStation.findMany({
        where: {
          originalStationName: next.aliasName,
          stationId: null
        },
        take: 3,
        select: {
          apartmentId: true
        }
      });

      // Calculate total unique apartments remaining to be mapped
      const totalApartmentsRemaining = await ctx.db.apartmentStation.count({
        where: {
          stationId: null // Count all apartment-station relationships without a mapped station
        }
      });

      return {
        id: next.id,
        aliasName: next.aliasName,
        aliasLine: next.aliasLine,
        affectedApartments: next.affectedApartments,
        sampleApartmentIds: sampleApartments.map(apt => apt.apartmentId),
        totalApartmentsRemaining,
        totalUnmappedStations: aliasesWithApartments.length,
      };
    }),

  // Update station mapping
  updateStationMapping: protectedProcedure
    .input(z.object({
      id: z.string(),
      stationId: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // First get the station mapping details
      const stationMapping = await ctx.db.stationMapping.findUnique({
        where: { id: input.id }
      });

      if (!stationMapping) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Station mapping not found',
        });
      }

      // Update the station mapping
      const updated = await ctx.db.stationMapping.update({
        where: { id: input.id },
        data: {
          stationId: input.stationId,
          notes: input.notes,
        },
      });

      // Update all ApartmentStation entries that use this alias
      console.log(`Manual mapping: Looking for ApartmentStation entries with originalStationName='${stationMapping.aliasName}' (ignoring line)`);

      // Handle null line values more flexibly
      const whereClause = {
        originalStationName: stationMapping.aliasName,
        stationId: null // Only update unmapped entries
      } as any;



      const apartmentsUpdated = await ctx.db.apartmentStation.updateMany({
        where: whereClause,
        data: {
          stationId: input.stationId
        }
      });

      console.log(`Manual mapping: Updated ${apartmentsUpdated.count} ApartmentStation entries for ${stationMapping.aliasName}`);

      console.log(`Manual mapping of ${stationMapping.aliasName} updated ${apartmentsUpdated.count} apartment-station relationships`);

      return updated;
    }),

  // Get all stations for dropdown
  getAllStations: protectedProcedure
    .query(async ({ ctx }) => {
      const stations = await ctx.db.station.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          nameJa: true,
          lines: true,
        },
      });

      return stations.map(station => ({
        ...station,
        lines: JSON.parse(station.lines || '[]'),
      }));
    }),

  // Get all lines with their names
  getAllLines: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Read line data from the files
        const fs = await import('fs');
        const path = await import('path');
        const linesDir = path.join(process.cwd(), '../lines/line_data');

        const lineFiles = fs.readdirSync(linesDir).filter(file => file.endsWith('.json'));
        const lines = [];

        for (const file of lineFiles) {
          try {
            const filePath = path.join(linesDir, file);
            const lineData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            lines.push({
              id: lineData.navitime_id,
              name: lineData.line,
              operator: lineData.operator,
            });
          } catch (error) {
            console.error(`Error reading line file ${file}:`, error);
          }
        }

        return lines.sort((a, b) => a.name.localeCompare(b.name));
      } catch (error) {
        console.error('Error reading line data:', error);
        return [];
      }
    }),

  // Get single apartment by ID
  getApartment: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const apartment = await ctx.db.apartment.findUnique({
        where: { id: input.id },
        include: {
          stations: {
            include: {
              station: true,
            },
          },
        },
      });

      if (!apartment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Apartment not found',
        });
      }

      // Parse JSON fields
      return {
        ...apartment,
        features: JSON.parse(apartment.features || '[]'),
        nearbyFacilities: JSON.parse(apartment.nearbyFacilities || '[]'),
        imageUrls: JSON.parse(apartment.imageUrls || '[]'),
        layoutDetails: apartment.layoutDetails ? JSON.parse(apartment.layoutDetails) : null,
        addressDetails: apartment.addressDetails ? JSON.parse(apartment.addressDetails) : null,
      };
    }),

  // Get import history
  getImportHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const imports = await ctx.db.importMetadata.findMany({
        orderBy: { importDate: 'desc' },
        take: 10,
      });

      return imports;
    }),

  // Get import logs for failed/problematic apartments
  getImportLogs: protectedProcedure
    .input(z.object({
      importBatchId: z.string().optional(),
      status: z.enum(['failed', 'imported_with_issues', 'all']).optional(),
      limit: z.number().default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input?.importBatchId) {
        where.importBatchId = input.importBatchId;
      }

      if (input?.status && input.status !== 'all') {
        where.status = input.status;
      }

      const logs = await ctx.db.importLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input?.limit || 100,
      });

      // Get summary stats
      const summary = await ctx.db.importLog.groupBy({
        by: ['status', 'issueType'],
        where: input?.importBatchId ? { importBatchId: input.importBatchId } : {},
        _count: true,
      });

      return {
        logs,
        summary,
      };
    }),

  // Delete all apartments
  deleteAllApartments: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Delete in order to respect foreign key constraints
        await ctx.db.apartmentStation.deleteMany({});
        await ctx.db.searchResult.deleteMany({});
        await ctx.db.priceHistory.deleteMany({});
        await ctx.db.importLog.deleteMany({});
        const result = await ctx.db.apartment.deleteMany({});

        return {
          success: true,
          deletedCount: result.count,
        };
      } catch (error) {
        console.error('Error deleting apartments:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete apartments',
        });
      }
    }),

  // Clean up orphaned station mappings
  cleanupOrphanedMappings: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Get all unmapped station mappings
      const unmappedStations = await ctx.db.stationMapping.findMany({
        where: { stationId: null }
      });

      let deletedCount = 0;

      // Check each one for associated apartments
      for (const station of unmappedStations) {
        // Check both ImportLog for current issues AND check if any apartments were actually imported
        const importLogCount = await ctx.db.importLog.count({
          where: {
            issueType: 'unmatched_stations',
            issueDetails: {
              contains: station.aliasName
            },
            apartmentId: {
              not: null  // Only count logs that have actual apartments
            }
          }
        });

        // If no apartments reference this mapping, delete it
        if (importLogCount === 0) {
          await ctx.db.stationMapping.delete({
            where: { id: station.id }
          });
          deletedCount++;
        }
      }

      return {
        success: true,
        deletedCount,
      };
    }),

  // Auto-map all unmapped stations with high-confidence matches
  autoMapStations: protectedProcedure
    .input(z.object({
      minScore: z.number().default(80), // Minimum score to auto-map (80 = good match)
    }))
    .mutation(async ({ input, ctx }) => {
      // Get all unmapped stations
      const unmappedStations = await ctx.db.stationMapping.findMany({
        where: { stationId: null },
        orderBy: { aliasName: 'asc' }
      });

      if (unmappedStations.length === 0) {
        return {
          success: true,
          processed: 0,
          mapped: 0,
          skipped: 0,
          results: [],
        };
      }

      // Get all stations for matching
      const allStations = await ctx.db.station.findMany({
        select: {
          id: true,
          name: true,
          nameJa: true,
          lines: true,
        },
      });

      // Use the same normalization logic as the dropdown
      const normalizeStationName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/\s+station$/i, '') // Remove "Station" suffix
          .replace(/\s+駅$/i, '')      // Remove Japanese "eki" suffix
          .replace(/^jr\s+/i, '')      // Remove "JR" prefix
          .replace(/[\s-・－−‐]/g, '') // Remove all spaces, dashes, and Japanese separators
          .trim();
      };

      // Calculate similarity between two strings with Japanese romanization awareness
      const calculateSimilarity = (str1: string, str2: string): number => {
        if (str1 === str2) return 100;
        if (str1.length === 0 || str2.length === 0) return 0;
        
        // Pre-process strings for Japanese romanization variations
        const normalizeForJapanese = (str: string): string => {
          return str
            .replace(/ou/g, 'o')    // "ou" -> "o" (Tokyo vs Toukyou)
            .replace(/uu/g, 'u')    // "uu" -> "u" (Kyushu vs Kyuushuu)
            .replace(/oo/g, 'o')    // "oo" -> "o" (Osaka vs Oosaka)
            .replace(/aa/g, 'a')    // "aa" -> "a" (Sapporo vs Saapporo)
            .replace(/ei/g, 'e')    // "ei" -> "e" (Kei vs Kee)
            .replace(/nn/g, 'n')    // Double n normalization
            .replace(/mm/g, 'm')    // Double m normalization
            .replace(/pp/g, 'p')    // Double p normalization
            .replace(/tt/g, 't')    // Double t normalization
            .replace(/kk/g, 'k')    // Double k normalization
            .replace(/ss/g, 's');   // Double s normalization
        };
        
        const norm1 = normalizeForJapanese(str1);
        const norm2 = normalizeForJapanese(str2);
        
        // Levenshtein distance calculation with reduced cost for vowel variations
        const matrix = [];
        const len1 = norm1.length;
        const len2 = norm2.length;
        
        // Initialize matrix
        for (let i = 0; i <= len1; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
          matrix[0][j] = j;
        }
        
        // Helper function to get substitution cost
        const getSubstitutionCost = (char1: string, char2: string): number => {
          if (char1 === char2) return 0;
          
          // Reduced cost for similar vowels
          const vowelGroups = [
            ['a', 'aa'],
            ['e', 'ee', 'ei'],
            ['i', 'ii'],
            ['o', 'oo', 'ou'],
            ['u', 'uu']
          ];
          
          for (const group of vowelGroups) {
            if (group.includes(char1) && group.includes(char2)) {
              return 0.3; // Much lower cost for vowel variations
            }
          }
          
          // Reduced cost for similar consonants
          const consonantGroups = [
            ['n', 'nn'],
            ['m', 'mm'],
            ['p', 'pp'],
            ['t', 'tt'],
            ['k', 'kk'],
            ['s', 'ss']
          ];
          
          for (const group of consonantGroups) {
            if (group.includes(char1) && group.includes(char2)) {
              return 0.5; // Lower cost for consonant doubling
            }
          }
          
          return 1; // Standard substitution cost
        };
        
        // Fill matrix with weighted costs
        for (let i = 1; i <= len1; i++) {
          for (let j = 1; j <= len2; j++) {
            const cost = getSubstitutionCost(norm1[i - 1], norm2[j - 1]);
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,           // deletion
              matrix[i][j - 1] + 1,           // insertion
              matrix[i - 1][j - 1] + cost     // substitution
            );
          }
        }
        
        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);
        
        // Convert to similarity percentage
        return Math.round(((maxLen - distance) / maxLen) * 100);
      };

      const results = [];
      let mapped = 0;
      let skipped = 0;

      // Process each unmapped station
      for (const stationMapping of unmappedStations) {
        const query = normalizeStationName(stationMapping.aliasName);

        console.log(`\n=== Processing station mapping: "${stationMapping.aliasName}" (normalized: "${query}") ===`);

        // Find best match
        let bestMatch = null;
        let bestScore = 0;
        let allMatches = []; // Track all matches for debugging

        for (const station of allStations) {
          const nameLower = station.name.toLowerCase();
          const nameJaLower = station.nameJa.toLowerCase();
          const nameNormalized = normalizeStationName(station.name);
          const nameJaNormalized = normalizeStationName(station.nameJa);
          const stationLines = JSON.parse(station.lines || '[]');

          let score = 0;
          let matchType = '';

          // Skip if query is empty
          if (!query) continue;

          // Normalized exact matches get highest score
          if (nameNormalized === query || nameJaNormalized === query) {
            score = 120;
            matchType = 'exact (normalized)';
          }
          // Original exact matches get very high score 
          else if (nameLower === stationMapping.aliasName.toLowerCase() ||
            nameJaLower === stationMapping.aliasName.toLowerCase()) {
            score = 100;
            matchType = 'exact';
          }
          // Normalized starts with query gets high score
          else if (nameNormalized.startsWith(query) || nameJaNormalized.startsWith(query)) {
            score = 90;
            matchType = 'starts with (normalized)';
          }
          // Original starts with query gets high score
          else if (nameLower.startsWith(stationMapping.aliasName.toLowerCase())) {
            score = 80;
            matchType = 'starts with';
          }
          // Fuzzy matching for slight variations and typos
          else {
            const nameSimilarity = calculateSimilarity(nameNormalized, query);
            const nameJaSimilarity = calculateSimilarity(nameJaNormalized, query);
            const originalSimilarity = Math.max(
              calculateSimilarity(nameLower, stationMapping.aliasName.toLowerCase()),
              calculateSimilarity(nameJaLower, stationMapping.aliasName.toLowerCase())
            );
            
            const bestSimilarity = Math.max(nameSimilarity, nameJaSimilarity, originalSimilarity);
            
            // For auto-mapping, use fuzzy matching with reasonable threshold
            // Require good similarity (75%+) but not too restrictive
            if (bestSimilarity >= 75) {
              score = Math.round(bestSimilarity * 0.8); // Scale down but keep competitive scores
              matchType = `fuzzy (${bestSimilarity}% similar)`;
            } else {
              continue; // Skip low-confidence fuzzy matches
            }
          }

          // Bonus points for major stations (those with multiple lines)
          if (stationLines.length > 2) {
            score += 10;
          }

          // Bonus for stations without parentheses (main stations vs sub-stations)
          if (!station.name.includes('(')) {
            score += 5;
          }

          // Track all matches for debugging
          if (score > 0) {
            allMatches.push({
              name: station.name,
              nameJa: station.nameJa,
              score,
              matchType
            });
          }

          // Update best match if this is better
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { ...station, score, matchType, lines: stationLines };
          }
        }

        // Show top matches for debugging
        const topMatches = allMatches
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        
        console.log(`Top matches for "${stationMapping.aliasName}":`);
        topMatches.forEach((match, i) => {
          console.log(`  ${i + 1}. ${match.name} (${match.nameJa}) - Score: ${match.score} - ${match.matchType}`);
        });
        
        if (bestMatch) {
          console.log(`Best match: ${bestMatch.name} - Score: ${bestScore} - Required: ${input.minScore}`);
        } else {
          console.log('No matches found');
        }

        // Auto-map if score is high enough
        if (bestMatch && bestScore >= input.minScore) {
          try {
            // Update the station mapping
            await ctx.db.stationMapping.update({
              where: { id: stationMapping.id },
              data: {
                stationId: bestMatch.id,
                notes: `Auto-mapped (${bestMatch.matchType}, score: ${bestScore})`,
              },
            });

            // Update all ApartmentStation entries that use this alias
            console.log(`Auto-mapping: Looking for ApartmentStation entries with originalStationName='${stationMapping.aliasName}' (ignoring line)`);

            // First, let's see what we're trying to match
            const matchingEntries = await ctx.db.apartmentStation.findMany({
              where: {
                originalStationName: stationMapping.aliasName,
                stationId: null // Only unmapped entries
              },
              select: {
                id: true,
                originalStationName: true,
                originalLine: true,
                stationId: true
              },
              take: 5
            });

            console.log(`Found ${matchingEntries.length} potential matches:`, matchingEntries);

            // Ignore line information completely - just match by station name
            const whereClause = {
              originalStationName: stationMapping.aliasName,
              stationId: null // Only update unmapped entries
            };

            const apartmentsUpdated = await ctx.db.apartmentStation.updateMany({
              where: whereClause,
              data: {
                stationId: bestMatch.id
              }
            });

            console.log(`Auto-mapping: Updated ${apartmentsUpdated.count} ApartmentStation entries for ${stationMapping.aliasName}`);

            mapped++;
            results.push({
              aliasName: stationMapping.aliasName,
              originalLine: stationMapping.aliasLine,
              mappedTo: bestMatch.name,
              mappedToJa: bestMatch.nameJa,
              score: bestScore,
              matchType: bestMatch.matchType,
              status: 'mapped',
              apartmentsUpdated: apartmentsUpdated.count,
            });
          } catch (error) {
            results.push({
              aliasName: stationMapping.aliasName,
              originalLine: stationMapping.aliasLine,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        } else {
          skipped++;
          results.push({
            aliasName: stationMapping.aliasName,
            aliasLine: stationMapping.aliasLine,
            status: 'skipped',
            bestScore: bestScore,
            reason: bestScore === 0 ? 'No matches found' : `Score too low (${bestScore} < ${input.minScore})`,
          });
        }
      }

      return {
        success: true,
        processed: unmappedStations.length,
        mapped,
        skipped,
        results,
      };
    }),

  // Sync station mappings with apartment relationships
  syncStationMappings: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Get all mapped stations (those that have been resolved)
      const mappedStations = await ctx.db.stationMapping.findMany({
        where: {
          stationId: { not: null }
        },
        include: {
          station: true
        }
      });

      const results = [];
      let apartmentsLinked = 0;
      let skippedAlreadyLinked = 0;
      let errorsEncountered = 0;

      // For each mapped station, update any unmapped ApartmentStation entries
      for (const mapping of mappedStations) {
        if (!mapping.stationId) continue;

        try {
          // Update all ApartmentStation entries that match this alias but don't have a stationId
          console.log(`Sync: Looking for ApartmentStation entries with originalStationName='${mapping.aliasName}' (ignoring line)`);

          // Ignore line information completely - just match by station name
          const whereClause = {
            originalStationName: mapping.aliasName,
            stationId: null // Only update unmapped entries
          };

          const updateResult = await ctx.db.apartmentStation.updateMany({
            where: whereClause,
            data: {
              stationId: mapping.stationId
            }
          });

          console.log(`Sync: Updated ${updateResult.count} ApartmentStation entries for ${mapping.aliasName}`);

          // Count existing mapped entries for reporting (ignore line)
          const existingMapped = await ctx.db.apartmentStation.count({
            where: {
              originalStationName: mapping.aliasName,
              stationId: mapping.stationId
            }
          });

          const linkedForThisStation = updateResult.count;
          const skippedForThisStation = existingMapped - linkedForThisStation; // Already mapped before this sync

          apartmentsLinked += linkedForThisStation;
          skippedAlreadyLinked += skippedForThisStation;

          if (linkedForThisStation > 0 || skippedForThisStation > 0) {
            results.push({
              stationName: mapping.aliasName,
              mappedTo: mapping.station?.name || 'Unknown',
              apartmentsLinked: linkedForThisStation,
              apartmentsSkipped: skippedForThisStation,
              status: 'processed'
            });
          }
        } catch (error) {
          errorsEncountered++;
          results.push({
            stationName: mapping.aliasName,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        success: true,
        summary: {
          mappedStationsProcessed: mappedStations.length,
          apartmentsLinked,
          apartmentsSkipped: skippedAlreadyLinked,
          errorsEncountered
        },
        results: results.slice(0, 50) // Return first 50 results
      };
    }),

  // Match stations from unified data to database stations
  matchStations: protectedProcedure
    .input(z.object({
      stationNames: z.array(z.object({
        name: z.string(),
        line: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const matches = [];

      for (const stationInput of input.stationNames) {
        // Try to find exact match
        let station = await ctx.db.station.findFirst({
          where: {
            OR: [
              { name: stationInput.name },
              { nameJa: stationInput.name },
            ]
          }
        });

        // If no exact match, try fuzzy match
        if (!station && stationInput.line) {
          station = await ctx.db.station.findFirst({
            where: {
              AND: [
                {
                  OR: [
                    { name: { contains: stationInput.name } },
                    { nameJa: { contains: stationInput.name } },
                  ]
                },
                {
                  lines: { contains: stationInput.line }
                }
              ]
            }
          });
        }

        matches.push({
          aliasName: stationInput.name,
          aliasLine: stationInput.line,
          matched: !!station,
          stationId: station?.id || null,
          stationName: station?.name || null,
          stationNameJa: station?.nameJa || null,
        });
      }

      return matches;
    }),
});
