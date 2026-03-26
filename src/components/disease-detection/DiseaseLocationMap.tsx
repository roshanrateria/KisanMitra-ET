import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Icon, divIcon, point } from 'leaflet';
import { Activity, MapPin } from 'lucide-react';
import { DateRangeFilter, FieldFilter } from '@/lib/disease-detection/analytics';
import 'leaflet/dist/leaflet.css';

interface DiseaseLocationMapProps {
  detections: DetectionResult[];
  center?: { lat: number; lng: number };
  zoom?: number;
  dateRange?: DateRangeFilter;
  fieldFilter?: FieldFilter;
}

/**
 * DiseaseLocationMap Component
 * 
 * Displays geographic distribution of disease detections using Leaflet.js.
 * - Renders interactive map with OpenStreetMap tiles
 * - Shows markers for each detection with location data
 * - Color-codes markers by disease type
 * - Implements marker clustering for nearby detections
 * - Displays popups with detection details on marker click
 * 
 * Handles cases with insufficient location data by displaying an encouragement message.
 * 
 * **Validates: Requirements 7.4, 7.5**
 */
export function DiseaseLocationMap({ 
  detections, 
  center = { lat: 20.5937, lng: 78.9629 }, // Default to center of India
  zoom = 5,
  dateRange,
  fieldFilter
}: DiseaseLocationMapProps) {
  // Apply filters to detections
  let filteredDetections = detections;
  
  // Apply date range filter
  if (dateRange) {
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    filteredDetections = filteredDetections.filter(
      d => d.timestamp >= startTime && d.timestamp <= endTime
    );
  }
  
  // Apply field location filter
  if (fieldFilter) {
    const radiusKm = fieldFilter.radiusKm || 1;
    filteredDetections = filteredDetections.filter(d => {
      if (!d.location) return false;
      const distance = calculateDistance(
        fieldFilter.lat,
        fieldFilter.lng,
        d.location.lat,
        d.location.lng
      );
      return distance <= radiusKm;
    });
  }
  
  // Filter detections that have location data
  const detectionsWithLocation = filteredDetections.filter(d => d.location);

  // Check if we have sufficient data for map display
  const hasSufficientData = detectionsWithLocation.length > 0;

  // If no location data, show encouragement message
  if (!hasSufficientData) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Disease Location Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-base font-semibold text-blue-900 dark:text-blue-100">
                Enable Location for Geographic Insights
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Allow location access when capturing images to see disease distribution across your fields on the map.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate map center from detections if not provided
  const mapCenter = center.lat === 20.5937 && center.lng === 78.9629 && detectionsWithLocation.length > 0
    ? {
        lat: detectionsWithLocation.reduce((sum, d) => sum + d.location!.lat, 0) / detectionsWithLocation.length,
        lng: detectionsWithLocation.reduce((sum, d) => sum + d.location!.lng, 0) / detectionsWithLocation.length,
      }
    : center;

  // Auto-adjust zoom based on detection spread
  const autoZoom = detectionsWithLocation.length === 1 ? 13 : zoom;

  // Get unique disease types for color mapping
  const diseaseTypes = Array.from(
    new Set(
      detectionsWithLocation.flatMap(d => 
        d.predictions.map(p => p.class_name)
      )
    )
  );

  // Color palette for different disease types
  const diseaseColors: Record<string, string> = {};
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

  diseaseTypes.forEach((disease, index) => {
    diseaseColors[disease] = colors[index % colors.length];
  });

  /**
   * Get the primary disease color for a detection
   * Uses the disease with highest confidence
   */
  const getPrimaryDiseaseColor = (detection: DetectionResult): string => {
    if (detection.predictions.length === 0) return '#6b7280'; // gray-500
    
    const primaryDisease = detection.predictions.reduce((prev, current) => 
      current.confidence > prev.confidence ? current : prev
    );
    
    return diseaseColors[primaryDisease.class_name] || '#6b7280';
  };

  /**
   * Create custom marker icon with disease-specific color
   */
  const createCustomIcon = (detection: DetectionResult) => {
    const color = getPrimaryDiseaseColor(detection);
    
    return divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          <div style="
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(45deg);
            color: white;
            font-size: 16px;
            font-weight: bold;
          ">
            ${detection.count}
          </div>
        </div>
      `,
      className: 'custom-marker-icon',
      iconSize: point(32, 32),
      iconAnchor: point(16, 32),
      popupAnchor: point(0, -32),
    });
  };

  /**
   * Format timestamp to readable date
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Create cluster icon with count
   */
  const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount();
    
    return divIcon({
      html: `
        <div style="
          background-color: #3b82f6;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
          font-weight: bold;
        ">
          ${count}
        </div>
      `,
      className: 'custom-cluster-icon',
      iconSize: point(40, 40),
    });
  };

  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Disease Location Map</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Geographic distribution of disease detections ({detectionsWithLocation.length} location{detectionsWithLocation.length !== 1 ? 's' : ''})
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[500px] rounded-lg overflow-hidden border border-border">
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={autoZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={50}
            >
              {detectionsWithLocation.map((detection) => (
                <Marker
                  key={detection.id}
                  position={[detection.location!.lat, detection.location!.lng]}
                  icon={createCustomIcon(detection)}
                >
                  <Popup maxWidth={300}>
                    <div className="p-2">
                      <div className="font-semibold text-base mb-2">
                        Detection Details
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Date:</span>{' '}
                          <span className="font-medium">{formatDate(detection.timestamp)}</span>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Diseases Found:</span>{' '}
                          <span className="font-medium">{detection.count}</span>
                        </div>
                        
                        <div className="border-t pt-2 mt-2">
                          <div className="text-muted-foreground mb-1">Detected Diseases:</div>
                          <div className="space-y-1">
                            {detection.predictions.map((pred, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: diseaseColors[pred.class_name] }}
                                />
                                <span className="font-medium">{pred.class_name}</span>
                                <span className="text-muted-foreground">
                                  ({(pred.confidence * 100).toFixed(1)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="border-t pt-2 mt-2">
                          <span className="text-muted-foreground">Location:</span>{' '}
                          <span className="font-mono text-xs">
                            {detection.location!.lat.toFixed(4)}, {detection.location!.lng.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
        
        {/* Legend */}
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-sm font-semibold mb-2">Disease Types</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {diseaseTypes.map((disease) => (
              <div key={disease} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: diseaseColors[disease] }}
                />
                <span className="text-sm truncate">{disease}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
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
