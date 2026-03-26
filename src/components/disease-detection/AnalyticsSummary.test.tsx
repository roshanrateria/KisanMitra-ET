import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsSummary } from './AnalyticsSummary';
import { DetectionResult } from '@/lib/disease-detection/types';

/**
 * Helper function to create mock detection results
 */
function createMockDetection(overrides?: Partial<DetectionResult>): DetectionResult {
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

describe('AnalyticsSummary', () => {
  describe('Insufficient Data Handling', () => {
    it('should display encouragement message when no detections exist', () => {
      render(<AnalyticsSummary detections={[]} />);
      
      expect(screen.getByText(/Start Building Your Analytics/i)).toBeInTheDocument();
      expect(screen.getByText(/You currently have 0 detections/i)).toBeInTheDocument();
    });

    it('should display encouragement message when only 1 detection exists', () => {
      const detections = [createMockDetection()];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.getByText(/Start Building Your Analytics/i)).toBeInTheDocument();
      expect(screen.getByText(/You currently have 1 detection\./i)).toBeInTheDocument();
    });

    it('should display encouragement message when only 2 detections exist', () => {
      const detections = [
        createMockDetection({ id: 'det-1' }),
        createMockDetection({ id: 'det-2' }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.getByText(/Start Building Your Analytics/i)).toBeInTheDocument();
      expect(screen.getByText(/You currently have 2 detections/i)).toBeInTheDocument();
    });

    it('should display analytics when exactly 3 detections exist', () => {
      const detections = [
        createMockDetection({ id: 'det-1' }),
        createMockDetection({ id: 'det-2' }),
        createMockDetection({ id: 'det-3' }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.queryByText(/Start Building Your Analytics/i)).not.toBeInTheDocument();
      expect(screen.getByText('Total Detections')).toBeInTheDocument();
    });
  });

  describe('Summary Statistics Display', () => {
    it('should display correct total detections count', () => {
      const detections = [
        createMockDetection({ id: 'det-1' }),
        createMockDetection({ id: 'det-2' }),
        createMockDetection({ id: 'det-3' }),
        createMockDetection({ id: 'det-4' }),
        createMockDetection({ id: 'det-5' }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.getByText('Total Detections')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Images analyzed')).toBeInTheDocument();
    });

    it('should display correct unique diseases count', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          ],
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
          ],
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.90, bbox: [30, 30, 130, 130] },
          ],
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.getByText('Unique Diseases')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Different disease types')).toBeInTheDocument();
    });

    it('should display most common disease with occurrence count', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          ],
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
          ],
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.90, bbox: [30, 30, 130, 130] },
          ],
        }),
        createMockDetection({
          id: 'det-4',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.80, bbox: [40, 40, 140, 140] },
          ],
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.getByText('Most Common Disease')).toBeInTheDocument();
      expect(screen.getByText('Leaf Blight')).toBeInTheDocument();
      expect(screen.getByText('3 occurrences')).toBeInTheDocument();
    });

    it('should display average confidence score formatted correctly', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
          ],
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
          ],
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Powdery Mildew', confidence: 0.90, bbox: [30, 30, 130, 130] },
          ],
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      expect(screen.getByText('Average Confidence')).toBeInTheDocument();
      // Average: (0.85 + 0.75 + 0.90) / 3 = 0.8333... = 83.3%
      expect(screen.getByText('83.3%')).toBeInTheDocument();
      expect(screen.getByText('Detection accuracy')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle detections with multiple predictions per image', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] },
            { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] },
          ],
          count: 2,
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.90, bbox: [30, 30, 130, 130] },
          ],
          count: 1,
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Powdery Mildew', confidence: 0.80, bbox: [40, 40, 140, 140] },
          ],
          count: 1,
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      // Total detections should be 3 (number of images)
      expect(screen.getByText('3')).toBeInTheDocument();
      
      // Unique diseases should be 3
      expect(screen.getAllByText('3')[0]).toBeInTheDocument();
      
      // Most common should be Leaf Blight (2 occurrences)
      expect(screen.getByText('Leaf Blight')).toBeInTheDocument();
      expect(screen.getByText('2 occurrences')).toBeInTheDocument();
    });

    it('should handle detections with no predictions (empty results)', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [],
          count: 0,
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [],
          count: 0,
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [],
          count: 0,
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      // Should still show analytics (3 detections)
      expect(screen.getByText('Total Detections')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      
      // Unique diseases should be 0
      expect(screen.getByText('0')).toBeInTheDocument();
      
      // Most common disease should show "No data"
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('should format confidence with one decimal place', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { class_name: 'Leaf Blight', confidence: 0.8567, bbox: [10, 10, 100, 100] },
          ],
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { class_name: 'Rust', confidence: 0.7234, bbox: [20, 20, 120, 120] },
          ],
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Powdery Mildew', confidence: 0.9012, bbox: [30, 30, 130, 130] },
          ],
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      // Average: (0.8567 + 0.7234 + 0.9012) / 3 = 0.8271 = 82.7%
      expect(screen.getByText('82.7%')).toBeInTheDocument();
    });

    it('should handle very long disease names with truncation', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { 
              class_name: 'Very Long Disease Name That Should Be Truncated In The Display', 
              confidence: 0.85, 
              bbox: [10, 10, 100, 100] 
            },
          ],
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { 
              class_name: 'Very Long Disease Name That Should Be Truncated In The Display', 
              confidence: 0.90, 
              bbox: [20, 20, 120, 120] 
            },
          ],
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Short Name', confidence: 0.80, bbox: [30, 30, 130, 130] },
          ],
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      // Should display the long disease name (most common)
      expect(screen.getByText('Very Long Disease Name That Should Be Truncated In The Display')).toBeInTheDocument();
      expect(screen.getByText('2 occurrences')).toBeInTheDocument();
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate weighted average confidence correctly with multiple predictions', () => {
      const detections = [
        createMockDetection({
          id: 'det-1',
          predictions: [
            { class_name: 'Disease A', confidence: 0.8, bbox: [10, 10, 100, 100] },
            { class_name: 'Disease B', confidence: 0.6, bbox: [20, 20, 120, 120] },
          ],
          count: 2,
        }),
        createMockDetection({
          id: 'det-2',
          predictions: [
            { class_name: 'Disease A', confidence: 0.9, bbox: [30, 30, 130, 130] },
          ],
          count: 1,
        }),
        createMockDetection({
          id: 'det-3',
          predictions: [
            { class_name: 'Disease C', confidence: 0.7, bbox: [40, 40, 140, 140] },
          ],
          count: 1,
        }),
      ];
      render(<AnalyticsSummary detections={detections} />);
      
      // Average: (0.8 + 0.6 + 0.9 + 0.7) / 4 = 0.75 = 75.0%
      expect(screen.getByText('75.0%')).toBeInTheDocument();
    });
  });
});
