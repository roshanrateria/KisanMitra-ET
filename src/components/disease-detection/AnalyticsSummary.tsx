import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Activity, Target } from 'lucide-react';
import { aggregateDiseaseFrequency, calculateConfidenceStats, DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';

interface AnalyticsSummaryProps {
  detections: DetectionResult[];
  dateRange?: DateRangeFilter;
  fieldFilter?: FieldFilter;
}

/**
 * AnalyticsSummary Component
 * 
 * Displays summary statistics at the top of the analytics dashboard:
 * - Total detections count
 * - Unique diseases count
 * - Most common disease
 * - Average confidence score
 * 
 * Handles insufficient data case (< 3 detections) by displaying an encouragement message.
 * 
 * **Validates: Requirements 7.1, 7.7**
 */
export function AnalyticsSummary({ detections, dateRange, fieldFilter }: AnalyticsSummaryProps) {
  // Check if we have sufficient data for analytics
  const hasSufficientData = detections.length >= 3;

  // If insufficient data, show encouragement message
  if (!hasSufficientData) {
    return (
      <Card className="w-full shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4 p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-base font-semibold text-blue-900 dark:text-blue-100">
                Start Building Your Analytics
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You currently have {detections.length} detection{detections.length !== 1 ? 's' : ''}. 
                Analyze at least 3 images to unlock detailed analytics and insights about disease patterns in your crops.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalDetections = detections.length;
  
  // Get disease frequency data
  const diseaseFrequencies = aggregateDiseaseFrequency(detections, dateRange, fieldFilter);
  const uniqueDiseasesCount = diseaseFrequencies.length;
  const mostCommonDisease = diseaseFrequencies.length > 0 ? diseaseFrequencies[0] : null;

  // Calculate average confidence score across all predictions
  const confidenceStats = calculateConfidenceStats(detections, dateRange, fieldFilter);
  const totalPredictions = confidenceStats.reduce((sum, stat) => sum + stat.count, 0);
  const weightedConfidenceSum = confidenceStats.reduce(
    (sum, stat) => sum + (stat.avg * stat.count),
    0
  );
  const averageConfidence = totalPredictions > 0 ? weightedConfidenceSum / totalPredictions : 0;

  /**
   * Format confidence score as percentage with one decimal place
   */
  const formatConfidence = (confidence: number): string => {
    return `${(Math.round(confidence * 1000) / 10).toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Detections Card */}
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Detections
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalDetections}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Images analyzed
          </p>
        </CardContent>
      </Card>

      {/* Unique Diseases Card */}
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Unique Diseases
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueDiseasesCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Different disease types
          </p>
        </CardContent>
      </Card>

      {/* Most Common Disease Card */}
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Most Common Disease
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {mostCommonDisease ? (
            <>
              <div className="text-lg font-bold truncate" title={mostCommonDisease.diseaseName}>
                {mostCommonDisease.diseaseName}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {mostCommonDisease.count} occurrences
                </Badge>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </CardContent>
      </Card>

      {/* Average Confidence Card */}
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Average Confidence
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatConfidence(averageConfidence)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Detection accuracy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
