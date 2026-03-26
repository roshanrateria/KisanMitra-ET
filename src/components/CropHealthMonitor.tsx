import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Leaf, Droplet, Bug, AlertTriangle, CheckCircle } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';

interface CropHealthData {
  overallHealth: number;
  diseases: { name: string; severity: string; treatment: string }[];
  pests: { name: string; severity: string; treatment: string }[];
  nutrientDeficiency: { nutrient: string; level: string }[];
  recommendations: string[];
}

interface CropHealthMonitorProps {
  cropType: string;
  soilData: any;
  weather: any;
}

const analyzeCropHealth = (cropType: string, soilData: any, weather: any): CropHealthData => {
  const health: CropHealthData = {
    overallHealth: 75,
    diseases: [],
    pests: [],
    nutrientDeficiency: [],
    recommendations: []
  };

  // Analyze based on weather
  if (weather?.humidity > 80) {
    health.diseases.push({
      name: 'Fungal Leaf Spot',
      severity: 'Medium',
      treatment: 'Apply neem oil spray or copper-based fungicide'
    });
    health.overallHealth -= 10;
  }

  if (weather?.temp > 35) {
    health.pests.push({
      name: 'Aphids',
      severity: 'Low',
      treatment: 'Use insecticidal soap or neem oil'
    });
    health.recommendations.push('Provide shade during peak sun hours');
  }

  // Analyze soil nutrients
  if (soilData?.properties?.nitrogen) {
    const nitrogenValue = soilData.properties.nitrogen.layers[0].values.mean;
    if (nitrogenValue < 500) {
      health.nutrientDeficiency.push({
        nutrient: 'Nitrogen',
        level: 'Low'
      });
      health.recommendations.push('Apply organic compost or green manure');
      health.overallHealth -= 5;
    }
  }

  // Crop-specific recommendations
  if (cropType.toLowerCase().includes('rice')) {
    health.recommendations.push('Monitor for brown plant hopper in humid conditions');
    health.recommendations.push('Maintain water level at 5-7cm during vegetative stage');
  } else if (cropType.toLowerCase().includes('wheat')) {
    health.recommendations.push('Scout for rust diseases during flowering');
    health.recommendations.push('Ensure proper drainage to prevent root rot');
  }

  return health;
};

export const CropHealthMonitor = ({ cropType, soilData, weather }: CropHealthMonitorProps) => {
  const { language } = useLanguage();
  const healthData = analyzeCropHealth(cropType, soilData, weather);

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-600';
    if (health >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthStatus = (health: number) => {
    if (health >= 80) return 'Excellent';
    if (health >= 60) return 'Good';
    return 'Needs Attention';
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <Leaf className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              <TranslatedText text="Crop Health Monitor" targetLanguage={language} />
            </h3>
            <p className="text-sm text-muted-foreground">{cropType}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${getHealthColor(healthData.overallHealth)}`}>
            {healthData.overallHealth}%
          </p>
          <p className="text-sm text-muted-foreground">
            <TranslatedText text={getHealthStatus(healthData.overallHealth)} targetLanguage={language} />
          </p>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">
            <TranslatedText text="Overall Health Score" targetLanguage={language} />
          </span>
        </div>
        <Progress value={healthData.overallHealth} className="h-3" />
      </div>

      {healthData.diseases.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <TranslatedText text="Disease Alerts" targetLanguage={language} />
          </h4>
          {healthData.diseases.map((disease, idx) => (
            <Alert key={idx} className="bg-orange-50 dark:bg-orange-950 border-orange-200">
              <AlertDescription>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{disease.name}</span>
                  <Badge variant={disease.severity === 'High' ? 'destructive' : 'secondary'}>
                    {disease.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <TranslatedText text={disease.treatment} targetLanguage={language} />
                </p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {healthData.pests.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Bug className="w-4 h-4 text-red-600" />
            <TranslatedText text="Pest Alerts" targetLanguage={language} />
          </h4>
          {healthData.pests.map((pest, idx) => (
            <Alert key={idx} className="bg-red-50 dark:bg-red-950 border-red-200">
              <AlertDescription>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{pest.name}</span>
                  <Badge variant={pest.severity === 'High' ? 'destructive' : 'secondary'}>
                    {pest.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <TranslatedText text={pest.treatment} targetLanguage={language} />
                </p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {healthData.nutrientDeficiency.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Droplet className="w-4 h-4 text-blue-600" />
            <TranslatedText text="Nutrient Status" targetLanguage={language} />
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {healthData.nutrientDeficiency.map((deficiency, idx) => (
              <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
                <p className="font-medium text-sm">{deficiency.nutrient}</p>
                <Badge variant="outline" className="mt-1">
                  {deficiency.level}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {healthData.recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <TranslatedText text="Recommendations" targetLanguage={language} />
          </h4>
          <ul className="space-y-2">
            {healthData.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-green-600 mt-0.5">•</span>
                <span>
                  <TranslatedText text={rec} targetLanguage={language} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};