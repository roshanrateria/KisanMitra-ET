import { useState, useEffect } from 'react';
import { DetectionResult } from '@/lib/disease-detection/types';
import { DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import { AnalyticsFilters } from './AnalyticsFilters';
import { AnalyticsSummary } from './AnalyticsSummary';
import { AnalyticsSummarySkeleton } from './AnalyticsSummarySkeleton';
import { DiseaseFrequencyChart } from './DiseaseFrequencyChart';
import { TemporalTrendChart } from './TemporalTrendChart';
import { ConfidenceDistributionChart } from './ConfidenceDistributionChart';
import { DiseaseLocationMap } from './DiseaseLocationMap';
import { ChartSkeleton } from './ChartSkeleton';

interface AnalyticsDashboardProps {
  detections: DetectionResult[];
  isLoading?: boolean;
}

/**
 * AnalyticsDashboard Component
 * 
 * Complete analytics dashboard with filters and all visualization components.
 * Includes skeleton loaders for better UX during data loading.
 * 
 * **Validates: Requirements 7.1-7.9, 9.2**
 */
export function AnalyticsDashboard({ detections, isLoading = false }: AnalyticsDashboardProps) {
  // State for filters
  const [dateRange, setDateRange] = useState<DateRangeFilter | undefined>(undefined);
  const [fieldFilter, setFieldFilter] = useState<FieldFilter | undefined>(undefined);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Simulate brief loading when filters change for smooth UX
  useEffect(() => {
    if (dateRange || fieldFilter) {
      setIsFilterLoading(true);
      const timer = setTimeout(() => {
        setIsFilterLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dateRange, fieldFilter]);

  const showLoading = isLoading || isFilterLoading;

  return (
    <div className="space-y-6">
      {/* Filters Component - always visible */}
      {!isLoading && (
        <AnalyticsFilters
          detections={detections}
          onDateRangeChange={setDateRange}
          onFieldFilterChange={setFieldFilter}
        />
      )}

      {/* Summary Cards with skeleton loader */}
      {showLoading ? (
        <AnalyticsSummarySkeleton />
      ) : (
        <AnalyticsSummary
          detections={detections}
          dateRange={dateRange}
          fieldFilter={fieldFilter}
        />
      )}

      {/* Charts Grid with skeleton loaders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showLoading ? (
          <>
            <ChartSkeleton title="Disease Frequency" />
            <ChartSkeleton title="Disease Trends Over Time" />
            <ChartSkeleton title="Confidence Distribution" />
            <ChartSkeleton title="Disease Location Map" height={450} />
          </>
        ) : (
          <>
            <DiseaseFrequencyChart
              detections={detections}
              dateRange={dateRange}
              fieldFilter={fieldFilter}
            />

            <TemporalTrendChart
              detections={detections}
              periodType="week"
              dateRange={dateRange}
              fieldFilter={fieldFilter}
            />

            <ConfidenceDistributionChart
              detections={detections}
              dateRange={dateRange}
              fieldFilter={fieldFilter}
            />

            <DiseaseLocationMap
              detections={detections}
              dateRange={dateRange}
              fieldFilter={fieldFilter}
            />
          </>
        )}
      </div>
    </div>
  );
}
