// Zod schemas for runtime validation of disease detection data

import { z } from 'zod';

// Schema for a single prediction from the API
export const predictionSchema = z.object({
  class_name: z.string().min(1, 'Disease name is required'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  bbox: z.tuple([
    z.number().nonnegative('x1 must be non-negative'),
    z.number().nonnegative('y1 must be non-negative'),
    z.number().nonnegative('x2 must be non-negative'),
    z.number().nonnegative('y2 must be non-negative'),
  ]).refine(
    ([x1, y1, x2, y2]) => x1 < x2 && y1 < y2,
    'Bounding box coordinates must satisfy x1 < x2 and y1 < y2'
  ),
  class_id: z.number().int().nonnegative().optional(), // Optional field from FastAPI
});

// Schema for the API response from the disease detection endpoint
export const detectionResponseSchema = z.object({
  filename: z.string().optional(), // Optional field from FastAPI
  predictions: z.array(predictionSchema),
  count: z.number().int().nonnegative(),
});

// Schema for location data
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}).optional();

// Schema for a complete detection result
export const detectionResultSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().min(1),
  imageName: z.string().min(1),
  timestamp: z.number().int().positive(),
  location: locationSchema,
  predictions: z.array(predictionSchema),
  count: z.number().int().nonnegative(),
});

// Schema for detection history storage
export const detectionHistoryStorageSchema = z.object({
  version: z.string(),
  detections: z.array(detectionResultSchema),
  maxSize: z.number().int().positive(),
});

// Type exports inferred from schemas
export type PredictionSchema = z.infer<typeof predictionSchema>;
export type DetectionResponseSchema = z.infer<typeof detectionResponseSchema>;
export type DetectionResultSchema = z.infer<typeof detectionResultSchema>;
export type DetectionHistoryStorageSchema = z.infer<typeof detectionHistoryStorageSchema>;
