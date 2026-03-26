import { Card } from '@/components/ui/card';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { TestTube, Droplets, MapPin } from 'lucide-react';

interface SoilDataCardProps {
  soilData: any;
  isLoading: boolean;
}

export const SoilDataCard = ({ soilData, isLoading }: SoilDataCardProps) => {
  const { language } = useLanguage();

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  if (!soilData) {
    return (
      <Card className="p-6">
        <TranslatedText text="Soil data unavailable" targetLanguage={language} />
      </Card>
    );
  }

  const getMoistureLabel = (val: number | null) => {
    if (val === null) return 'N/A';
    if (val < 10) return 'Dry';
    if (val < 20) return 'Moderate';
    if (val < 30) return 'Moist';
    return 'Wet';
  };

  const { soilMoisture, state, district, unit, agency } = soilData;

  return (
    <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TestTube className="w-5 h-5 text-primary" />
        <TranslatedText text="Soil Analysis" targetLanguage={language} />
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-background/50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-muted-foreground">
              <TranslatedText text="Location" targetLanguage={language} />
            </span>
          </div>
          <p className="text-sm font-semibold">{district}</p>
          <p className="text-xs text-muted-foreground">{state}</p>
        </div>

        <div className="bg-background/50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">
              <TranslatedText text="Soil Moisture" targetLanguage={language} />
            </span>
          </div>
          <p className="text-xl font-bold">
            {soilMoisture !== null ? `${soilMoisture}%` : 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground">{getMoistureLabel(soilMoisture)} · {unit}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">Source: {agency} via data.gov.in</p>
    </Card>
  );
};
