import type { ScoreBreakdown } from "~/lib/scoring/apartment-scorer";

/**
 * Service for formatting and displaying apartment scores consistently
 */
export class ScoreFormatter {
  /**
   * Format score to consistent decimal places
   */
  static formatScore(score: number, decimals: number = 1): string {
    return score.toFixed(decimals);
  }

  /**
   * Get display label for score component
   */
  static getComponentLabel(component: keyof ScoreBreakdown["weighted"]): string {
    const labels: Record<keyof ScoreBreakdown["weighted"], string> = {
      commuteTime: "Commute Time",
      price: "Price",
      size: "Size",
      age: "Building Age",
    };
    return labels[component];
  }

  /**
   * Get component description
   */
  static getComponentDescription(
    component: keyof ScoreBreakdown["weighted"],
    value: number
  ): string {
    const descriptions: Record<keyof ScoreBreakdown["weighted"], string> = {
      commuteTime: `${Math.round(value)}% efficiency`,
      price: `${Math.round(value)}% value`,
      size: `${Math.round(value)}% spacious`,
      age: `${Math.round(value)}% modern`,
    };
    return descriptions[component];
  }

  /**
   * Format weighted score points
   */
  static formatPoints(points: number): string {
    return `${points.toFixed(1)} pts`;
  }

  /**
   * Get score quality label
   */
  static getScoreQualityLabel(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Great";
    if (score >= 70) return "Good";
    if (score >= 60) return "Fair";
    return "Poor";
  }

  /**
   * Convert score to percentage
   */
  static toPercentage(score: number): number {
    return Math.round(score);
  }

  /**
   * Get score range label
   */
  static getScoreRangeLabel(min: number, max: number): string {
    return `${min}-${max}`;
  }

  /**
   * Format score breakdown for display
   */
  static formatBreakdown(breakdown: ScoreBreakdown): {
    components: Array<{
      label: string;
      points: string;
      percentage: number;
      description: string;
      visible: boolean;
    }>;
    total: string;
  } {
    const componentKeys: Array<keyof ScoreBreakdown["weighted"]> = [
      "commuteTime",
      "price",
      "size",
      "age",
    ];

    const components = componentKeys.map((key) => ({
      label: this.getComponentLabel(key),
      points: this.formatPoints(breakdown.weighted[key]),
      percentage: breakdown[key],
      description: this.getComponentDescription(key, breakdown[key]),
      visible: breakdown.weighted[key] > 0,
    }));

    return {
      components: components.filter((c) => c.visible),
      total: this.formatScore(breakdown.total),
    };
  }

  /**
   * Get score color for CSS styling
   */
  static getScoreColor(score: number): {
    background: string;
    text: string;
    border: string;
  } {
    if (score >= 80) {
      return {
        background: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
      };
    }
    if (score >= 60) {
      return {
        background: "bg-yellow-50",
        text: "text-yellow-700",
        border: "border-yellow-200",
      };
    }
    return {
      background: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    };
  }

  /**
   * Get score comparison label
   */
  static getComparisonLabel(score1: number, score2: number): string {
    const diff = score1 - score2;
    if (Math.abs(diff) < 1) return "Similar";
    if (diff > 0) return `+${diff.toFixed(1)} better`;
    return `${diff.toFixed(1)} worse`;
  }

  /**
   * Sort scores for display
   */
  static sortScores(
    scores: Array<{ id: string; score: number }>,
    order: "asc" | "desc" = "desc"
  ): Array<{ id: string; score: number }> {
    return [...scores].sort((a, b) => {
      const diff = a.score - b.score;
      return order === "desc" ? -diff : diff;
    });
  }
}