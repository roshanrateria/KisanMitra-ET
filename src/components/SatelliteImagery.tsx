import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSatelliteImagery } from '@/lib/apis';
import { Satellite, Loader2, Download, Calendar, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SatelliteImageryProps {
  coordinates: [number, number][];
  fieldName: string;
  polygonId?: string;
}

export const SatelliteImagery = ({ coordinates, fieldName, polygonId }: SatelliteImageryProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewType, setViewType] = useState<'true-color' | 'ndvi' | 'moisture'>('true-color');

  useEffect(() => {
    loadSatelliteImage();
  }, [coordinates, viewType]);

  const loadSatelliteImage = async () => {
    if (!coordinates || coordinates.length === 0) return;

    setLoading(true);
    try {
      if (polygonId) {
        const images = await import('@/lib/apis').then(m => m.getAgroSatelliteImages(polygonId));
        if (images && images.length > 0) {
          const latest = images.sort((a: any, b: any) => b.dt - a.dt)[0];
          let targetUrl = latest.image.truecolor;
          if (viewType === 'ndvi') targetUrl = latest.image.ndvi;
          if (viewType === 'moisture') targetUrl = latest.image.evi;
          setImageUrl(targetUrl);
        } else {
          toast({ title: 'Processing Images', description: 'Satellite imagery for this new field is being processed. Check back later.' });
        }
      } else {
        const url = await getSatelliteImagery(coordinates, undefined, viewType);
        setImageUrl(url);
        if (!url) {
          toast({
            title: 'Satellite Imagery Unavailable',
            description: 'Cloud coverage too high or no recent imagery available',
            variant: 'destructive'
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to load satellite imagery:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load satellite imagery',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };



  return (
    <Card className="hover-lift">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Satellite className="h-5 w-5 text-primary" />
          <CardTitle>
            <TranslatedText text="Satellite Imagery" targetLanguage={language} />
          </CardTitle>
        </div>
        <CardDescription>
          <TranslatedText 
            text="Real-time satellite imagery from Sentinel-2" 
            targetLanguage={language} 
          />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm">
            <TabsTrigger value="true-color" className="px-1 sm:px-4">
              <TranslatedText text="True Color" targetLanguage={language} />
            </TabsTrigger>
            <TabsTrigger value="ndvi" className="px-1 sm:px-4">
              <TranslatedText text="NDVI" targetLanguage={language} />
            </TabsTrigger>
            <TabsTrigger value="moisture" className="px-1 sm:px-4">
              <TranslatedText text="Moisture" targetLanguage={language} />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative rounded-lg overflow-hidden border bg-muted min-h-[400px] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                <TranslatedText text="Loading satellite imagery..." targetLanguage={language} />
              </p>
            </div>
          ) : imageUrl ? (
            <>
              <img 
                src={imageUrl} 
                alt={`${fieldName} satellite view`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Last 30 days</span>
              </div>
            </>
          ) : (
            <div className="text-center p-8">
              <Satellite className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                <TranslatedText 
                  text="No satellite imagery available" 
                  targetLanguage={language} 
                />
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold">
                <TranslatedText text="Understanding the Views" targetLanguage={language} />
              </p>
              <ul className="space-y-1 list-disc list-inside text-xs">
                <li>
                  <strong><TranslatedText text="True Color" targetLanguage={language} />:</strong>{' '}
                  <TranslatedText text="Natural view of your field" targetLanguage={language} />
                </li>
                <li>
                  <strong><TranslatedText text="NDVI" targetLanguage={language} />:</strong>{' '}
                  <TranslatedText 
                    text="Darker areas indicate healthier crops" 
                    targetLanguage={language} 
                  />
                </li>
                <li>
                  <strong><TranslatedText text="Moisture" targetLanguage={language} />:</strong>{' '}
                  <TranslatedText 
                    text="Shows water content in soil and crops" 
                    targetLanguage={language} 
                  />
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
