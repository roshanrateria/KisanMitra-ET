import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Droplets, Calendar, Clock, TrendingDown, AlertCircle } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';

interface IrrigationSchedule {
  nextIrrigation: Date;
  waterAmount: number; // in mm
  frequency: string;
  method: string;
  urgency: 'low' | 'medium' | 'high';
  recommendations: string[];
}

interface IrrigationSchedulerProps {
  cropType: string;
  soilType: string;
  weather: any;
  fieldArea: number;
}

const calculateIrrigationSchedule = (
  cropType: string,
  soilType: string,
  weather: any,
  fieldArea: number
): IrrigationSchedule => {
  const schedule: IrrigationSchedule = {
    nextIrrigation: new Date(),
    waterAmount: 25,
    frequency: '3-4 days',
    method: 'Drip Irrigation',
    urgency: 'medium',
    recommendations: []
  };

  // Adjust based on soil type
  if (soilType.toLowerCase().includes('sandy')) {
    schedule.waterAmount = 20;
    schedule.frequency = '2-3 days';
    schedule.recommendations.push('Sandy soil requires frequent watering with less volume');
  } else if (soilType.toLowerCase().includes('clay')) {
    schedule.waterAmount = 35;
    schedule.frequency = '5-7 days';
    schedule.recommendations.push('Clay soil retains water longer, reduce frequency');
  }

  // Adjust based on weather
  if (weather) {
    if (weather.temp > 35) {
      schedule.waterAmount += 10;
      schedule.urgency = 'high';
      schedule.recommendations.push('High temperature increases evaporation - water early morning');
    }

    if (weather.humidity > 70) {
      schedule.waterAmount -= 5;
      schedule.recommendations.push('High humidity reduces water needs');
    }

    // Check for upcoming rain (mock for now)
    const rainProbability = Math.random() > 0.7;
    if (rainProbability) {
      schedule.recommendations.push('Rain expected soon - delay irrigation if possible');
      schedule.urgency = 'low';
    }
  }

  // Crop-specific adjustments
  if (cropType.toLowerCase().includes('rice')) {
    schedule.method = 'Flood Irrigation';
    schedule.waterAmount = 50;
    schedule.recommendations.push('Maintain 5-7cm standing water during vegetative stage');
  } else if (cropType.toLowerCase().includes('cotton')) {
    schedule.method = 'Drip Irrigation';
    schedule.recommendations.push('Cotton is drought-resistant, avoid over-watering');
  } else if (cropType.toLowerCase().includes('wheat')) {
    schedule.recommendations.push('Critical irrigation at crown root initiation, tillering, and grain filling');
  }

  // Calculate next irrigation date
  const daysUntilNext = parseInt(schedule.frequency.split('-')[0]);
  schedule.nextIrrigation.setDate(schedule.nextIrrigation.getDate() + daysUntilNext);

  // Calculate total water needed
  const totalLiters = (schedule.waterAmount * fieldArea * 4046.86).toFixed(0);
  schedule.recommendations.push(`Estimated water needed: ${totalLiters} liters`);

  return schedule;
};

export const IrrigationScheduler = ({ cropType, soilType, weather, fieldArea }: IrrigationSchedulerProps) => {
  const { language } = useLanguage();
  const schedule = calculateIrrigationSchedule(cropType, soilType, weather, fieldArea);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Droplets className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              <TranslatedText text="Irrigation Scheduler" targetLanguage={language} />
            </h3>
            <p className="text-sm text-muted-foreground">{cropType}</p>
          </div>
        </div>
        <Badge variant={getUrgencyColor(schedule.urgency)}>
          <TranslatedText text={schedule.urgency.toUpperCase()} targetLanguage={language} />
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-muted-foreground">
              <TranslatedText text="Next Irrigation" targetLanguage={language} />
            </span>
          </div>
          <p className="text-lg font-bold">{formatDate(schedule.nextIrrigation)}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-muted-foreground">
              <TranslatedText text="Water Amount" targetLanguage={language} />
            </span>
          </div>
          <p className="text-lg font-bold">{schedule.waterAmount} mm</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-muted-foreground">
              <TranslatedText text="Frequency" targetLanguage={language} />
            </span>
          </div>
          <p className="text-lg font-bold">
            <TranslatedText text={`Every ${schedule.frequency}`} targetLanguage={language} />
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-muted-foreground">
              <TranslatedText text="Method" targetLanguage={language} />
            </span>
          </div>
          <p className="text-lg font-bold">
            <TranslatedText text={schedule.method} targetLanguage={language} />
          </p>
        </div>
      </div>

      {schedule.recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <TranslatedText text="Irrigation Tips" targetLanguage={language} />
          </h4>
          <ul className="space-y-2">
            {schedule.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>
                  <TranslatedText text={rec} targetLanguage={language} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button className="w-full">
        <Calendar className="w-4 h-4 mr-2" />
        <TranslatedText text="Set Reminder" targetLanguage={language} />
      </Button>
    </Card>
  );
};