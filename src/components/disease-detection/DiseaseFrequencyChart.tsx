import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { aggregateDiseaseFrequency, DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import { Activity } from 'lucide-react';

interface DiseaseFrequencyChartProps {
  detections: DetectionResult[];
  dateRange?: DateRangeFilter;
  fieldFilter?: FieldFilter;
}

/**
 * DiseaseFrequencyChart Component
 * 
 * Visualizes disease frequency data as a bar chart using Recharts library.
 * - Displays disease names on X-axis
 * - Shows occurrence count on Y-axis
 * - Sorted by frequency descending
 * - Includes tooltips with detailed information
 * - Uses color-coded bars for visual distinction
 * 
 * Handles insufficient data case (< 3 detections) by displaying an encouragement message.
 * 
 * **Validates: Requirements 7.2**
 */
export function DiseaseFrequencyChart({ detections, dateRange, fieldFilter }: DiseaseFrequencyChartProps) {
  // Check if we have sufficient data for analytics
  const hasSufficientData = detections.length >= 3;

  // If insufficient data, show encouragement message
  if (!hasSufficientData) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Disease Frequency</CardTitle>
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
                Analyze at least 3 images to see disease frequency patterns in your crops.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Aggregate disease frequency data (already sorted by count descending)
  const diseaseFrequencies = aggregateDiseaseFrequency(detections, dateRange, fieldFilter);

  // If no diseases detected across all detections
  if (diseaseFrequencies.length === 0) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Disease Frequency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No disease data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for Recharts
  const chartData = diseaseFrequencies.map(item => ({
    name: item.diseaseName,
    count: item.count,
  }));

  // Color palette for bars (distinct colors for visual distinction)
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

  /**
   * Custom tooltip component with detailed information
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.count / detections.length) * 100).toFixed(1);
      
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Occurrences: <span className="font-medium text-foreground">{data.count}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            In {percentage}% of detections
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Disease Frequency</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Distribution of detected diseases across all analyses
        </p>
      </CardHeader>
      <CardContent>
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
              label={{ value: 'Occurrences', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
