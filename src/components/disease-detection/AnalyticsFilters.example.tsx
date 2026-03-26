/**
 * Example: How to use AnalyticsFilters with Analytics Components
 * 
 * This example demonstrates how to integrate the AnalyticsFilters component
 * with all analytics dashboard components to provide filtering functionality.
 */

import { useState } from 'react';
import { DetectionResult } from '@/lib/disease-detection/types';
import { DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import { AnalyticsFilters } from './AnalyticsFilters';
import { AnalyticsSummary } from './AnalyticsSummary';
import { DiseaseFrequencyChart } from './DiseaseFrequencyChart';
import { TemporalTrendChart } from './TemporalTrendChart';
import { ConfidenceDistributionChart } from './ConfidenceDistributionChart';
import { DiseaseLocationMap } from './DiseaseLocationMap';

interface AnalyticsDashboardProps {
  detections: DetectionResult[];
}

/**
 * Example Analytics Dashboard with Filters
 * 
 * This component demonstrates the complete integration of:
 * - AnalyticsFilters for date range and field selection
 * - All analytics components receiving filter props
 * - State management for filter changes
 */
export function AnalyticsDashboardExample({ detections }: AnalyticsDashboardProps) {
  // State for filters
  const [dateRange, setDateRange] = useState<DateRangeFilter | undefined>(undefined);
  const [fieldFilter, setFieldFilter] = useState<FieldFilter | undefined>(undefined);

  return (
    <div className="space-y-6">
      {/* Filters Component */}
      <AnalyticsFilters
        detections={detections}
        onDateRangeChange={setDateRange}
        onFieldFilterChange={setFieldFilter}
      />

      {/* Summary Cards */}
      <AnalyticsSummary
        detections={detections}
        dateRange={dateRange}
        fieldFilter={fieldFilter}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}

/**
 * Usage in DiseaseDetectionPage.tsx:
 * 
 * Replace the "Analytics Coming Soon" placeholder in the analytics tab with:
 * 
 * <TabsContent value="analytics">
 *   <AnalyticsDashboardExample detections={detectionHistory} />
 * </TabsContent>
 * 
 * Make sure to import:
 * import { AnalyticsDashboardExample } from '@/components/disease-detection/AnalyticsFilters.example';
 */
