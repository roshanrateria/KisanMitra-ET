// Analytics utilities for disease detection data aggregation

import { DetectionResult, Prediction } from './types';

/**
 * Disease frequency aggregation result
 */
export interface DiseaseFrequency {
  diseaseName: string;
  count: number;
}

/**
 * Temporal data point for time-series analysis
 */
export interface TemporalDataPoint {
  period: string; // ISO date string for the period start
  counts: Map<string, number>; // Disease name -> count
  totalCount: number;
}

/**
 * Confidence statistics for a disease type
 */
export interface ConfidenceStats {
  diseaseName: string;
  min: number;
  max: number;
  avg: number;
  count: number; // Number of predictions
}

/**
 * Date range filter options
 */
export interface DateRangeFilter {
  start: Date;
  end: Date;
}

/**
 * Field location filter options
 */
export interface FieldFilter {
  lat: number;
  lng: number;
  radiusKm?: number; // Default: 1km
}

/**
 * Aggregate disease frequency from detection results
 * Counts total occurrences of each disease type across all detections
 * 
 * @param detections - Array of detection results to aggregate
 * @param dateRange - Optional date range filter
 * @param fieldFilter - Optional field location filter
 * @returns Array of disease frequencies sorted by count descending
 */
export function aggregateDiseaseFrequency(
  detections: DetectionResult[],
  dateRange?: DateRangeFilter,
  fieldFilter?: FieldFilter
): DiseaseFrequency[] {
  // Apply filters
  const filtered = applyFilters(detections, dateRange, fieldFilter);
  
  // Count occurrences of each disease
  const frequencyMap = new Map<string, number>();
  
  filtered.forEach(detection => {
    detection.predictions.forEach(prediction => {
      const currentCount = frequencyMap.get(prediction.class_name) || 0;
      frequencyMap.set(prediction.class_name, currentCount + 1);
    });
  });
  
  // Convert to array and sort by count descending
  const frequencies: DiseaseFrequency[] = Array.from(frequencyMap.entries()).map(
    ([diseaseName, count]) => ({ diseaseName, count })
  );
  
  return frequencies.sort((a, b) => b.count - a.count);
}

/**
 * Aggregate detection data by time periods (week or month)
 * Groups detections into time buckets and counts diseases per period
 * 
 * @param detections - Array of detection results to aggregate
 * @param periodType - 'week' or 'month' for grouping
 * @param dateRange - Optional date range filter
 * @param fieldFilter - Optional field location filter
 * @returns Array of temporal data points sorted by period ascending
 */
export function aggregateTemporalData(
  detections: DetectionResult[],
  periodType: 'week' | 'month',
  dateRange?: DateRangeFilter,
  fieldFilter?: FieldFilter
): TemporalDataPoint[] {
  // Apply filters
  const filtered = applyFilters(detections, dateRange, fieldFilter);
  
  // Group detections by period
  const periodMap = new Map<string, DetectionResult[]>();
  
  filtered.forEach(detection => {
    const periodKey = getPeriodKey(detection.timestamp, periodType);
    const periodDetections = periodMap.get(periodKey) || [];
    periodDetections.push(detection);
    periodMap.set(periodKey, periodDetections);
  });
  
  // Aggregate disease counts per period
  const temporalData: TemporalDataPoint[] = Array.from(periodMap.entries()).map(
    ([period, periodDetections]) => {
      const counts = new Map<string, number>();
      let totalCount = 0;
      
      periodDetections.forEach(detection => {
        detection.predictions.forEach(prediction => {
          const currentCount = counts.get(prediction.class_name) || 0;
          counts.set(prediction.class_name, currentCount + 1);
          totalCount++;
        });
      });
      
      return {
        period,
        counts,
        totalCount,
      };
    }
  );
  
  // Sort by period ascending
  return temporalData.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Calculate confidence statistics for each disease type
 * Computes min, max, and average confidence scores
 * 
 * @param detections - Array of detection results to analyze
 * @param dateRange - Optional date range filter
 * @param fieldFilter - Optional field location filter
 * @returns Array of confidence statistics per disease type
 */
export function calculateConfidenceStats(
  detections: DetectionResult[],
  dateRange?: DateRangeFilter,
  fieldFilter?: FieldFilter
): ConfidenceStats[] {
  // Apply filters
  const filtered = applyFilters(detections, dateRange, fieldFilter);
  
  // Collect all predictions grouped by disease name
  const predictionsByDisease = new Map<string, number[]>();
  
  filtered.forEach(detection => {
    detection.predictions.forEach(prediction => {
      const confidences = predictionsByDisease.get(prediction.class_name) || [];
      confidences.push(prediction.confidence);
      predictionsByDisease.set(prediction.class_name, confidences);
    });
  });
  
  // Calculate statistics for each disease
  const stats: ConfidenceStats[] = Array.from(predictionsByDisease.entries()).map(
    ([diseaseName, confidences]) => {
      const min = Math.min(...confidences);
      const max = Math.max(...confidences);
      const sum = confidences.reduce((acc, val) => acc + val, 0);
      const avg = sum / confidences.length;
      
      return {
        diseaseName,
        min,
        max,
        avg,
        count: confidences.length,
      };
    }
  );
  
  return stats;
}

/**
 * Apply date range and field filters to detection results
 * 
 * @param detections - Array of detection results to filter
 * @param dateRange - Optional date range filter
 * @param fieldFilter - Optional field location filter
 * @returns Filtered array of detection results
 */
function applyFilters(
  detections: DetectionResult[],
  dateRange?: DateRangeFilter,
  fieldFilter?: FieldFilter
): DetectionResult[] {
  let filtered = detections;
  
  // Apply date range filter
  if (dateRange) {
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    
    filtered = filtered.filter(
      detection => detection.timestamp >= startTime && detection.timestamp <= endTime
    );
  }
  
  // Apply field location filter
  if (fieldFilter) {
    const radiusKm = fieldFilter.radiusKm || 1;
    
    filtered = filtered.filter(detection => {
      if (!detection.location) {
        return false;
      }
      
      const distance = calculateDistance(
        fieldFilter.lat,
        fieldFilter.lng,
        detection.location.lat,
        detection.location.lng
      );
      
      return distance <= radiusKm;
    });
  }
  
  return filtered;
}

/**
 * Get period key for grouping detections by time
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @param periodType - 'week' or 'month'
 * @returns ISO date string representing the period start
 */
function getPeriodKey(timestamp: number, periodType: 'week' | 'month'): string {
  const date = new Date(timestamp);
  
  if (periodType === 'month') {
    // Return first day of the month in UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  } else {
    // Return Monday of the week (ISO week) in UTC
    const utcDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    ));
    const dayOfWeek = utcDate.getUTCDay();
    const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjust to Monday
    utcDate.setUTCDate(utcDate.getUTCDate() + diff);
    
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * 
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
