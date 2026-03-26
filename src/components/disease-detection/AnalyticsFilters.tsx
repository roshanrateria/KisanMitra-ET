import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, MapPin, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import { DetectionResult } from '@/lib/disease-detection/types';

interface AnalyticsFiltersProps {
  detections: DetectionResult[];
  onDateRangeChange: (dateRange: DateRangeFilter | undefined) => void;
  onFieldFilterChange: (fieldFilter: FieldFilter | undefined) => void;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const STORAGE_KEY = 'kisanmitra_analytics_filters';

/**
 * AnalyticsFilters Component
 * 
 * Provides filtering controls for the analytics dashboard:
 * - Date range selection using calendar picker
 * - Field location selection from available detection locations
 * - Clear filters functionality
 * - Persists filter preferences to localStorage
 * 
 * **Validates: Requirements 7.8, 7.9**
 */
export function AnalyticsFilters({
  detections,
  onDateRangeChange,
  onFieldFilterChange,
}: AnalyticsFiltersProps) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedField, setSelectedField] = useState<string | undefined>(undefined);

  // Extract unique field locations from detections
  const fieldLocations = extractFieldLocations(detections);

  // Load persisted filters on mount
  useEffect(() => {
    loadPersistedFilters();
  }, []);

  // Persist filters whenever they change
  useEffect(() => {
    persistFilters();
  }, [dateRange, selectedField]);

  /**
   * Load persisted filter preferences from localStorage
   */
  function loadPersistedFilters() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        if (parsed.dateRange) {
          const from = parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined;
          const to = parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined;
          setDateRange({ from, to });
          
          if (from && to) {
            onDateRangeChange({ start: from, end: to });
          }
        }
        
        if (parsed.selectedField) {
          setSelectedField(parsed.selectedField);
          const field = fieldLocations.find(f => f.id === parsed.selectedField);
          if (field) {
            onFieldFilterChange({
              lat: field.lat,
              lng: field.lng,
              radiusKm: 1,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load persisted filters:', error);
    }
  }

  /**
   * Persist current filter preferences to localStorage
   */
  function persistFilters() {
    try {
      const toStore = {
        dateRange: {
          from: dateRange.from?.toISOString(),
          to: dateRange.to?.toISOString(),
        },
        selectedField,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to persist filters:', error);
    }
  }

  /**
   * Handle date range selection from calendar
   */
  function handleDateRangeSelect(range: DateRange | undefined) {
    if (!range) {
      setDateRange({ from: undefined, to: undefined });
      onDateRangeChange(undefined);
      return;
    }

    setDateRange(range);

    // Only emit change if both dates are selected
    if (range.from && range.to) {
      onDateRangeChange({
        start: range.from,
        end: range.to,
      });
    } else if (range.from && !range.to) {
      // If only start date selected, use it as both start and end
      onDateRangeChange({
        start: range.from,
        end: range.from,
      });
    }
  }

  /**
   * Handle field selection change
   */
  function handleFieldSelect(fieldId: string) {
    if (fieldId === 'all') {
      setSelectedField(undefined);
      onFieldFilterChange(undefined);
      return;
    }

    setSelectedField(fieldId);
    const field = fieldLocations.find(f => f.id === fieldId);
    if (field) {
      onFieldFilterChange({
        lat: field.lat,
        lng: field.lng,
        radiusKm: 1,
      });
    }
  }

  /**
   * Clear all filters
   */
  function handleClearFilters() {
    setDateRange({ from: undefined, to: undefined });
    setSelectedField(undefined);
    onDateRangeChange(undefined);
    onFieldFilterChange(undefined);
  }

  const hasActiveFilters = dateRange.from || dateRange.to || selectedField;

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Date Range Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Date Range
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d, yyyy')} -{' '}
                        {format(dateRange.to, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    <span>Select date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Field Location Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Field Location
            </label>
            <Select value={selectedField || 'all'} onValueChange={handleFieldSelect}>
              <SelectTrigger className="w-full">
                <MapPin className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All fields" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fields</SelectItem>
                {fieldLocations.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="flex items-end h-full pt-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Extract unique field locations from detections
 * Groups nearby locations (within 100m) as the same field
 */
function extractFieldLocations(detections: DetectionResult[]): Array<{
  id: string;
  lat: number;
  lng: number;
  label: string;
  count: number;
}> {
  const locations: Array<{
    id: string;
    lat: number;
    lng: number;
    label: string;
    count: number;
  }> = [];

  detections.forEach((detection) => {
    if (!detection.location) return;

    // Check if this location is close to an existing field (within 100m)
    const existingField = locations.find((field) => {
      const distance = calculateDistance(
        field.lat,
        field.lng,
        detection.location!.lat,
        detection.location!.lng
      );
      return distance < 0.1; // 100 meters
    });

    if (existingField) {
      existingField.count++;
    } else {
      locations.push({
        id: `field-${locations.length + 1}`,
        lat: detection.location.lat,
        lng: detection.location.lng,
        label: `Field ${locations.length + 1} (${detection.location.lat.toFixed(4)}, ${detection.location.lng.toFixed(4)})`,
        count: 1,
      });
    }
  });

  return locations;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
