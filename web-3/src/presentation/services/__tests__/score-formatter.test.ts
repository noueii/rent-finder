import { ScoreFormatter } from '../score-formatter';
import type { ScoreBreakdown } from '~/lib/scoring/apartment-scorer';

describe('ScoreFormatter', () => {
  describe('formatScore', () => {
    it('formats score with default decimal places', () => {
      expect(ScoreFormatter.formatScore(85.456)).toBe('85.5');
      expect(ScoreFormatter.formatScore(90)).toBe('90.0');
      expect(ScoreFormatter.formatScore(73.234)).toBe('73.2');
    });

    it('formats score with custom decimal places', () => {
      expect(ScoreFormatter.formatScore(85.456, 2)).toBe('85.46');
      expect(ScoreFormatter.formatScore(90, 3)).toBe('90.000');
      expect(ScoreFormatter.formatScore(73.234, 0)).toBe('73');
    });
  });

  describe('getComponentLabel', () => {
    it('returns correct labels for components', () => {
      expect(ScoreFormatter.getComponentLabel('commuteTime')).toBe('Commute Time');
      expect(ScoreFormatter.getComponentLabel('price')).toBe('Price');
      expect(ScoreFormatter.getComponentLabel('size')).toBe('Size');
      expect(ScoreFormatter.getComponentLabel('age')).toBe('Building Age');
    });
  });

  describe('getComponentDescription', () => {
    it('returns correct descriptions with values', () => {
      expect(ScoreFormatter.getComponentDescription('commuteTime', 85.5)).toBe('86% efficiency');
      expect(ScoreFormatter.getComponentDescription('price', 72.3)).toBe('72% value');
      expect(ScoreFormatter.getComponentDescription('size', 68.9)).toBe('69% spacious');
      expect(ScoreFormatter.getComponentDescription('age', 90.1)).toBe('90% modern');
    });
  });

  describe('formatPoints', () => {
    it('formats points with one decimal place', () => {
      expect(ScoreFormatter.formatPoints(25.5)).toBe('25.5 pts');
      expect(ScoreFormatter.formatPoints(30)).toBe('30.0 pts');
      expect(ScoreFormatter.formatPoints(18.234)).toBe('18.2 pts');
    });
  });

  describe('getScoreQualityLabel', () => {
    it('returns correct quality labels for score ranges', () => {
      expect(ScoreFormatter.getScoreQualityLabel(95)).toBe('Excellent');
      expect(ScoreFormatter.getScoreQualityLabel(90)).toBe('Excellent');
      expect(ScoreFormatter.getScoreQualityLabel(85)).toBe('Great');
      expect(ScoreFormatter.getScoreQualityLabel(80)).toBe('Great');
      expect(ScoreFormatter.getScoreQualityLabel(75)).toBe('Good');
      expect(ScoreFormatter.getScoreQualityLabel(70)).toBe('Good');
      expect(ScoreFormatter.getScoreQualityLabel(65)).toBe('Fair');
      expect(ScoreFormatter.getScoreQualityLabel(60)).toBe('Fair');
      expect(ScoreFormatter.getScoreQualityLabel(55)).toBe('Poor');
      expect(ScoreFormatter.getScoreQualityLabel(30)).toBe('Poor');
    });
  });

  describe('toPercentage', () => {
    it('converts score to rounded percentage', () => {
      expect(ScoreFormatter.toPercentage(85.5)).toBe(86);
      expect(ScoreFormatter.toPercentage(72.3)).toBe(72);
      expect(ScoreFormatter.toPercentage(90.8)).toBe(91);
    });
  });

  describe('getScoreRangeLabel', () => {
    it('formats score range', () => {
      expect(ScoreFormatter.getScoreRangeLabel(60, 80)).toBe('60-80');
      expect(ScoreFormatter.getScoreRangeLabel(0, 100)).toBe('0-100');
    });
  });

  describe('formatBreakdown', () => {
    const mockBreakdown: ScoreBreakdown = {
      commuteTime: 85,
      price: 70,
      size: 60,
      age: 90,
      total: 76.25,
      weighted: {
        commuteTime: 25.5,
        price: 21,
        size: 12,
        age: 18,
      },
    };

    it('formats breakdown with all components', () => {
      const formatted = ScoreFormatter.formatBreakdown(mockBreakdown);

      expect(formatted.components).toHaveLength(4);
      expect(formatted.total).toBe('76.3');

      expect(formatted.components[0]).toEqual({
        label: 'Commute Time',
        points: '25.5 pts',
        percentage: 85,
        description: '85% efficiency',
        visible: true,
      });

      expect(formatted.components[1]).toEqual({
        label: 'Price',
        points: '21.0 pts',
        percentage: 70,
        description: '70% value',
        visible: true,
      });
    });

    it('filters out components with zero weight', () => {
      const breakdownWithZero: ScoreBreakdown = {
        ...mockBreakdown,
        weighted: {
          ...mockBreakdown.weighted,
          age: 0,
        },
      };

      const formatted = ScoreFormatter.formatBreakdown(breakdownWithZero);
      expect(formatted.components).toHaveLength(3);
      expect(formatted.components.find(c => c.label === 'Building Age')).toBeUndefined();
    });
  });

  describe('getScoreColor', () => {
    it('returns green colors for high scores', () => {
      expect(ScoreFormatter.getScoreColor(85)).toEqual({
        background: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
      });
      expect(ScoreFormatter.getScoreColor(80)).toEqual({
        background: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
      });
    });

    it('returns yellow colors for medium scores', () => {
      expect(ScoreFormatter.getScoreColor(70)).toEqual({
        background: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
      });
      expect(ScoreFormatter.getScoreColor(60)).toEqual({
        background: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
      });
    });

    it('returns red colors for low scores', () => {
      expect(ScoreFormatter.getScoreColor(50)).toEqual({
        background: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
      });
      expect(ScoreFormatter.getScoreColor(30)).toEqual({
        background: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
      });
    });
  });

  describe('getComparisonLabel', () => {
    it('shows positive difference', () => {
      expect(ScoreFormatter.getComparisonLabel(85, 70)).toBe('+15.0 better');
      expect(ScoreFormatter.getComparisonLabel(82.5, 80)).toBe('+2.5 better');
    });

    it('shows negative difference', () => {
      expect(ScoreFormatter.getComparisonLabel(70, 85)).toBe('-15.0 worse');
      expect(ScoreFormatter.getComparisonLabel(80, 82.5)).toBe('-2.5 worse');
    });

    it('shows similar for small differences', () => {
      expect(ScoreFormatter.getComparisonLabel(80, 80)).toBe('Similar');
      expect(ScoreFormatter.getComparisonLabel(80.5, 80)).toBe('Similar');
      expect(ScoreFormatter.getComparisonLabel(80, 80.9)).toBe('Similar');
    });
  });

  describe('sortScores', () => {
    const scores = [
      { id: '1', score: 70 },
      { id: '2', score: 85 },
      { id: '3', score: 60 },
      { id: '4', score: 90 },
    ];

    it('sorts in descending order by default', () => {
      const sorted = ScoreFormatter.sortScores(scores);
      expect(sorted).toEqual([
        { id: '4', score: 90 },
        { id: '2', score: 85 },
        { id: '1', score: 70 },
        { id: '3', score: 60 },
      ]);
    });

    it('sorts in ascending order when specified', () => {
      const sorted = ScoreFormatter.sortScores(scores, 'asc');
      expect(sorted).toEqual([
        { id: '3', score: 60 },
        { id: '1', score: 70 },
        { id: '2', score: 85 },
        { id: '4', score: 90 },
      ]);
    });

    it('does not mutate original array', () => {
      const original = [...scores];
      ScoreFormatter.sortScores(scores);
      expect(scores).toEqual(original);
    });
  });
});