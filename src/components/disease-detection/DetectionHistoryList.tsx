import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, MapPin, AlertTriangle, Trash } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { TranslatedText } from '@/components/TranslatedText';
import { translateText } from '@/lib/bhashini';

interface DetectionHistoryListProps {
  detections: DetectionResult[];
  onSelectDetection: (detection: DetectionResult) => void;
  onDeleteDetection: (id: string) => void;
  onClearAll: () => void;
  language?: string;
}

/**
 * Lazy loading image component for thumbnails
 */
function LazyThumbnail({ src, alt }: { src: string; alt: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className="w-20 h-20 rounded-md overflow-hidden bg-muted border border-border">
      {isInView ? (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-muted animate-pulse" />
      )}
    </div>
  );
}

/**
 * Format timestamp to readable date and time
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get primary disease name (first prediction or "No diseases")
 */
const getPrimaryDisease = (result: DetectionResult): string => {
  if (result.count === 0 || result.predictions.length === 0) {
    return 'No diseases detected';
  }
  return result.predictions[0].class_name;
};

export function DetectionHistoryList({
  detections,
  onSelectDetection,
  onDeleteDetection,
  onClearAll,
  language = 'en',
}: DetectionHistoryListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [translatedDiseases, setTranslatedDiseases] = useState<Map<string, string>>(new Map());

  // Sort detections by timestamp (newest first)
  const sortedDetections = [...detections].sort((a, b) => b.timestamp - a.timestamp);

  // Translate disease names when language changes
  useEffect(() => {
    const translateDiseases = async () => {
      if (language === 'en') {
        setTranslatedDiseases(new Map());
        return;
      }

      const translations = new Map<string, string>();
      const uniqueDiseases = new Set<string>();
      
      // Collect all unique disease names
      sortedDetections.forEach(detection => {
        detection.predictions.forEach(pred => {
          uniqueDiseases.add(pred.class_name);
        });
      });

      // Translate each unique disease name
      for (const diseaseName of uniqueDiseases) {
        try {
          const translated = await translateText(diseaseName, 'en', language);
          translations.set(diseaseName, translated);
        } catch (error) {
          console.error(`Failed to translate ${diseaseName}:`, error);
          translations.set(diseaseName, diseaseName);
        }
      }
      
      setTranslatedDiseases(translations);
    };

    translateDiseases();
  }, [language, sortedDetections]);

  // Get translated disease name or fallback to original
  const getDiseaseName = (originalName: string): string => {
    return translatedDiseases.get(originalName) || originalName;
  };

  // Get primary disease name (first prediction or "No diseases")
  const getPrimaryDisease = (result: DetectionResult): string => {
    if (result.count === 0 || result.predictions.length === 0) {
      return 'No diseases detected';
    }
    return getDiseaseName(result.predictions[0].class_name);
  };

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering onSelectDetection
    setDeletingId(id);
    onDeleteDetection(id);
    // Reset deleting state after animation
    setTimeout(() => setDeletingId(null), 300);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all detection history? This action cannot be undone.')) {
      onClearAll();
    }
  };

  if (sortedDetections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          <TranslatedText text="No Detection History" targetLanguage={language} />
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          <TranslatedText 
            text="Your detection history will appear here. Start by uploading and analyzing crop images to detect diseases." 
            targetLanguage={language} 
          />
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Clear All button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            <TranslatedText text="Detection History" targetLanguage={language} />
          </h3>
          <p className="text-sm text-muted-foreground">
            <TranslatedText 
              text={`${sortedDetections.length} ${sortedDetections.length === 1 ? 'detection' : 'detections'}`} 
              targetLanguage={language} 
            />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash className="h-4 w-4 mr-2" />
          <TranslatedText text="Clear All" targetLanguage={language} />
        </Button>
      </div>

      {/* History List */}
      <div className="space-y-3">
        {sortedDetections.map((detection) => (
          <Card
            key={detection.id}
            className={`cursor-pointer hover:shadow-md transition-all duration-200 ${
              deletingId === detection.id ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
            }`}
            onClick={() => onSelectDetection(detection)}
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Thumbnail with lazy loading */}
                <div className="flex-shrink-0">
                  <LazyThumbnail src={detection.imageUrl} alt={detection.imageName} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Title and Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base truncate">
                        {detection.imageName}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {getPrimaryDisease(detection)}
                      </p>
                    </div>
                    <Badge
                      variant={detection.count > 0 ? 'destructive' : 'secondary'}
                      className="flex-shrink-0"
                    >
                      <TranslatedText 
                        text={`${detection.count} ${detection.count === 1 ? 'Disease' : 'Diseases'}`} 
                        targetLanguage={language} 
                      />
                    </Badge>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatTimestamp(detection.timestamp)}
                    </span>
                    {detection.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {detection.location.lat.toFixed(2)}, {detection.location.lng.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <div className="flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(detection.id, e)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
