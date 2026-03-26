import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, Package, DollarSign, Target } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';

interface HarvestPrediction {
  expectedDate: Date;
  daysRemaining: number;
  estimatedYield: number; // in tons
  qualityGrade: string;
  marketValue: number; // in rupees
  confidence: number; // percentage
  factors: { name: string; impact: string; status: string }[];
}

interface HarvestPredictorProps {
  cropType: string;
  plantingDate: Date;
  fieldArea: number;
  weather: any;
  soilData: any;
}

const predictHarvest = (
  cropType: string,
  plantingDate: Date,
  fieldArea: number,
  weather: any,
  soilData: any
): HarvestPrediction => {
  // Default crop cycle days
  const cropCycles: Record<string, number> = {
    rice: 120,
    wheat: 110,
    cotton: 150,
    maize: 90,
    sugarcane: 300,
    bajra: 75,
    jowar: 90
  };

  const cropKey = Object.keys(cropCycles).find(key => 
    cropType.toLowerCase().includes(key)
  ) || 'wheat';

  const cycleDays = cropCycles[cropKey];
  const expectedDate = new Date(plantingDate);
  expectedDate.setDate(expectedDate.getDate() + cycleDays);

  const today = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Base yield per acre (in tons)
  const baseYields: Record<string, number> = {
    rice: 2.5,
    wheat: 2.0,
    cotton: 1.5,
    maize: 3.0,
    sugarcane: 35.0,
    bajra: 1.2,
    jowar: 1.5
  };

  let estimatedYield = (baseYields[cropKey] || 2.0) * fieldArea;
  let confidence = 75;
  const factors = [];

  // Weather impact
  if (weather) {
    if (weather.temp < 15 || weather.temp > 40) {
      estimatedYield *= 0.9;
      confidence -= 5;
      factors.push({
        name: 'Temperature',
        impact: 'Negative',
        status: 'Extreme temperatures affecting growth'
      });
    } else {
      factors.push({
        name: 'Temperature',
        impact: 'Positive',
        status: 'Optimal temperature range'
      });
      confidence += 5;
    }

    if (weather.humidity > 85) {
      factors.push({
        name: 'Humidity',
        impact: 'Neutral',
        status: 'High humidity - monitor for diseases'
      });
    }
  }

  // Soil impact — support both old SoilGrids shape and new data.gov.in shape
  if (soilData?.properties?.soc) {
    const socValue = soilData.properties.soc.layers[0].values.mean;
    if (socValue > 100) {
      estimatedYield *= 1.1;
      confidence += 5;
      factors.push({
        name: 'Soil Organic Carbon',
        impact: 'Positive',
        status: 'Rich soil supporting better growth'
      });
    }
  } else if (soilData?.soilMoisture !== undefined && soilData.soilMoisture !== null) {
    const moisture = soilData.soilMoisture;
    if (moisture >= 15 && moisture <= 30) {
      estimatedYield *= 1.05;
      confidence += 5;
      factors.push({ name: 'Soil Moisture', impact: 'Positive', status: `Optimal moisture at ${moisture}%` });
    } else if (moisture < 10) {
      estimatedYield *= 0.9;
      confidence -= 5;
      factors.push({ name: 'Soil Moisture', impact: 'Negative', status: `Low moisture at ${moisture}% — irrigation needed` });
    } else {
      factors.push({ name: 'Soil Moisture', impact: 'Neutral', status: `Moisture at ${moisture}%` });
    }
  }

  // Quality assessment
  let qualityGrade = 'Grade A';
  if (confidence < 70) qualityGrade = 'Grade B';
  if (confidence < 60) qualityGrade = 'Grade C';

  // Market value estimation (per quintal in rupees)
  const marketPrices: Record<string, number> = {
    rice: 2750,
    wheat: 2000,
    cotton: 6000,
    maize: 1800,
    sugarcane: 300,
    bajra: 2200,
    jowar: 2500
  };

  const pricePerQuintal = marketPrices[cropKey] || 2000;
  const marketValue = (estimatedYield * 10) * pricePerQuintal; // Convert tons to quintals

  factors.push({
    name: 'Growth Stage',
    impact: 'On Track',
    status: `${Math.round((cycleDays - daysRemaining) / cycleDays * 100)}% complete`
  });

  return {
    expectedDate,
    daysRemaining,
    estimatedYield: Math.round(estimatedYield * 10) / 10,
    qualityGrade,
    marketValue: Math.round(marketValue),
    confidence: Math.min(95, Math.max(50, confidence)),
    factors
  };
};

export const HarvestPredictor = ({ 
  cropType, 
  plantingDate, 
  fieldArea, 
  weather, 
  soilData 
}: HarvestPredictorProps) => {
  const { language } = useLanguage();
  
  // Use a default planting date if not provided
  const defaultPlantingDate = new Date();
  defaultPlantingDate.setDate(defaultPlantingDate.getDate() - 60);
  
  const prediction = predictHarvest(
    cropType, 
    plantingDate || defaultPlantingDate, 
    fieldArea, 
    weather, 
    soilData
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 gradient-primary rounded-lg shadow-glow">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              <TranslatedText text="Harvest Prediction" targetLanguage={language} />
            </h3>
            <p className="text-sm text-muted-foreground">{cropType}</p>
          </div>
        </div>
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          {prediction.confidence}% <TranslatedText text="Confidence" targetLanguage={language} />
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground">
              <TranslatedText text="Expected Harvest" targetLanguage={language} />
            </span>
          </div>
          <p className="text-sm font-bold">{formatDate(prediction.expectedDate)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {prediction.daysRemaining} <TranslatedText text="days remaining" targetLanguage={language} />
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-muted-foreground">
              <TranslatedText text="Estimated Yield" targetLanguage={language} />
            </span>
          </div>
          <p className="text-lg font-bold">{prediction.estimatedYield} <TranslatedText text="tons" targetLanguage={language} /></p>
          <p className="text-xs text-muted-foreground mt-1">{prediction.qualityGrade}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-muted-foreground">
              <TranslatedText text="Market Value" targetLanguage={language} />
            </span>
          </div>
          <p className="text-sm font-bold">{formatCurrency(prediction.marketValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            <TranslatedText text="Estimated revenue" targetLanguage={language} />
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-medium text-muted-foreground">
              <TranslatedText text="Progress" targetLanguage={language} />
            </span>
          </div>
          <Progress 
            value={(1 - prediction.daysRemaining / 120) * 100} 
            className="h-2 mt-2" 
          />
          <p className="text-xs text-muted-foreground mt-2">
            {Math.round((1 - prediction.daysRemaining / 120) * 100)}% <TranslatedText text="complete" targetLanguage={language} />
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm">
          <TranslatedText text="Key Factors" targetLanguage={language} />
        </h4>
        <div className="space-y-2">
          {prediction.factors.map((factor, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-sm">{factor.name}</p>
                <p className="text-xs text-muted-foreground">
                  <TranslatedText text={factor.status} targetLanguage={language} />
                </p>
              </div>
              <Badge 
                variant={
                  factor.impact === 'Positive' ? 'default' : 
                  factor.impact === 'Negative' ? 'destructive' : 
                  'secondary'
                }
              >
                {factor.impact}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};