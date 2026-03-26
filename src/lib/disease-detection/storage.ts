// localStorage service for detection history management

import { DetectionResult, DetectionHistoryStorage } from './types';
import { detectionHistoryStorageSchema } from './schemas';

const STORAGE_KEY = 'kisanmitra_disease_detections';
const STORAGE_VERSION = '1.0.0';
const MAX_HISTORY_SIZE = 100;

/**
 * Error thrown when localStorage quota is exceeded
 */
export class StorageQuotaError extends Error {
  constructor(message: string = 'Storage quota exceeded') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Get the current detection history storage structure
 * Returns empty structure if no data exists or data is invalid
 * Handles missing data gracefully after deletion or browser data clearing
 */
function getStorage(): DetectionHistoryStorage {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    
    if (!data) {
      return {
        version: STORAGE_VERSION,
        detections: [],
        maxSize: MAX_HISTORY_SIZE,
      };
    }

    const parsed = JSON.parse(data);
    const validated = detectionHistoryStorageSchema.parse(parsed) as DetectionHistoryStorage;
    
    return validated;
  } catch (error) {
    console.error('Failed to load detection history:', error);
    // Return empty structure if data is corrupted or missing
    return {
      version: STORAGE_VERSION,
      detections: [],
      maxSize: MAX_HISTORY_SIZE,
    };
  }
}

/**
 * Save the detection history storage structure to localStorage
 * Handles quota exceeded errors by removing oldest entries
 */
function setStorage(storage: DetectionHistoryStorage): void {
  try {
    const serialized = JSON.stringify(storage);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new StorageQuotaError('Storage quota exceeded');
    }
    throw error;
  }
}

/**
 * Save a detection result to history
 * Automatically enforces maximum history size and handles quota errors
 * 
 * @param detection - The detection result to save
 * @throws StorageQuotaError if storage quota is exceeded after cleanup
 */
export function saveDetection(detection: DetectionResult): void {
  const storage = getStorage();
  
  // Add new detection at the beginning (newest first)
  storage.detections.unshift(detection);
  
  // Enforce maximum history size
  if (storage.detections.length > MAX_HISTORY_SIZE) {
    storage.detections = storage.detections.slice(0, MAX_HISTORY_SIZE);
  }
  
  try {
    setStorage(storage);
  } catch (error) {
    if (error instanceof StorageQuotaError) {
      // Try to free up space by removing half of the oldest entries
      const reducedSize = Math.floor(MAX_HISTORY_SIZE / 2);
      storage.detections = storage.detections.slice(0, reducedSize);
      
      try {
        setStorage(storage);
      } catch (retryError) {
        // If still failing, throw the error
        throw new StorageQuotaError('Unable to save detection: storage quota exceeded even after cleanup');
      }
    } else {
      throw error;
    }
  }
}

/**
 * Get all detection results from history
 * Returns detections sorted by timestamp in descending order (newest first)
 * 
 * @returns Array of detection results
 */
export function getDetectionHistory(): DetectionResult[] {
  const storage = getStorage();
  
  // Ensure detections are sorted by timestamp descending
  return storage.detections.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Delete a specific detection from history by ID
 * 
 * @param id - The unique identifier of the detection to delete
 * @returns true if detection was found and deleted, false otherwise
 */
export function deleteDetection(id: string): boolean {
  const storage = getStorage();
  const initialLength = storage.detections.length;
  
  // Filter out the detection with the matching ID
  storage.detections = storage.detections.filter(d => d.id !== id);
  
  // Check if anything was actually deleted
  const wasDeleted = storage.detections.length < initialLength;
  
  if (wasDeleted) {
    setStorage(storage);
  }
  
  return wasDeleted;
}

/**
 * Clear all detection history from localStorage
 */
export function clearAllDetections(): void {
  const storage: DetectionHistoryStorage = {
    version: STORAGE_VERSION,
    detections: [],
    maxSize: MAX_HISTORY_SIZE,
  };
  
  setStorage(storage);
}

/**
 * Get the current number of stored detections
 * 
 * @returns Number of detections in history
 */
export function getDetectionCount(): number {
  const storage = getStorage();
  return storage.detections.length;
}

/**
 * Check if storage is available and working
 * 
 * @returns true if localStorage is available, false otherwise
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
