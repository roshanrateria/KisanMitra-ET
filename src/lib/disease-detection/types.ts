// TypeScript interfaces and types for disease detection

export interface Prediction {
  class_name: string;
  confidence: number; // 0-1 range
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface DetectionResult {
  id: string; // Unique identifier (timestamp-based)
  imageUrl: string; // Data URL or blob URL
  imageName: string; // Original filename
  timestamp: number; // Unix timestamp in milliseconds
  location?: {
    lat: number;
    lng: number;
  };
  predictions: Prediction[];
  count: number; // Total number of diseases detected
}

export interface DetectionRequest {
  image: File;
  lat?: number;
  lng?: number;
}

export interface DetectionResponse {
  predictions: Array<{
    class_name: string;
    confidence: number;
    bbox: number[]; // [x1, y1, x2, y2]
  }>;
  count: number;
}

export interface DetectionHistoryStorage {
  version: string; // Schema version for migrations
  detections: DetectionResult[];
  maxSize: number; // Maximum number of stored detections
}
