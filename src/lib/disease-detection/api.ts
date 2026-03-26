// API service for disease detection endpoint
// Proxied through Lambda server — NO API keys on client

import { DetectionResult } from './types';
import { detectionResponseSchema, type DetectionResponseSchema } from './schemas';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const buildDetectionResult = (
  imageUrl: string,
  imageName: string,
  predictions: Array<{
    class_name: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>,
  location?: { lat: number; lng: number }
): DetectionResult => {
  const id = `detection_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const timestamp = Date.now();
  const count = predictions.length;

  return { id, imageUrl, imageName, timestamp, location, predictions, count };
};

/**
 * Call disease detection API through server proxy
 */
const callDetectionAPI = async (
  file: File,
  location?: { lat: number; lng: number }
): Promise<DetectionResponseSchema> => {
  const formData = new FormData();
  formData.append('file', file);

  if (location) {
    formData.append('lat', location.lat.toString());
    formData.append('lng', location.lng.toString());
  }

  const response = await fetch(`${API_URL}/api/disease-detect`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const validated = detectionResponseSchema.parse(data);
  return validated;
};

/**
 * Detect diseases in an image with retry logic
 */
export const detectDiseases = async (
  image: File,
  location?: { lat: number; lng: number }
): Promise<DetectionResult> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callDetectionAPI(image, location);
      const imageUrl = await fileToDataURL(image);

      const predictions = response.predictions.map(pred => ({
        class_name: pred.class_name,
        confidence: pred.confidence,
        bbox: pred.bbox as [number, number, number, number],
      }));

      return buildDetectionResult(imageUrl, image.name, predictions, location);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Detection attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Disease detection failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`
  );
};

export const isEndpointConfigured = (): boolean => {
  // Always true when using server proxy — server has the endpoint configured
  return true;
};

export const getEndpointURL = (): string => {
  return `${API_URL}/api/disease-detect`;
};
