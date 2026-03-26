import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { calculateConfidenceStats, DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import { Activity } from 'lucide-react';

interface ConfidenceDistributionChartProps {
  detections: DetectionResult[];
  dateRange?: DateRangeFilter;
  fieldFilter?: FieldFilter;
}

/**
 * ConfidenceDistributionChart Component
 * 
 * Visualizes confidence score distribution per disease type using a grouped bar chart.
 * - Displays min, max, and average confidence values for each disease
 * - Groups data by disease type
 * - Uses Recharts BarChart for visualization
 * - Includes tooltips with detailed statistics
 * 
 * Handles insufficient data case (< 3 detections) by displaying an encouragement message.
 * 
 * **Validates: Requirements 7.6**
 */
export function ConfidenceDistributionChart({ detections, dateRange, fieldFilter }: ConfidenceDistributionChartProps) {
  // Check if we have sufficient data for analytics
  const hasSufficientData = detections.length >= 3;

  // If insufficient data, show encouragement message
  if (!hasSufficientData) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Confidence Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-base font-semibold text-blue-900 dark:text-blue-100">
                Start Building Your Analytics
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You currently have {detections.length} detection{detections.length !== 1 ? 's' : ''}. 
                Analyze at least 3 images to see confidence score patterns across diseases.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate confidence statistics
  const confidenceStats = calculateConfidenceStats(detections, dateRange, fieldFilter);

  // If no diseases detected across all detections
  if (confidenceStats.length === 0) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Confidence Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No disease data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for Recharts - convert to percentage and round
  const chartData = confidenceStats.map(stat => ({
    name: stat.diseaseName,
    min: Math.round(stat.min * 1000) / 10,
    max: Math.round(stat.max * 1000) / 10,
    avg: Math.round(stat.avg * 1000) / 10,
    count: stat.count,
  }));

  // Color palette for different metrics
  const colors = {
    min: '#ef4444', // red-500 - minimum confidence
    avg: '#3b82f6', // blue-500 - average confidence
    max: '#22c55e', // green-500 - maximum confidence
  };

  /**
   * Custom tooltip component with detailed statistics
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">{data.name}</p>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Min: <span className="font-medium text-red-600 dark:text-red-400">{data.min}%</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Avg: <span className="font-medium text-blue-600 dark:text-blue-400">{data.avg}%</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Max: <span className="font-medium text-green-600 dark:text-green-400">{data.max}%</span>
            </p>
            <p className="text-sm text-muted-foreground border-t pt-1 mt-1">
              Samples: <span className="font-medium text-foreground">{data.count}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Confidence Distribution</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Min, average, and max confidence scores by disease type
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.min }} />
            <span className="text-muted-foreground">Minimum</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.avg }} />
            <span className="text-muted-foreground">Average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.max }} />
            <span className="text-muted-foreground">Maximum</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{ value: 'Confidence (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
            <Bar dataKey="min" fill={colors.min} radius={[4, 4, 0, 0]} />
            <Bar dataKey="avg" fill={colors.avg} radius={[4, 4, 0, 0]} />
            <Bar dataKey="max" fill={colors.max} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
