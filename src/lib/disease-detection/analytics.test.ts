// Unit tests for analytics utilities

import { describe, it, expect } from 'vitest';
import {
  aggregateDiseaseFrequency,
  aggregateTemporalData,
  calculateConfidenceStats,
  DiseaseFrequency,
  TemporalDataPoint,
  ConfidenceStats,
} from './analytics';
import { DetectionResult } from './types';

// Helper function to create mock detection results
function createMockDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    id: `detection-${Date.now()}-${Math.random()}`,
    imageUrl: 'data:image/png;base64,mock',
    imageName: 'test-image.jpg',
    timestamp: Date.now(),
    predictions: [
      {
        class_name: 'Leaf Blight',
        confidence: 0.85,
        bbox: [10, 10, 100, 100],
      },
    ],
    count: 1,
    ...overrides,
  };
}

describe('aggregateDiseaseFrequency', () => {
  it('should count disease occurrences correctly', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
        ],
        count: 2,
      }),
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] },
        ],
        count: 1,
      }),
      createMockDetection({
        predictions: [
          { class_name: 'Powdery Mildew', confidence: 0.80, bbox: [25, 25, 125, 125] },
        ],
        count: 1,
      }),
    ];

    const result = aggregateDiseaseFrequency(detections);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ diseaseName: 'Leaf Blight', count: 2 });
    expect(result[1].count).toBe(1);
    expect(result[2].count).toBe(1);
  });

  it('should sort by count descending', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        predictions: [
          { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
        ],
        count: 1,
      }),
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
        ],
        count: 1,
      }),
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] },
        ],
        count: 1,
      }),
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.88, bbox: [12, 12, 102, 102] },
        ],
        count: 1,
      }),
    ];

    const result = aggregateDiseaseFrequency(detections);

    expect(result[0].diseaseName).toBe('Leaf Blight');
    expect(result[0].count).toBe(3);
    expect(result[1].diseaseName).toBe('Rust');
    expect(result[1].count).toBe(1);
  });

  it('should return empty array for no detections', () => {
    const result = aggregateDiseaseFrequency([]);
    expect(result).toEqual([]);
  });

  it('should filter by date range', () => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    const detections: DetectionResult[] = [
      createMockDetection({
        timestamp: now,
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }],
      }),
      createMockDetection({
        timestamp: twoDaysAgo,
        predictions: [{ class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] }],
      }),
    ];

    const result = aggregateDiseaseFrequency(detections, {
      start: new Date(oneDayAgo),
      end: new Date(now + 1000),
    });

    expect(result).toHaveLength(1);
    expect(result[0].diseaseName).toBe('Leaf Blight');
  });

  it('should filter by field location', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        location: { lat: 28.6139, lng: 77.2090 }, // Delhi
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }],
      }),
      createMockDetection({
        location: { lat: 19.0760, lng: 72.8777 }, // Mumbai (far away)
        predictions: [{ class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] }],
      }),
      createMockDetection({
        location: { lat: 28.6200, lng: 77.2100 }, // Near Delhi
        predictions: [{ class_name: 'Powdery Mildew', confidence: 0.80, bbox: [25, 25, 125, 125] }],
      }),
    ];

    const result = aggregateDiseaseFrequency(detections, undefined, {
      lat: 28.6139,
      lng: 77.2090,
      radiusKm: 5,
    });

    expect(result).toHaveLength(2);
    expect(result.some(r => r.diseaseName === 'Rust')).toBe(false);
  });
});

describe('aggregateTemporalData', () => {
  it('should group detections by week', () => {
    const baseDate = new Date('2024-01-15T12:00:00Z'); // Monday
    const detections: DetectionResult[] = [
      createMockDetection({
        timestamp: baseDate.getTime(),
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }],
      }),
      createMockDetection({
        timestamp: baseDate.getTime() + 2 * 24 * 60 * 60 * 1000, // Wednesday same week
        predictions: [{ class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] }],
      }),
      createMockDetection({
        timestamp: baseDate.getTime() + 7 * 24 * 60 * 60 * 1000, // Next week
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] }],
      }),
    ];

    const result = aggregateTemporalData(detections, 'week');

    expect(result).toHaveLength(2);
    expect(result[0].totalCount).toBe(2);
    expect(result[1].totalCount).toBe(1);
  });

  it('should group detections by month', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        timestamp: new Date('2024-01-15').getTime(),
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }],
      }),
      createMockDetection({
        timestamp: new Date('2024-01-20').getTime(),
        predictions: [{ class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] }],
      }),
      createMockDetection({
        timestamp: new Date('2024-02-05').getTime(),
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] }],
      }),
    ];

    const result = aggregateTemporalData(detections, 'month');

    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2024-01-01');
    expect(result[0].totalCount).toBe(2);
    expect(result[1].period).toBe('2024-02-01');
    expect(result[1].totalCount).toBe(1);
  });

  it('should count diseases per period', () => {
    const baseDate = new Date('2024-01-15T12:00:00Z');
    const detections: DetectionResult[] = [
      createMockDetection({
        timestamp: baseDate.getTime(),
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
        ],
        count: 2,
      }),
      createMockDetection({
        timestamp: baseDate.getTime() + 24 * 60 * 60 * 1000,
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] }],
        count: 1,
      }),
    ];

    const result = aggregateTemporalData(detections, 'week');

    expect(result).toHaveLength(1);
    expect(result[0].counts.get('Leaf Blight')).toBe(2);
    expect(result[0].counts.get('Rust')).toBe(1);
    expect(result[0].totalCount).toBe(3);
  });

  it('should sort periods in ascending order', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        timestamp: new Date('2024-03-01').getTime(),
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }],
      }),
      createMockDetection({
        timestamp: new Date('2024-01-01').getTime(),
        predictions: [{ class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] }],
      }),
      createMockDetection({
        timestamp: new Date('2024-02-01').getTime(),
        predictions: [{ class_name: 'Powdery Mildew', confidence: 0.80, bbox: [25, 25, 125, 125] }],
      }),
    ];

    const result = aggregateTemporalData(detections, 'month');

    expect(result).toHaveLength(3);
    expect(result[0].period).toBe('2024-01-01');
    expect(result[1].period).toBe('2024-02-01');
    expect(result[2].period).toBe('2024-03-01');
  });
});

describe('calculateConfidenceStats', () => {
  it('should calculate min, max, and average confidence', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          { class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] },
          { class_name: 'Leaf Blight', confidence: 0.75, bbox: [20, 20, 110, 110] },
        ],
        count: 3,
      }),
    ];

    const result = calculateConfidenceStats(detections);

    expect(result).toHaveLength(1);
    expect(result[0].diseaseName).toBe('Leaf Blight');
    expect(result[0].min).toBe(0.75);
    expect(result[0].max).toBe(0.90);
    expect(result[0].avg).toBeCloseTo(0.8333, 4);
    expect(result[0].count).toBe(3);
  });

  it('should calculate stats for multiple diseases', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          { class_name: 'Rust', confidence: 0.70, bbox: [20, 20, 120, 120] },
        ],
        count: 2,
      }),
      createMockDetection({
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.90, bbox: [15, 15, 105, 105] },
          { class_name: 'Rust', confidence: 0.80, bbox: [25, 25, 125, 125] },
        ],
        count: 2,
      }),
    ];

    const result = calculateConfidenceStats(detections);

    expect(result).toHaveLength(2);
    
    const leafBlightStats = result.find(s => s.diseaseName === 'Leaf Blight');
    expect(leafBlightStats?.min).toBe(0.85);
    expect(leafBlightStats?.max).toBe(0.90);
    expect(leafBlightStats?.avg).toBeCloseTo(0.875, 3);
    
    const rustStats = result.find(s => s.diseaseName === 'Rust');
    expect(rustStats?.min).toBe(0.70);
    expect(rustStats?.max).toBe(0.80);
    expect(rustStats?.avg).toBeCloseTo(0.75, 2);
  });

  it('should handle single prediction correctly', () => {
    const detections: DetectionResult[] = [
      createMockDetection({
        predictions: [{ class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }],
        count: 1,
      }),
    ];

    const result = calculateConfidenceStats(detections);

    expect(result).toHaveLength(1);
    expect(result[0].min).toBe(0.85);
    expect(result[0].max).toBe(0.85);
    expect(result[0].avg).toBe(0.85);
    expect(result[0].count).toBe(1);
  });

  it('should return empty array for no detections', () => {
    const result = calculateConfidenceStats([]);
    expect(result).toEqual([]);
  });
});
