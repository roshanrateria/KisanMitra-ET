import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { createAgroPolygon, getAgroNDVI } from '@/lib/apis';
import { MapPin, Plus, Trash2, Edit3, Navigation, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon for drawing points
const drawingPointIcon = new L.DivIcon({
  className: 'custom-drawing-marker',
  html: `<div style="
    background-color: #3b82f6;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface FieldMapProps {
  fields: any[];
  onFieldAdd: (field: any) => void;
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
      
      console.log('Map clicked at:', e.latlng);
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      onAddPoint(newPoint);
    }
  });

  // Disable/enable map dragging based on drawing mode
  useEffect(() => {
    if (!map) return;
    
    if (isDrawing) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      console.log('Map interactions disabled - drawing mode ON');
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      console.log('Map interactions enabled - drawing mode OFF');
    }
  }, [isDrawing, map]);

  return (
    <>
      {/* Show numbered markers for each point - HIGHLY VISIBLE */}
      {points.map((point, index) => (
        <Marker 
          key={`marker-${index}`}
          position={point}
          icon={new L.DivIcon({
            className: '',
            html: `
              <div style="
                position: relative;
                width: 50px;
                height: 50px;
              ">
                <!-- Pulsing outer ring -->
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 60px;
                  height: 60px;
                  border-radius: 50%;
                  background: rgba(59, 130, 246, 0.3);
                  animation: pulse 2s ease-out infinite;
                "></div>
                <!-- Main marker -->
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                  width: 50px;
                  height: 50px;
                  border-radius: 50%;
                  border: 5px solid white;
                  box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 0 3px #ef4444;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: 900;
                  font-size: 24px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                  z-index: 1000 !important;
                ">${index + 1}</div>
              </div>
            `,
            iconSize: [50, 50],
            iconAnchor: [25, 25],
          })}
          zIndexOffset={1000}
        />
      ))}
      
      {/* Show the polygon being drawn with BRIGHT visible line */}
      {points.length > 1 && (
        <Polygon 
          positions={points}
          pathOptions={{ 
            color: '#ef4444',
            fillColor: '#fca5a5',
            fillOpacity: 0.3, 
            dashArray: '10, 10',
            weight: 4,
            lineCap: 'round',
            lineJoin: 'round'
          }}
        />
      )}
      
      {/* Show connecting line from last point to first if we have points */}
      {points.length >= 2 && (
        <Polygon 
          positions={points}
          pathOptions={{ 
            color: '#3b82f6',
            fillColor: 'transparent',
            fillOpacity: 0,
            dashArray: '5, 5',
            weight: 2
          }}
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

export const FieldMap = ({ fields, onFieldAdd }: FieldMapProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [drawnCoordinates, setDrawnCoordinates] = useState<[number, number][]>([]);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [fieldName, setFieldName] = useState('');
  const [crop, setCrop] = useState('');
  const [calculatedArea, setCalculatedArea] = useState(0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationFetched, setLocationFetched] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-fetch location on component mount
  useEffect(() => {
    if (!locationFetched) {
      getCurrentLocation();
    }
  }, [locationFetched]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter: [number, number] = [position.coords.latitude, position.coords.longitude];
          console.log('Location found:', newCenter);
          setMapCenter(newCenter);
          setMapZoom(18); // Zoom closer for better field marking
          setLocationFetched(true);
          setIsLocating(false);
          toast({
            title: "📍 Location Found",
            description: "Map centered to your location. You can now mark your field."
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLocating(false);
          toast({
            title: "Location Error",
            description: "Could not get your location. You can still zoom to a location manually.",
            variant: "destructive"
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive"
      });
    }
  };

  const calculateArea = (coords: [number, number][]) => {
    if (coords.length < 3) return 0;
    
    const R = 6371000;
    let area = 0;
    
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      const lat1 = coords[i][0] * Math.PI / 180;
      const lat2 = coords[j][0] * Math.PI / 180;
      const lng1 = coords[i][1] * Math.PI / 180;
      const lng2 = coords[j][1] * Math.PI / 180;
      
      area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    
    area = Math.abs(area * R * R / 2);
    return area / 4046.86;
  };

  const handlePolygonComplete = () => {
    if (drawingPoints.length < 3) {
      toast({
        title: "Not Enough Points",
        description: "Please mark at least 3 points to complete the field boundary",
        variant: "destructive"
      });
      return;
    }
    
    console.log('Polygon completed with coords:', drawingPoints);
    setDrawnCoordinates(drawingPoints);
    setCalculatedArea(calculateArea(drawingPoints));
    setIsDrawingMode(false);
    setDrawingPoints([]);
    toast({
      title: "Field Boundary Marked!",
      description: `${calculateArea(drawingPoints).toFixed(2)} acres marked. Fill in field details below.`
    });
  };

  const handleAddPoint = (point: [number, number]) => {
    const newPoints = [...drawingPoints, point];
    setDrawingPoints(newPoints);
    console.log(`Point ${newPoints.length} added:`, point);
    toast({
      title: `Point ${newPoints.length} Marked`,
      description: newPoints.length >= 3 
        ? `${newPoints.length} points marked. Click "Complete Drawing" when done.`
        : `${3 - newPoints.length} more point(s) needed (minimum 3)`
    });
  };

  const clearDrawing = () => {
    setDrawnCoordinates([]);
    setCalculatedArea(0);
    setFieldName('');
    setCrop('');
  };

  const handleAddField = async () => {
    if (drawnCoordinates.length === 0 || !fieldName || !crop) return;

    setIsProcessing(true);
    let polygonId;
    let ndviData;

    try {
      const polyRes = await createAgroPolygon(fieldName, drawnCoordinates);
      if (polyRes && polyRes.id) {
        polygonId = polyRes.id;
        toast({ title: 'Agromonitoring Polygon Created', description: `ID: ${polygonId}` });
        
        const ndviRes = await getAgroNDVI(polygonId);
        if (ndviRes) {
          // get the most recent valid ndvi reading
          const latest = ndviRes.sort((a: any, b: any) => b.dt - a.dt)[0];
          if (latest) ndviData = latest;
        }
      }
    } catch (e) {
      console.error('Failed to register field with Agromonitoring', e);
      toast({ title: 'Agromonitoring Error', description: 'Could not register remote polygon', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }

    const newField = {
      id: Date.now().toString(),
      name: fieldName,
      crop,
      coordinates: drawnCoordinates,
      soilType: 'Unknown',
      area: calculatedArea,
      polygonId,
      ndviData
    };

    onFieldAdd(newField);
    clearDrawing();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <TranslatedText text="Field Management" targetLanguage={language} />
        </h3>
        <div className="flex gap-2">
          <Button 
            onClick={getCurrentLocation} 
            variant="outline" 
            size="sm"
            disabled={isLocating}
          >
            <Navigation className={`w-4 h-4 mr-2 ${isLocating ? 'animate-spin' : ''}`} />
            <TranslatedText text={isLocating ? "Locating..." : "My Location"} targetLanguage={language} />
          </Button>
          {!isDrawingMode && drawnCoordinates.length === 0 && (
            <Button onClick={() => {
              console.log('Drawing mode activated');
              setIsDrawingMode(true);
              setDrawingPoints([]);
              toast({
                title: "Drawing Mode Active",
                description: "Click on the map to mark your field boundary (minimum 3 points)"
              });
            }} size="sm" className="bg-primary hover:bg-primary/90">
              <Edit3 className="w-4 h-4 mr-2" />
              <TranslatedText text="Draw Field" targetLanguage={language} />
            </Button>
          )}
          {drawnCoordinates.length > 0 && (
            <Button onClick={clearDrawing} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              <TranslatedText text="Clear" targetLanguage={language} />
            </Button>
          )}
        </div>
      </div>

      {isDrawingMode && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-2 border-blue-500 dark:border-blue-600 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                  🎯 <TranslatedText text="DRAWING MODE ACTIVE" targetLanguage={language} />
                </p>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                <TranslatedText text="Click on the map to mark points. Need minimum 3 points to complete." targetLanguage={language} />
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
                  <TranslatedText text="Complete Drawing" targetLanguage={language} />
                </Button>
              )}
              <Button 
                onClick={() => {
                  console.log('Drawing mode cancelled');
                  setIsDrawingMode(false);
                  setDrawingPoints([]);
                }} 
                variant="destructive" 
                size="sm"
              >
                <TranslatedText text="Cancel" targetLanguage={language} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Leaflet Map */}
      <div className={`h-[500px] rounded-lg overflow-hidden mb-4 border-2 ${isDrawingMode ? 'border-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900' : 'border-border'} relative transition-all duration-300`}>
        {isLocating && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <Navigation className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Getting your location...</span>
          </div>
        )}
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
          className={isDrawingMode ? 'drawing-mode' : ''}
          style={{ 
            height: '100%', 
            width: '100%', 
          }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapCenterHandler center={mapCenter} />
          
          <DrawingLayer 
            isDrawing={isDrawingMode} 
            points={drawingPoints}
            onAddPoint={handleAddPoint}
          />
          
          {/* Show current location marker */}
          {locationFetched && !isDrawingMode && (
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
          
          {drawnCoordinates.length > 0 && (
            <Polygon
              positions={drawnCoordinates}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.3,
                weight: 3
              }}
            />
          )}
          
          {fields.map(field => (
            field.coordinates && field.coordinates.length > 0 && (
              <Polygon
                key={field.id}
                positions={field.coordinates}
                pathOptions={{
                  color: '#f97316',
                  fillColor: '#f97316',
                  fillOpacity: 0.3,
                  weight: 2
                }}
              />
            )
          ))}
        </MapContainer>
      </div>

      {drawnCoordinates.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg animate-fade-in">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            <TranslatedText text="Area drawn" targetLanguage={language} />: {calculatedArea.toFixed(2)} acres
          </p>
        </div>
      )}

      {/* Existing Fields */}
      {fields.length > 0 && (
        <div className="mb-4 space-y-2">
          <h4 className="font-medium">
            <TranslatedText text="Your Fields" targetLanguage={language} />
          </h4>
          {fields.map(field => (
            <div key={field.id} className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{field.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Crop: {field.crop} | Area: {typeof field.area === 'number' ? field.area.toFixed(2) : Number(field.area).toFixed(2)} acres
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Field Form */}
      {drawnCoordinates.length > 0 && (
        <div className="space-y-3 p-4 bg-muted rounded-lg">
          <h4 className="font-medium">
            <TranslatedText text="Add New Field" targetLanguage={language} />
          </h4>
          <Input
            placeholder="Field name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
          />
          <Input
            placeholder="Crop (e.g., Wheat, Rice, Cotton)"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
          />
          <Button 
            onClick={handleAddField} 
            className="w-full"
            disabled={!fieldName || !crop || isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            <TranslatedText text={isProcessing ? "Processing..." : "Add Field"} targetLanguage={language} />
          </Button>
        </div>
      )}
    </Card>
  );
};
