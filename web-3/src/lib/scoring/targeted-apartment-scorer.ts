import type { Apartment, Route, UserPreference, NearestStation, Station } from "@prisma/client";

export interface ApartmentWithFullRelations extends Apartment {
  routes?: Route[];
  nearestStations?: (NearestStation & { station: Station })[];
  score?: number;
  scoreBreakdown?: TargetedScoreBreakdown;
}

export interface TargetedScoreBreakdown {
  // Individual scores (0-100, where 100 is perfect match)
  commuteTime: number;
  price: number;
  size: number;
  age: number;
  floor: number;
  walkTime: number;
  
  // Weighted scores
  weighted: {
    commuteTime: number;
    price: number;
    size: number;
    age: number;
    floor: number;
    walkTime: number;
  };
  
  // Explanations for each score
  explanations: {
    commuteTime: string;
    price: string;
    size: string;
    age: string;
    floor: string;
    walkTime: string;
  };
}

export interface TargetedScoringWeights {
  commuteTimeWeight: number;
  priceWeight: number;
  sizeWeight: number;
  ageWeight: number;
  floorWeight: number;
  walkTimeWeight: number;
}

export interface TargetValues {
  targetPrice?: number;      // Target monthly rent
  targetSize?: number;       // Target size in m²
  targetCommute?: number;    // Target commute time in minutes
  targetAge?: number;        // Target building age in years
  targetFloor?: number;      // Target floor number
  targetWalkTime?: number;   // Target walking time to station in minutes
}

export interface TargetedScoringConfig {
  // Target values for each parameter
  targetValues?: TargetValues;
  
  // Target station for commute calculation
  targetStationId?: string;
  
  // Penalty rates (how much to penalize per unit of negative deviation)
  penaltyRates?: {
    pricePenaltyPerThousand?: number;     // Points lost per ¥1000 over target
    sizePenaltyPerSqm?: number;           // Points lost per m² under target
    commutePenaltyPerMinute?: number;     // Points lost per minute over target
    agePenaltyPerYear?: number;           // Points lost per year over target
    floorPenaltyPerFloor?: number;        // Points lost per floor difference
    walkTimePenaltyPerMinute?: number;    // Points lost per minute over target
  };
}

export class TargetedApartmentScorer {
  private weights: TargetedScoringWeights;
  private config: TargetedScoringConfig;

  constructor(
    weights: TargetedScoringWeights = {
      commuteTimeWeight: 25,
      priceWeight: 25,
      sizeWeight: 20,
      ageWeight: 10,
      floorWeight: 10,
      walkTimeWeight: 10,
    },
    config: TargetedScoringConfig = {}
  ) {
    this.weights = weights;
    this.config = {
      targetValues: config.targetValues || {},
      targetStationId: config.targetStationId,
      penaltyRates: {
        pricePenaltyPerThousand: 1,      // Lose 1 point per ¥1000 over target
        sizePenaltyPerSqm: 2,             // Lose 2 points per m² under target
        commutePenaltyPerMinute: 2,      // Lose 2 points per minute over target
        agePenaltyPerYear: 1,             // Lose 1 point per year over target
        floorPenaltyPerFloor: 5,          // Lose 5 points per floor difference
        walkTimePenaltyPerMinute: 3,      // Lose 3 points per minute over target
        ...config.penaltyRates,
      },
    };
  }

  /**
   * Calculate score for a single apartment using targeted parameters
   * Only penalizes negative deviations (worse than target)
   */
  calculateScore(apartment: ApartmentWithFullRelations): ApartmentWithFullRelations {
    const breakdown: TargetedScoreBreakdown = {
      commuteTime: 100,
      price: 100,
      size: 100,
      age: 100,
      floor: 100,
      walkTime: 100,
      weighted: {
        commuteTime: 0,
        price: 0,
        size: 0,
        age: 0,
        floor: 0,
        walkTime: 0,
      },
      explanations: {
        commuteTime: '',
        price: '',
        size: '',
        age: '',
        floor: '',
        walkTime: '',
      },
    };

    const targets = this.config.targetValues || {};
    const penalties = this.config.penaltyRates!;

    // 1. Commute Time Score (only penalize if longer than target)
    if (this.weights.commuteTimeWeight > 0 && targets.targetCommute !== undefined) {
      let commuteMinutes: number | null = null;
      
      if (apartment.routes && apartment.routes.length > 0) {
        // Find the best route to the target station
        let bestRoute = apartment.routes[0];
        if (this.config.targetStationId) {
          const targetRoute = apartment.routes.find(r => r.toStationId === this.config.targetStationId);
          if (targetRoute) bestRoute = targetRoute;
        }
        commuteMinutes = bestRoute.duration;
      }
      
      if (commuteMinutes !== null) {
        const deviation = commuteMinutes - targets.targetCommute;
        if (deviation > 0) {
          // Penalize for being over target
          breakdown.commuteTime = Math.max(0, 100 - (deviation * penalties.commutePenaltyPerMinute!));
          breakdown.explanations.commuteTime = `${commuteMinutes}min (${deviation}min over target)`;
        } else {
          // At or under target is perfect
          breakdown.commuteTime = 100;
          breakdown.explanations.commuteTime = `${commuteMinutes}min (meets target)`;
        }
      } else {
        breakdown.commuteTime = 0;
        breakdown.explanations.commuteTime = 'No route data available';
      }
    }

    // 2. Price Score (only penalize if more expensive than target)
    if (this.weights.priceWeight > 0 && targets.targetPrice !== undefined && apartment.price) {
      const deviation = apartment.price - targets.targetPrice;
      if (deviation > 0) {
        // Penalize for being over target
        const penaltyPoints = (deviation / 1000) * penalties.pricePenaltyPerThousand!;
        breakdown.price = Math.max(0, 100 - penaltyPoints);
        breakdown.explanations.price = `¥${apartment.price.toLocaleString()} (¥${Math.round(deviation).toLocaleString()} over target)`;
      } else {
        // At or under target is perfect
        breakdown.price = 100;
        breakdown.explanations.price = `¥${apartment.price.toLocaleString()} (meets target)`;
      }
    }

    // 3. Size Score (only penalize if smaller than target)
    if (this.weights.sizeWeight > 0 && targets.targetSize !== undefined && apartment.size) {
      const deviation = targets.targetSize - apartment.size;
      if (deviation > 0) {
        // Penalize for being under target
        breakdown.size = Math.max(0, 100 - (deviation * penalties.sizePenaltyPerSqm!));
        breakdown.explanations.size = `${apartment.size}m² (${deviation.toFixed(1)}m² under target)`;
      } else {
        // At or over target is perfect
        breakdown.size = 100;
        breakdown.explanations.size = `${apartment.size}m² (meets target)`;
      }
    }

    // 4. Building Age Score (only penalize if older than target)
    if (this.weights.ageWeight > 0 && targets.targetAge !== undefined && apartment.buildingAge !== null && apartment.buildingAge !== undefined) {
      const deviation = apartment.buildingAge - targets.targetAge;
      if (deviation > 0) {
        // Penalize for being older than target
        breakdown.age = Math.max(0, 100 - (deviation * penalties.agePenaltyPerYear!));
        breakdown.explanations.age = `${apartment.buildingAge}yr old (${deviation}yr older than target)`;
      } else {
        // At or newer than target is perfect
        breakdown.age = 100;
        breakdown.explanations.age = `${apartment.buildingAge}yr old (meets target)`;
      }
    }

    // 5. Floor Score (penalize for deviation from target floor)
    if (this.weights.floorWeight > 0 && targets.targetFloor !== undefined && apartment.floor !== null && apartment.floor !== undefined) {
      const deviation = Math.abs(apartment.floor - targets.targetFloor);
      if (deviation > 0) {
        breakdown.floor = Math.max(0, 100 - (deviation * penalties.floorPenaltyPerFloor!));
        const direction = apartment.floor > targets.targetFloor ? 'higher' : 'lower';
        breakdown.explanations.floor = `${apartment.floor}F (${deviation} floor${deviation > 1 ? 's' : ''} ${direction} than target)`;
      } else {
        breakdown.floor = 100;
        breakdown.explanations.floor = `${apartment.floor}F (perfect match)`;
      }
    }

    // 6. Walking Time Score (only penalize if longer than target)
    if (this.weights.walkTimeWeight > 0 && targets.targetWalkTime !== undefined && apartment.nearestStations && apartment.nearestStations.length > 0) {
      const walkingMinutes = apartment.nearestStations[0].walkingMinutes;
      const deviation = walkingMinutes - targets.targetWalkTime;
      if (deviation > 0) {
        // Penalize for being over target
        breakdown.walkTime = Math.max(0, 100 - (deviation * penalties.walkTimePenaltyPerMinute!));
        breakdown.explanations.walkTime = `${walkingMinutes}min walk (${deviation}min over target)`;
      } else {
        // At or under target is perfect
        breakdown.walkTime = 100;
        breakdown.explanations.walkTime = `${walkingMinutes}min walk (meets target)`;
      }
    }

    // Calculate weighted scores
    breakdown.weighted.commuteTime = (breakdown.commuteTime * this.weights.commuteTimeWeight) / 100;
    breakdown.weighted.price = (breakdown.price * this.weights.priceWeight) / 100;
    breakdown.weighted.size = (breakdown.size * this.weights.sizeWeight) / 100;
    breakdown.weighted.age = (breakdown.age * this.weights.ageWeight) / 100;
    breakdown.weighted.floor = (breakdown.floor * this.weights.floorWeight) / 100;
    breakdown.weighted.walkTime = (breakdown.walkTime * this.weights.walkTimeWeight) / 100;

    // Calculate total score
    const totalScore = 
      breakdown.weighted.commuteTime +
      breakdown.weighted.price +
      breakdown.weighted.size +
      breakdown.weighted.age +
      breakdown.weighted.floor +
      breakdown.weighted.walkTime;

    return {
      ...apartment,
      score: Math.round(totalScore * 10) / 10, // Round to 1 decimal place
      scoreBreakdown: breakdown,
    };
  }

  /**
   * Calculate scores for multiple apartments and sort by score
   */
  scoreApartments(apartments: ApartmentWithFullRelations[]): ApartmentWithFullRelations[] {
    return apartments
      .map(apartment => this.calculateScore(apartment))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Create scorer from user preferences
   */
  static fromUserPreferences(
    preferences: UserPreference | null,
    config?: TargetedScoringConfig
  ): TargetedApartmentScorer {
    if (!preferences) {
      // Return default scorer
      return new TargetedApartmentScorer();
    }

    const weights = preferences.scoreWeights as TargetedScoringWeights || {
      commuteTimeWeight: 25,
      priceWeight: 25,
      sizeWeight: 20,
      ageWeight: 10,
      floorWeight: 10,
      walkTimeWeight: 10,
    };
    
    const targetValues = preferences.targetValues as TargetValues || {};
    
    // Merge config with user's target values
    const enhancedConfig: TargetedScoringConfig = {
      ...config,
      targetValues: {
        ...targetValues,
        ...config?.targetValues,
      },
    };

    return new TargetedApartmentScorer(weights, enhancedConfig);
  }

  /**
   * Get a color class based on score
   */
  static getScoreColorClass(score: number): string {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 75) return "text-lime-600 dark:text-lime-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  }

  /**
   * Get a badge variant based on score
   */
  static getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    if (score >= 40) return "outline";
    return "destructive";
  }
}