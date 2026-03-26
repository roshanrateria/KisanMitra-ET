import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Sprout, Navigation } from 'lucide-react';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface OnboardingProps {
  onComplete: (fieldData: any) => void;
}

// Drawing component with visual markers
const DrawingLayer = ({ 
  isDrawing, 
  points,
  onAddPoint
}: { 
  isDrawing: boolean; 
  points: [number, number][];
  onAddPoint: (point: [number, number]) => void;
}) => {
  const map = useMapEvents({
    click: (e) => {
      if (!isDrawing) return;
      
      console.log('Onboarding: Map clicked at:', e.latlng);
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      onAddPoint(newPoint);
    },
  });

  // Disable/enable map interactions based on drawing mode
  useEffect(() => {
    if (!map) return;
    
    if (isDrawing) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      console.log('Onboarding: Map interactions disabled - drawing mode ON');
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      console.log('Onboarding: Map interactions enabled - drawing mode OFF');
    }
  }, [isDrawing, map]);

  return (
    <>
      {/* Show numbered markers for each point */}
      {points.map((point, index) => (
        <Marker 
          key={index} 
          position={point} 
          icon={new L.DivIcon({
            className: 'custom-drawing-marker',
            html: `<div style="
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
            ">${index + 1}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
        />
      ))}
      
      {/* Show the polygon being drawn */}
      {points.length > 1 && (
        <Polygon 
          positions={points as LatLngExpression[]}
          pathOptions={{ 
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2, 
            dashArray: '5, 5',
            weight: 3
          }}
        />
      )}
      
      {/* Show first point with pulse animation */}
      {points.length === 1 && (
        <Marker 
          position={points[0]} 
          icon={new L.DivIcon({
            className: 'custom-drawing-marker',
            html: `<div style="
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              width: 32px;
              height: 32px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
            ">1</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
        />
      )}
    </>
  );
};

// Component to handle map centering
const MapCenterHandler = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
};

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(1);
  const [fieldName, setFieldName] = useState('');
  const [cropType, setCropType] = useState('');
  const [soilType, setSoilType] = useState('Loam');
  const [coordinates, setCoordinates] = useState<[number, number][]>([]);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [area, setArea] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [isLocating, setIsLocating] = useState(false);
  const [locationFetched, setLocationFetched] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  // Auto-fetch location when step 2 is reached
  useEffect(() => {
    if (step === 2 && !locationFetched) {
      getCurrentLocation();
    }
  }, [step]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter: [number, number] = [position.coords.latitude, position.coords.longitude];
          setMapCenter(newCenter);
          setMapZoom(16);
          setLocationFetched(true);
          setIsLocating(false);
          try {
            toast.success('Location found! Map centered to your location.');
          } catch (err) {
            console.error('[Onboarding] toast error', err);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLocating(false);
          try {
            toast.error('Could not get your location. Using default view.');
          } catch (err) {
            console.error('[Onboarding] toast error', err);
          }
        }
      );
    }
  };

  const calculateArea = (coords: [number, number][]) => {
    if (coords.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i][1] * coords[j][0];
      area -= coords[j][1] * coords[i][0];
    }
    area = Math.abs(area / 2);
    
    const earthRadius = 6371;
    const latAvg = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
    const kmToLatDeg = 1 / 111;
    const kmToLngDeg = 1 / (111 * Math.cos(latAvg * Math.PI / 180));
    const areaKm2 = area / (kmToLatDeg * kmToLngDeg);
    const areaAcres = areaKm2 * 247.105;
    
    return areaAcres;
  };

  const handlePolygonComplete = () => {
    if (drawingPoints.length < 3) {
      try {
        toast.error('Please mark at least 3 points to complete the field boundary');
      } catch (err) {
        console.error('[Onboarding] toast error', err);
      }
      return;
    }
    
    console.info('[Onboarding] polygon complete', drawingPoints);
    setCoordinates(drawingPoints);
    const calculatedArea = calculateArea(drawingPoints);
    setArea(calculatedArea);
    setIsDrawing(false);
    setDrawingPoints([]);
    try {
      toast.success(`Field boundary marked! Area: ${calculatedArea.toFixed(2)} acres`);
    } catch (err) {
      console.error('[Onboarding] toast error', err);
    }
  };

  const handleAddPoint = (point: [number, number]) => {
    const newPoints = [...drawingPoints, point];
    setDrawingPoints(newPoints);
    console.log(`Onboarding: Point ${newPoints.length} added:`, point);
    try {
      toast.success(
        newPoints.length >= 3 
          ? `${newPoints.length} points marked. Click "Complete Drawing" when done.`
          : `Point ${newPoints.length} marked. ${3 - newPoints.length} more needed (minimum 3)`
      );
    } catch (err) {
      console.error('[Onboarding] toast error', err);
    }
  };

  const handleComplete = () => {
    if (!fieldName || !cropType || coordinates.length < 3) {
      toast.error('Please complete all field details');
      return;
    }

    const fieldData = {
      id: Date.now().toString(),
      name: fieldName,
      crop: cropType,
      coordinates,
      soilType,
      area
    };

    onComplete(fieldData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <Sprout className="w-10 h-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-primary">Welcome to KisanMitra!</h1>
            <p className="text-muted-foreground">Let's set up your first field</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                placeholder="e.g., North Field"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="cropType">Crop Type</Label>
              <Input
                id="cropType"
                placeholder="e.g., Rice, Wheat, Cotton"
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="soilType">Soil Type (Optional)</Label>
              <select
                id="soilType"
                className="w-full p-2 border rounded-md"
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
              >
                <option value="Loam">Loam</option>
                <option value="Clay">Clay</option>
                <option value="Sandy">Sandy</option>
                <option value="Sandy Loam">Sandy Loam</option>
              </select>
            </div>

            <Button onClick={() => setStep(2)} className="w-full">
              Next: Mark Field Boundary
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3 mb-2">
              <div>
                <h3 className="text-xl font-semibold">Mark Your Field on Map</h3>
                <p className="text-sm text-muted-foreground">
                  Click points on the map to outline your field boundary (minimum 3 points)
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!isDrawing && (
                  <Button
                    onClick={getCurrentLocation}
                    variant="outline"
                    size="sm"
                    disabled={isLocating}
                  >
                    <Navigation className={`w-4 h-4 mr-2 ${isLocating ? 'animate-spin' : ''}`} />
                    {isLocating ? 'Locating...' : 'My Location'}
                  </Button>
                )}
                {!isDrawing && coordinates.length === 0 && (
                  <Button
                    onClick={() => {
                      console.log('Onboarding: Drawing mode activated');
                      setIsDrawing(true);
                      setDrawingPoints([]);
                      toast.success('Drawing mode active! Click on the map to mark points.');
                    }}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Start Drawing
                  </Button>
                )}
              </div>
            </div>

            {isDrawing && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-2 border-blue-500 dark:border-blue-600 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                        🎯 DRAWING MODE ACTIVE
                      </p>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                      Click on the map to mark points. Need minimum 3 points to complete.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">
                        {drawingPoints.length} {drawingPoints.length === 1 ? 'point' : 'points'} marked
                      </div>
                      {drawingPoints.length >= 3 && (
                        <div className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-bold animate-bounce">
                          ✓ Ready to complete!
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {drawingPoints.length >= 3 && (
                      <Button 
                        onClick={handlePolygonComplete} 
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        Complete Drawing
                      </Button>
                    )}
                    <Button 
                      onClick={() => {
                        console.log('Onboarding: Drawing mode cancelled');
                        setIsDrawing(false);
                        setDrawingPoints([]);
                      }} 
                      variant="destructive" 
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {mounted && (
              <div className={`h-96 rounded-lg overflow-hidden border-2 ${isDrawing ? 'border-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900' : 'border-border'} transition-all duration-300`}>
                {isLocating && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                    <Navigation className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">Getting your location...</span>
                  </div>
                )}
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  className={isDrawing ? 'drawing-mode' : ''}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  <MapCenterHandler center={mapCenter} />
                  
                  <DrawingLayer 
                    isDrawing={isDrawing} 
                    points={drawingPoints}
                    onAddPoint={handleAddPoint}
                  />
                  
                  {/* Show current location marker */}
                  {locationFetched && !isDrawing && (
                    <Marker 
                      position={mapCenter}
                      icon={new L.Icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                      })}
                    />
                  )}
                  
                  {coordinates.length > 0 && (
                    <Polygon 
                      positions={coordinates as LatLngExpression[]}
                      pathOptions={{ 
                        color: '#10b981',
                        fillColor: '#10b981',
                        fillOpacity: 0.3,
                        weight: 3
                      }}
                    />
                  )}
                </MapContainer>
              </div>
            )}

            {coordinates.length > 0 && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="font-semibold">Field marked successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Area: {area.toFixed(2)} acres
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                onClick={handleComplete} 
                disabled={coordinates.length < 3}
                className="flex-1"
              >
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
