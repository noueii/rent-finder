import type { Apartment, Route, UserPreference } from "@prisma/client";

export interface ApartmentWithScore extends Apartment {
  routes?: Route[];
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  commuteTime: number;
  price: number;
  size: number;
  age: number;
  weighted: {
    commuteTime: number;
    price: number;
    size: number;
    age: number;
  };
}

export interface ScoringWeights {
  commuteTimeWeight: number;
  priceWeight: number;
  sizeWeight: number;
  ageWeight: number;
}

export interface ScoringConfig {
  // Define the ranges for normalization
  maxCommuteMinutes?: number;
  maxPrice?: number;
  maxSize?: number;
  maxAge?: number;
  
  // Target station for commute calculation
  targetStationId?: string;
}

export class ApartmentScorer {
  private weights: ScoringWeights;
  private config: ScoringConfig;

  constructor(
    weights: ScoringWeights = {
      commuteTimeWeight: 40,
      priceWeight: 30,
      sizeWeight: 20,
      ageWeight: 10,
    },
    config: ScoringConfig = {}
  ) {
    this.weights = weights;
    this.config = {
      maxCommuteMinutes: config.maxCommuteMinutes || 60,
      maxPrice: config.maxPrice || 200000,
      maxSize: config.maxSize || 100,
      maxAge: config.maxAge || 50,
      targetStationId: config.targetStationId,
    };
  }

  /**
   * Calculate score for a single apartment
   */
  calculateScore(apartment: ApartmentWithScore): ApartmentWithScore {
    const breakdown: ScoreBreakdown = {
      commuteTime: 0,
      price: 0,
      size: 0,
      age: 0,
      weighted: {
        commuteTime: 0,
        price: 0,
        size: 0,
        age: 0,
      },
    };

    // Calculate individual scores (0-100 scale)
    
    // 1. Commute Time Score (lower is better)
    if (this.weights.commuteTimeWeight > 0 && apartment.routes && apartment.routes.length > 0) {
      // Find the best route to the target station if specified
      let bestRoute = apartment.routes[0];
      if (this.config.targetStationId) {
        const targetRoute = apartment.routes.find(r => r.toStationId === this.config.targetStationId);
        if (targetRoute) bestRoute = targetRoute;
      }
      
      const commuteMinutes = bestRoute.duration;
      breakdown.commuteTime = Math.max(0, 100 - (commuteMinutes / this.config.maxCommuteMinutes!) * 100);
    } else if (this.weights.commuteTimeWeight > 0) {
      // No route data available, give minimum score
      breakdown.commuteTime = 0;
    }

    // 2. Price Score (lower is better)
    if (this.weights.priceWeight > 0 && apartment.price) {
      breakdown.price = Math.max(0, 100 - (apartment.price / this.config.maxPrice!) * 100);
    }

    // 3. Size Score (larger is better)
    if (this.weights.sizeWeight > 0 && apartment.size) {
      breakdown.size = Math.min(100, (apartment.size / this.config.maxSize!) * 100);
    }

    // 4. Building Age Score (newer is better)
    if (this.weights.ageWeight > 0 && apartment.buildingAge !== null && apartment.buildingAge !== undefined) {
      breakdown.age = Math.max(0, 100 - (apartment.buildingAge / this.config.maxAge!) * 100);
    }

    // Calculate weighted scores
    breakdown.weighted.commuteTime = (breakdown.commuteTime * this.weights.commuteTimeWeight) / 100;
    breakdown.weighted.price = (breakdown.price * this.weights.priceWeight) / 100;
    breakdown.weighted.size = (breakdown.size * this.weights.sizeWeight) / 100;
    breakdown.weighted.age = (breakdown.age * this.weights.ageWeight) / 100;

    // Calculate total score
    const totalScore = 
      breakdown.weighted.commuteTime +
      breakdown.weighted.price +
      breakdown.weighted.size +
      breakdown.weighted.age;

    return {
      ...apartment,
      score: Math.round(totalScore * 10) / 10, // Round to 1 decimal place
      scoreBreakdown: breakdown,
    };
  }

  /**
   * Calculate scores for multiple apartments and sort by score
   */
  scoreApartments(apartments: ApartmentWithScore[]): ApartmentWithScore[] {
    return apartments
      .map(apartment => this.calculateScore(apartment))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Get score explanation for display
   */
  getScoreExplanation(breakdown: ScoreBreakdown): string[] {
    const explanations: string[] = [];

    if (this.weights.commuteTimeWeight > 0) {
      explanations.push(
        `Commute: ${Math.round(breakdown.commuteTime)}% (${Math.round(breakdown.weighted.commuteTime)} points)`
      );
    }

    if (this.weights.priceWeight > 0) {
      explanations.push(
        `Price: ${Math.round(breakdown.price)}% (${Math.round(breakdown.weighted.price)} points)`
      );
    }

    if (this.weights.sizeWeight > 0) {
      explanations.push(
        `Size: ${Math.round(breakdown.size)}% (${Math.round(breakdown.weighted.size)} points)`
      );
    }

    if (this.weights.ageWeight > 0) {
      explanations.push(
        `Building Age: ${Math.round(breakdown.age)}% (${Math.round(breakdown.weighted.age)} points)`
      );
    }

    return explanations;
  }

  /**
   * Create scorer from user preferences
   */
  static fromUserPreferences(
    preferences: UserPreference | null,
    config?: ScoringConfig
  ): ApartmentScorer {
    if (!preferences || !preferences.scoreWeights) {
      // Return default scorer
      return new ApartmentScorer();
    }

    const weights = preferences.scoreWeights as ScoringWeights;
    
    // Use user's max commute preference if available
    const enhancedConfig: ScoringConfig = {
      ...config,
      maxCommuteMinutes: preferences.maxCommute || config?.maxCommuteMinutes || 60,
    };

    return new ApartmentScorer(weights, enhancedConfig);
  }

  /**
   * Get a color class based on score
   */
  static getScoreColorClass(score: number): string {
    if (score >= 80) return "text-green-600 dark:text-green-400";
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