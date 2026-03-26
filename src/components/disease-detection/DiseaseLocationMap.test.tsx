import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiseaseLocationMap } from './DiseaseLocationMap';
import { DetectionResult } from '@/lib/disease-detection/types';

describe('DiseaseLocationMap', () => {
  it('should display encouragement message when no detections have location data', () => {
    const detectionsWithoutLocation: DetectionResult[] = [
      {
        id: '1',
        imageUrl: 'data:image/png;base64,test',
        imageName: 'test.jpg',
        timestamp: Date.now(),
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }
        ],
        count: 1,
      },
    ];

    render(<DiseaseLocationMap detections={detectionsWithoutLocation} />);
    
    expect(screen.getByText('Disease Location Map')).toBeInTheDocument();
    expect(screen.getByText('Enable Location for Geographic Insights')).toBeInTheDocument();
  });

  it('should display map when detections have location data', () => {
    const detectionsWithLocation: DetectionResult[] = [
      {
        id: '1',
        imageUrl: 'data:image/png;base64,test',
        imageName: 'test.jpg',
        timestamp: Date.now(),
        location: { lat: 28.6139, lng: 77.2090 }, // Delhi
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }
        ],
        count: 1,
      },
    ];

    render(<DiseaseLocationMap detections={detectionsWithLocation} />);
    
    expect(screen.getByText('Disease Location Map')).toBeInTheDocument();
    expect(screen.getByText(/1 location/)).toBeInTheDocument();
  });

  it('should filter out detections without location data', () => {
    const mixedDetections: DetectionResult[] = [
      {
        id: '1',
        imageUrl: 'data:image/png;base64,test',
        imageName: 'test1.jpg',
        timestamp: Date.now(),
        location: { lat: 28.6139, lng: 77.2090 },
        predictions: [
          { class_name: 'Leaf Blight', confidence: 0.85, bbox: [10, 10, 100, 100] }
        ],
        count: 1,
      },
      {
        id: '2',
        imageUrl: 'data:image/png;base64,test',
        imageName: 'test2.jpg',
        timestamp: Date.now(),
        predictions: [
          { class_name: 'Rust', confidence: 0.75, bbox: [20, 20, 120, 120] }
        ],
        count: 1,
      },
    ];

    render(<DiseaseLocationMap detections={mixedDetections} />);
    
    // Should show only 1 location (the one with location data)
    expect(screen.getByText(/1 location/)).toBeInTheDocument();
  });
});
