// Property-based tests for analytics utilities

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  aggregateDiseaseFrequency,
  aggregateTemporalData,
  calculateConfidenceStats,
} from './analytics';
import { DetectionResult, Prediction } from './types';

// Arbitraries for generating test data
const predictionArbitrary = fc.record({
  class_name: fc.oneof(
    fc.constant('Leaf Blight'),
    fc.constant('Rust'),
    fc.constant('Powdery Mildew'),
    fc.constant('Bacterial Spot'),
    fc.constant('Anthracnose')
  ),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  bbox: fc.tuple(
    fc.float({ min: 0, max: 1000, noNaN: true }),
    fc.float({ min: 0, max: 1000, noNaN: true }),
    fc.float({ min: 0, max: 1000, noNaN: true }),
    fc.float({ min: 0, max: 1000, noNaN: true })
  ).map(([x1, y1, x2, y2]) => {
    // Ensure x1 < x2 and y1 < y2
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return [minX, minY, maxX, maxY] as [number, number, number, number];
  }),
}) as fc.Arbitrary<Prediction>;

const detectionResultArbitrary = fc.record({
  id: fc.string({ minLength: 1 }),
  imageUrl: fc.constant('data:image/png;base64,mock'),
  imageName: fc.string({ minLength: 1 }),
  timestamp: fc.integer({ min: 0, max: Date.now() }),
  location: fc.option(
    fc.record({
      lat: fc.float({ min: -90, max: 90, noNaN: true }),
      lng: fc.float({ min: -180, max: 180, noNaN: true }),
    }),
    { nil: undefined }
  ),
  predictions: fc.array(predictionArbitrary, { minLength: 1, maxLength: 10 }),
  count: fc.nat({ max: 10 }),
}) as fc.Arbitrary<DetectionResult>;

// **Validates: Requirements 7.1, 7.2, 7.3, 7.8**
describe('Property 10: Disease Frequency Aggregation Accuracy', () => {
  it('should accurately count disease occurrences across all detections', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        (detections) => {
          const aggregated = aggregateDiseaseFrequency(detections);

          // Manually count occurrences
          const manualCount = new Map<string, number>();
          detections.forEach((detection) => {
            detection.predictions.forEach((pred) => {
              manualCount.set(
                pred.class_name,
                (manualCount.get(pred.class_name) || 0) + 1
              );
            });
          });

          // Verify all diseases are accounted for
          const aggregatedMap = new Map(
            aggregated.map((item) => [item.diseaseName, item.count])
          );

          // Check that counts match
          for (const [disease, count] of manualCount.entries()) {
            if (aggregatedMap.get(disease) !== count) {
              return false;
            }
          }

          // Check that no extra diseases are in aggregated
          if (aggregated.length !== manualCount.size) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sort results by count in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { minLength: 2, maxLength: 20 }),
        (detections) => {
          const aggregated = aggregateDiseaseFrequency(detections);

          // Check that each count is >= the next
          for (let i = 0; i < aggregated.length - 1; i++) {
            if (aggregated[i].count < aggregated[i + 1].count) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty detections array', () => {
    fc.assert(
      fc.property(fc.constant([] as DetectionResult[]), (detections) => {
        const result = aggregateDiseaseFrequency(detections);
        return result.length === 0;
      }),
      { numRuns: 10 }
    );
  });

  it('should respect date range filters', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        fc.integer({ min: 0, max: Date.now() }),
        fc.integer({ min: 0, max: Date.now() }),
        (detections, start, end) => {
          const startDate = new Date(Math.min(start, end));
          const endDate = new Date(Math.max(start, end));

          const result = aggregateDiseaseFrequency(detections, {
            start: startDate,
            end: endDate,
          });

          // Manually filter and count
          const filtered = detections.filter(
            (d) => d.timestamp >= startDate.getTime() && d.timestamp <= endDate.getTime()
          );

          const manualCount = new Map<string, number>();
          filtered.forEach((detection) => {
            detection.predictions.forEach((pred) => {
              manualCount.set(
                pred.class_name,
                (manualCount.get(pred.class_name) || 0) + 1
              );
            });
          });

          // Verify counts match
          const resultMap = new Map(result.map((r) => [r.diseaseName, r.count]));

          for (const [disease, count] of manualCount.entries()) {
            if (resultMap.get(disease) !== count) {
              return false;
            }
          }

          return result.length === manualCount.size;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// **Validates: Requirements 7.1, 7.2, 7.3, 7.8**
describe('Property: Temporal Data Aggregation Correctness', () => {
  it('should group all detections into periods without loss', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        fc.oneof(fc.constant('week' as const), fc.constant('month' as const)),
        (detections, periodType) => {
          const result = aggregateTemporalData(detections, periodType);

          // Count total predictions across all periods
          const totalInResult = result.reduce((sum, period) => sum + period.totalCount, 0);

          // Count total predictions in original data
          const totalInOriginal = detections.reduce(
            (sum, detection) => sum + detection.predictions.length,
            0
          );

          return totalInResult === totalInOriginal;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sort periods in ascending chronological order', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { minLength: 2, maxLength: 20 }),
        fc.oneof(fc.constant('week' as const), fc.constant('month' as const)),
        (detections, periodType) => {
          const result = aggregateTemporalData(detections, periodType);

          // Check that each period is <= the next
          for (let i = 0; i < result.length - 1; i++) {
            if (result[i].period > result[i + 1].period) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain disease count consistency within periods', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        fc.oneof(fc.constant('week' as const), fc.constant('month' as const)),
        (detections, periodType) => {
          const result = aggregateTemporalData(detections, periodType);

          // For each period, verify totalCount equals sum of disease counts
          for (const period of result) {
            const sumOfCounts = Array.from(period.counts.values()).reduce(
              (sum, count) => sum + count,
              0
            );

            if (sumOfCounts !== period.totalCount) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// **Validates: Requirements 7.1, 7.2, 7.6, 7.8**
describe('Property: Confidence Statistics Accuracy', () => {
  it('should calculate correct min, max, and average for each disease', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        (detections) => {
          const stats = calculateConfidenceStats(detections);

          // Manually calculate stats for each disease
          const manualStats = new Map<
            string,
            { min: number; max: number; sum: number; count: number }
          >();

          detections.forEach((detection) => {
            detection.predictions.forEach((pred) => {
              const current = manualStats.get(pred.class_name) || {
                min: Infinity,
                max: -Infinity,
                sum: 0,
                count: 0,
              };

              current.min = Math.min(current.min, pred.confidence);
              current.max = Math.max(current.max, pred.confidence);
              current.sum += pred.confidence;
              current.count += 1;

              manualStats.set(pred.class_name, current);
            });
          });

          // Verify stats match
          for (const stat of stats) {
            const manual = manualStats.get(stat.diseaseName);
            if (!manual) return false;

            const manualAvg = manual.sum / manual.count;

            if (
              Math.abs(stat.min - manual.min) > 0.0001 ||
              Math.abs(stat.max - manual.max) > 0.0001 ||
              Math.abs(stat.avg - manualAvg) > 0.0001 ||
              stat.count !== manual.count
            ) {
              return false;
            }
          }

          return stats.length === manualStats.size;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure min <= avg <= max for all diseases', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { minLength: 1, maxLength: 20 }),
        (detections) => {
          const stats = calculateConfidenceStats(detections);

          // Verify invariant: min <= avg <= max
          for (const stat of stats) {
            if (stat.min > stat.avg || stat.avg > stat.max) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have count equal to number of predictions for each disease', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        (detections) => {
          const stats = calculateConfidenceStats(detections);

          // Manually count predictions per disease
          const manualCounts = new Map<string, number>();
          detections.forEach((detection) => {
            detection.predictions.forEach((pred) => {
              manualCounts.set(
                pred.class_name,
                (manualCounts.get(pred.class_name) || 0) + 1
              );
            });
          });

          // Verify counts match
          for (const stat of stats) {
            if (stat.count !== manualCounts.get(stat.diseaseName)) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// **Validates: Requirements 7.8**
describe('Property: Filter Consistency', () => {
  it('should apply date range filter consistently across all aggregation functions', () => {
    fc.assert(
      fc.property(
        fc.array(detectionResultArbitrary, { maxLength: 20 }),
        fc.integer({ min: 0, max: Date.now() }),
        fc.integer({ min: 0, max: Date.now() }),
        (detections, start, end) => {
          const startDate = new Date(Math.min(start, end));
          const endDate = new Date(Math.max(start, end));
          const dateRange = { start: startDate, end: endDate };

          // Get results from all functions
          const frequency = aggregateDiseaseFrequency(detections, dateRange);
          const temporal = aggregateTemporalData(detections, 'month', dateRange);
          const confidence = calculateConfidenceStats(detections, dateRange);

          // Manually filter detections
          const filtered = detections.filter(
            (d) => d.timestamp >= startDate.getTime() && d.timestamp <= endDate.getTime()
          );

          // Count total predictions in filtered data
          const totalPredictions = filtered.reduce(
            (sum, d) => sum + d.predictions.length,
            0
          );

          // Verify frequency total matches
          const frequencyTotal = frequency.reduce((sum, f) => sum + f.count, 0);
          if (frequencyTotal !== totalPredictions) {
            return false;
          }

          // Verify temporal total matches
          const temporalTotal = temporal.reduce((sum, t) => sum + t.totalCount, 0);
          if (temporalTotal !== totalPredictions) {
            return false;
          }

          // Verify confidence count matches
          const confidenceTotal = confidence.reduce((sum, c) => sum + c.count, 0);
          if (confidenceTotal !== totalPredictions) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
