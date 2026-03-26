import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartSkeletonProps {
  title?: string;
  description?: string;
  height?: number;
}

/**
 * ChartSkeleton Component
 * 
 * Displays a skeleton loader for chart components while data is loading.
 * Shows a card with title skeleton and chart area skeleton.
 * 
 * **Validates: Requirement 9.2 - Show progress during API call**
 */
export function ChartSkeleton({ title, description, height = 400 }: ChartSkeletonProps) {
  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        {title ? (
          <div className="text-lg font-semibold">{title}</div>
        ) : (
          <Skeleton className="h-6 w-48" />
        )}
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : (
          <Skeleton className="h-4 w-64 mt-2" />
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Chart area skeleton */}
          <Skeleton className="w-full rounded-lg" style={{ height: `${height}px` }} />
          
          {/* Legend skeleton */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
