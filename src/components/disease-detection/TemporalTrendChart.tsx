import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { aggregateTemporalData, DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import { TrendingUp } from 'lucide-react';

interface TemporalTrendChartProps {
  detections: DetectionResult[];
  periodType?: 'week' | 'month';
  dateRange?: DateRangeFilter;
  fieldFilter?: FieldFilter;
}

/**
 * TemporalTrendChart Component
 * 
 * Visualizes disease trends over time using a line chart with Recharts library.
 * - Displays time periods (weeks or months) on X-axis
 * - Shows detection count on Y-axis
 * - Multiple lines for different diseases
 * - Includes legend and tooltips
 * - Groups data by week or month
 * 
 * Handles insufficient data case (< 3 detections) by displaying an encouragement message.
 * 
 * **Validates: Requirements 7.3**
 */
export function TemporalTrendChart({ detections, periodType = 'week', dateRange, fieldFilter }: TemporalTrendChartProps) {
  // Check if we have sufficient data for analytics
  const hasSufficientData = detections.length >= 3;

  // If insufficient data, show encouragement message
  if (!hasSufficientData) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Disease Trends Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-base font-semibold text-blue-900 dark:text-blue-100">
                Track Disease Trends
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You currently have {detections.length} detection{detections.length !== 1 ? 's' : ''}. 
                Analyze at least 3 images over time to see how disease patterns change.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Aggregate temporal data
  const temporalData = aggregateTemporalData(detections, periodType, dateRange, fieldFilter);

  // If no temporal data available
  if (temporalData.length === 0) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Disease Trends Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No temporal data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract all unique disease names across all periods
  const allDiseases = new Set<string>();
  temporalData.forEach(dataPoint => {
    dataPoint.counts.forEach((_, diseaseName) => {
      allDiseases.add(diseaseName);
    });
  });

  // Transform data for Recharts - convert Map to object properties
  const chartData = temporalData.map(dataPoint => {
    const point: any = {
      period: formatPeriod(dataPoint.period, periodType),
      periodKey: dataPoint.period, // Keep original for sorting
    };
    
    // Add count for each disease (0 if not present in this period)
    allDiseases.forEach(disease => {
      point[disease] = dataPoint.counts.get(disease) || 0;
    });
    
    return point;
  });

  // Color palette for lines (distinct colors for different diseases)
  const colors = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#f59e0b', // amber-500
    '#84cc16', // lime-500
    '#22c55e', // green-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
  ];

  // Convert disease set to array for consistent ordering
  const diseaseArray = Array.from(allDiseases);

  /**
   * Custom tooltip component with detailed information
   */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Disease Trends Over Time</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Track how disease occurrences change over {periodType === 'week' ? 'weeks' : 'months'}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{
                value: periodType === 'week' ? 'Week' : 'Month',
                position: 'insideBottom',
                offset: -10,
                style: { fontSize: 12 }
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{
                value: 'Occurrences',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12 }
              }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            {diseaseArray.map((disease, index) => (
              <Line
                key={disease}
                type="monotone"
                dataKey={disease}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={disease}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Format period string for display
 * Converts ISO date string to human-readable format
 */
function formatPeriod(period: string, periodType: 'week' | 'month'): string {
  const date = new Date(period);
  
  if (periodType === 'month') {
    // Format as "Jan 2024"
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } else {
    // Format as "Jan 15"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
