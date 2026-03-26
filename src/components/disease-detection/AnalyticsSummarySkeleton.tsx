import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * AnalyticsSummarySkeleton Component
 * 
 * Displays skeleton loaders for the analytics summary cards while data is loading.
 * Shows 4 card skeletons matching the layout of AnalyticsSummary.
 * 
 * **Validates: Requirement 9.2 - Show progress during API call**
 */
export function AnalyticsSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Skeleton for each summary card */}
      {[1, 2, 3, 4].map((index) => (
        <Card key={index} className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
