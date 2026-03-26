# Disease Detection Library

This library provides the core infrastructure for AI-powered image-based disease detection in the Kisan Mitra application.

## Overview

The disease detection system integrates with HuggingFace's YOLOv8 model to analyze crop images and identify diseases. It includes:

- TypeScript interfaces for type safety
- Zod schemas for runtime validation
- API service with retry logic and exponential backoff
- Data URL conversion for image storage

## Directory Structure

```
src/lib/disease-detection/
├── api.ts          # API service for HuggingFace endpoint
├── types.ts        # TypeScript interfaces
├── schemas.ts      # Zod validation schemas
├── index.ts        # Main export file
└── README.md       # This file
```

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Local disease detection model endpoint (running on localhost:7860)
VITE_DISEASE_DETECTION_ENDPOINT=http://localhost:7860

# Alternative: HuggingFace API endpoint for disease detection (YOLOv8 model)
# VITE_HUGGINGFACE_DISEASE_DETECTION_ENDPOINT=https://api-inference.huggingface.co/models/your-model-name

# Optional: HuggingFace API key for authentication
# VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

### Endpoint Priority

The system will use endpoints in the following priority:
1. `VITE_DISEASE_DETECTION_ENDPOINT` (local model, recommended for development)
2. `VITE_HUGGINGFACE_DISEASE_DETECTION_ENDPOINT` (cloud API, fallback)

### Running Local Model

To run the disease detection model locally on port 7860:

1. Ensure your model server is running on `http://localhost:7860`
2. The endpoint should accept POST requests with FormData containing an `image` field
3. The response should match the expected format (see API Response Format section below)

### Security

- HTTPS is required for production endpoints
- Localhost (HTTP) is allowed for development
- API keys are optional but recommended for HuggingFace endpoints

## Usage

### Basic Detection

```typescript
import { detectDiseases } from '@/lib/disease-detection';

// Detect diseases in an image
const result = await detectDiseases(imageFile, {
  lat: 28.6139,
  lng: 77.2090
});

console.log(`Found ${result.count} diseases`);
result.predictions.forEach(pred => {
  console.log(`${pred.class_name}: ${(pred.confidence * 100).toFixed(1)}%`);
});
```

### Type Definitions

```typescript
interface DetectionResult {
  id: string;                    // Unique identifier
  imageUrl: string;              // Data URL of the image
  imageName: string;             // Original filename
  timestamp: number;             // Unix timestamp in milliseconds
  location?: {                   // Optional geolocation
    lat: number;
    lng: number;
  };
  predictions: Prediction[];     // Array of detected diseases
  count: number;                 // Total number of diseases
}

interface Prediction {
  class_name: string;            // Disease name
  confidence: number;            // Confidence score (0-1)
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
}
```

### Schema Validation

All API responses are validated using Zod schemas:

```typescript
import { detectionResponseSchema } from '@/lib/disease-detection';

// Validate API response
const validated = detectionResponseSchema.parse(apiResponse);
```

## Features

### Retry Logic

The API service implements automatic retry with exponential backoff:
- Maximum 3 retry attempts
- Initial delay: 1 second
- Exponential backoff: 1s, 2s, 4s

### Error Handling

```typescript
try {
  const result = await detectDiseases(imageFile);
} catch (error) {
  if (error.message.includes('endpoint not configured')) {
    // Handle missing configuration
  } else if (error.message.includes('failed after 3 attempts')) {
    // Handle network/API errors
  }
}
```

### Validation

Bounding box coordinates are validated to ensure:
- All coordinates are non-negative
- x1 < x2 and y1 < y2
- Confidence scores are between 0 and 1

## API Response Format

Expected response from the disease detection endpoint:

```json
{
  "filename": "crop_image.jpg",
  "count": 2,
  "predictions": [
    {
      "bbox": [10.5, 20.3, 100.8, 150.2],
      "confidence": 0.85,
      "class_id": 0,
      "class_name": "Leaf Blight"
    },
    {
      "bbox": [200.1, 150.5, 300.7, 250.9],
      "confidence": 0.72,
      "class_id": 0,
      "class_name": "Leaf Spot"
    }
  ]
}
```

### API Request Format

The endpoint expects a POST request with FormData:

```javascript
const formData = new FormData();
formData.append('file', imageFile); // Field name must be 'file'
```

### Response Fields

- `filename` (optional): Original filename
- `count`: Total number of detections
- `predictions`: Array of detection objects
  - `bbox`: Bounding box coordinates [x_min, y_min, x_max, y_max]
  - `confidence`: Confidence score (0-1)
  - `class_id` (optional): Numeric class identifier
  - `class_name`: Disease name/label

## Next Steps

This infrastructure will be used by:
1. Image upload components (Task 2)
2. Detection results display (Task 5)
3. Detection history storage (Task 6)
4. Analytics dashboard (Task 10)

## Requirements Validated

This implementation validates the following requirements:
- **2.1**: Send image to HuggingFace API as FormData
- **2.7**: Validate API response schema before processing
- **2.8**: Create DetectionResult object with all required fields
