import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CloudRain, Wind, Sun, Snowflake, AlertTriangle, Bell } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { WeatherData } from '@/lib/apis';

interface WeatherAlert {
  type: 'warning' | 'advisory' | 'info';
  title: string;
  description: string;
  icon: any;
  action: string;
}

interface WeatherAlertsProps {
  weather: WeatherData | null;
}

const generateWeatherAlerts = (weather: WeatherData | null): WeatherAlert[] => {
  const alerts: WeatherAlert[] = [];

  if (!weather) return alerts;

  // High temperature alert
  if (weather.main?.temp > 40) {
    alerts.push({
      type: 'warning',
      title: 'Extreme Heat Warning',
      description: `Temperature ${weather.main?.temp}°C. High risk of heat stress to crops.`,
      icon: Sun,
      action: 'Increase irrigation frequency and provide shade if possible'
    });
  } else if (weather.main?.temp > 35) {
    alerts.push({
      type: 'advisory',
      title: 'High Temperature Advisory',
      description: `Temperature ${weather.main?.temp}°C. Monitor crops for heat stress.`,
      icon: Sun,
      action: 'Water crops early morning or late evening'
    });
  }

  // Low temperature alert
  if (weather.main?.temp < 10) {
    alerts.push({
      type: 'warning',
      title: 'Cold Weather Warning',
      description: `Temperature ${weather.main?.temp}°C. Risk of frost damage.`,
      icon: Snowflake,
      action: 'Cover sensitive plants and delay irrigation'
    });
  }

  // High wind alert
  if (weather.wind?.speed > 25) {
    alerts.push({
      type: 'warning',
      title: 'Strong Wind Alert',
      description: `Wind speed ${weather.wind?.speed} km/h. Risk of crop lodging.`,
      icon: Wind,
      action: 'Secure loose structures and delay spraying operations'
    });
  } else if (weather.wind?.speed > 15) {
    alerts.push({
      type: 'advisory',
      title: 'Moderate Wind Advisory',
      description: `Wind speed ${weather.wind?.speed} km/h.`,
      icon: Wind,
      action: 'Avoid pesticide spraying to prevent drift'
    });
  }

  // High humidity alert
  if (weather.main?.humidity > 85) {
    alerts.push({
      type: 'advisory',
      title: 'High Humidity Alert',
      description: `Humidity ${weather.main?.humidity}%. Increased disease risk.`,
      icon: CloudRain,
      action: 'Monitor for fungal diseases and ensure good air circulation'
    });
  }

  // Rain probability (mock - would use forecast API in production)
  const rainProbability = Math.random();
  if (rainProbability > 0.7 && weather.clouds?.all > 70) {
    alerts.push({
      type: 'info',
      title: 'Rain Expected',
      description: 'Heavy cloud cover indicates possible rainfall in next 24 hours.',
      icon: CloudRain,
      action: 'Delay irrigation and fertilizer application'
    });
  }

  return alerts;
};

export const WeatherAlerts = ({ weather }: WeatherAlertsProps) => {
  const { language } = useLanguage();
  const alerts = generateWeatherAlerts(weather);

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-red-50 dark:bg-red-950 border-red-300';
      case 'advisory': return 'bg-orange-50 dark:bg-orange-950 border-orange-300';
      case 'info': return 'bg-blue-50 dark:bg-blue-950 border-blue-300';
      default: return 'bg-muted';
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'warning': return 'destructive';
      case 'advisory': return 'default';
      case 'info': return 'secondary';
      default: return 'outline';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold">
            <TranslatedText text="Weather Alerts" targetLanguage={language} />
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          <TranslatedText text="No active weather alerts. Conditions are favorable for farming operations." targetLanguage={language} />
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold">
            <TranslatedText text="Weather Alerts" targetLanguage={language} />
          </h3>
        </div>
        <Badge variant="outline">{alerts.length} <TranslatedText text="Active" targetLanguage={language} /></Badge>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, idx) => {
          const Icon = alert.icon;
          return (
            <Alert key={idx} className={getAlertColor(alert.type)}>
              <AlertDescription>
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">
                        <TranslatedText text={alert.title} targetLanguage={language} />
                      </h4>
                      <Badge variant={getBadgeVariant(alert.type)}>
                        {alert.type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm mb-2">
                      <TranslatedText text={alert.description} targetLanguage={language} />
                    </p>
                    <p className="text-sm font-medium text-primary">
                      <span className="font-semibold">
                        <TranslatedText text="Action:" targetLanguage={language} />
                      </span>{' '}
                      <TranslatedText text={alert.action} targetLanguage={language} />
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </div>
    </Card>
  );
};