import type { Station, StationLine, TrainLine } from '@prisma/client';

// Re-export base types
export type { Station, StationLine, TrainLine } from '@prisma/client';

// Station with line information
export interface StationWithLines extends Station {
  lines: (StationLine & {
    line: TrainLine;
  })[];
}

// Station search result
export interface StationSearchResult {
  station: StationWithLines;
  score: number;
}