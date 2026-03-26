import { Card } from '@/components/ui/card';
import { Cloud, Droplets, Wind, Eye } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { WeatherData } from '@/lib/apis';

interface WeatherCardProps {
  weather: WeatherData | null;
  isLoading: boolean;
}

export const WeatherCard = ({ weather, isLoading }: WeatherCardProps) => {
  const { language } = useLanguage();

  if (isLoading) {
    return (
      <Card className="p-8 rounded-[2rem] animate-pulse">
        <div className="h-40 bg-muted rounded-2xl" />
      </Card>
    );
  }

  if (!weather) {
    return (
      <Card className="p-8 rounded-[2rem] bg-surface-container shadow-soft border-0">
        <TranslatedText text="Weather data unavailable" targetLanguage={language} className="font-medium text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="p-8 rounded-[2rem] bg-gradient-to-b from-sky-100 to-orange-50 dark:from-sky-950 dark:to-orange-950/20 border-0 shadow-elevated hover-lift overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 dark:bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
      <div className="flex items-start justify-between mb-8 relative z-10">
        <div>
          <TranslatedText 
            text="Current Weather" 
            targetLanguage={language}
            className="text-sm text-sky-800/80 dark:text-sky-200/80 font-bold uppercase tracking-widest"
          />
          <div className="text-6xl font-heading font-extrabold mt-3 text-sky-950 dark:text-sky-50 drop-shadow-sm">{Math.round(weather.main.temp)}°C</div>
          <div className="text-sm font-medium text-sky-800/80 dark:text-sky-200/80 mt-1">
            Feels like {Math.round(weather.main.feels_like)}°C
          </div>
          <TranslatedText
            text={weather.weather[0].description}
            targetLanguage={language}
            className="text-base capitalize mt-2 font-semibold text-sky-900 dark:text-sky-100"
          />
        </div>
        <div className="p-2 bg-white/30 dark:bg-white/10 backdrop-blur-md rounded-3xl shadow-sm">
          <img 
            src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`}
            alt="weather icon"
            className="w-24 h-24 drop-shadow-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 pt-6 border-t border-sky-900/10 dark:border-sky-100/10 relative z-10">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500/80" />
            <TranslatedText text="Humidity" targetLanguage={language} className="text-xs font-semibold text-sky-800/70 dark:text-sky-200/70 uppercase tracking-widest" />
          </div>
          <div className="font-heading font-bold text-2xl text-sky-950 dark:text-sky-50">{weather.main.humidity}%</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-sky-600/80" />
            <TranslatedText text="Wind" targetLanguage={language} className="text-xs font-semibold text-sky-800/70 dark:text-sky-200/70 uppercase tracking-widest" />
          </div>
          <div className="font-heading font-bold text-2xl text-sky-950 dark:text-sky-50">{weather.wind.speed} <span className="text-base font-normal">m/s</span></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-600/70 dark:text-amber-400/70" />
            <TranslatedText text="Pressure" targetLanguage={language} className="text-xs font-semibold text-sky-800/70 dark:text-sky-200/70 uppercase tracking-widest" />
          </div>
          <div className="font-heading font-bold text-2xl text-sky-950 dark:text-sky-50">{weather.main.pressure} <span className="text-base font-normal">hPa</span></div>
        </div>
      </div>
      
      {weather.name && (
        <div className="mt-6 pt-4 border-t border-sky-900/10 dark:border-sky-100/10 text-xs text-sky-800/80 dark:text-sky-200/80 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <TranslatedText text="Location:" targetLanguage={language} className="uppercase tracking-widest font-semibold" />
            <span className="font-bold">{weather.name}</span>
          </div>
        </div>
      )}
    </Card>
  );
};
