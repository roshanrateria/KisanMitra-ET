import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CheckCircle2, Circle, Droplets, Sprout, Bug, Scissors,
  Plus, Trash2, AlertTriangle, CloudRain, Wind, Thermometer, Clock
} from 'lucide-react';
import { FarmerTask } from '@/lib/storage';
import { IrrigationScheduler } from './IrrigationScheduler';

interface TasksTabProps {
  tasks: FarmerTask[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (task: Omit<FarmerTask, 'id' | 'createdAt'>) => void;
  fields: any[];
  weather: any;
  forecast: any;
}

const categoryIcons: Record<string, any> = {
  irrigation: Droplets,
  fertilization: Sprout,
  pest_control: Bug,
  harvesting: Scissors,
  planting: Sprout,
  weather: AlertTriangle,
  manual: CheckCircle2,
  general: CheckCircle2,
};

const sourceColors: Record<string, string> = {
  ai: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  irrigation: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  weather: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  manual: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const getWeatherAlerts = (weather: any, forecast: any): Omit<FarmerTask, 'id' | 'createdAt'>[] => {
  const alerts: Omit<FarmerTask, 'id' | 'createdAt'>[] = [];
  if (!weather && !forecast) return alerts;

  const temp = weather?.main?.temp;
  const humidity = weather?.main?.humidity;
  const wind = weather?.wind?.speed;

  if (temp > 38) alerts.push({
    title: 'Extreme Heat Alert',
    description: `Temperature is ${Math.round(temp)}°C. Water crops early morning (5-7am) to reduce evaporation stress.`,
    category: 'weather', priority: 'high', done: false, source: 'weather',
    timing: 'Today — act before 7am',
  });

  if (humidity > 80) alerts.push({
    title: 'High Humidity — Fungal Risk',
    description: `Humidity at ${humidity}%. Inspect crops for fungal disease. Improve air circulation if possible.`,
    category: 'pest_control', priority: 'medium', done: false, source: 'weather',
  });

  if (wind > 8) alerts.push({
    title: 'High Wind — Avoid Spraying',
    description: `Wind speed ${wind} m/s. Postpone pesticide/fertilizer spraying to avoid drift and waste.`,
    category: 'pest_control', priority: 'medium', done: false, source: 'weather',
  });

  // Forecast-based alerts
  const rainDays = forecast?.daily?.filter((d: any) => d.rainMm > 5) || [];
  if (rainDays.length > 0) {
    const nextRain = rainDays[0];
    alerts.push({
      title: 'Rain Expected — Delay Fertilizer',
      description: `${nextRain.rainMm}mm rain forecast on ${nextRain.date}. Hold off on fertilizer application to prevent runoff.`,
      category: 'fertilization', priority: 'high', done: false, source: 'weather',
      timing: `Before ${nextRain.date}`,
    });
  }

  const dryDays = forecast?.daily?.filter((d: any) => d.rainMm === 0) || [];
  if (dryDays.length >= 4) alerts.push({
    title: 'Dry Spell Ahead — Plan Irrigation',
    description: `No rain expected for ${dryDays.length} days. Schedule irrigation to prevent crop stress.`,
    category: 'irrigation', priority: 'high', done: false, source: 'weather',
    timing: 'Next 5 days',
  });

  return alerts;
};

export const TasksTab = ({ tasks, onToggle, onDelete, onAdd, fields, weather, forecast }: TasksTabProps) => {
  const { language } = useLanguage();
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');

  const weatherAlerts = getWeatherAlerts(weather, forecast);

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.done : !t.done
  );

  const pending = tasks.filter(t => !t.done).length;

  const handleAddManual = () => {
    if (!newTitle.trim()) return;
    onAdd({
      title: newTitle.trim(),
      description: '',
      category: 'general',
      priority: 'medium',
      done: false,
      source: 'manual',
    });
    setNewTitle('');
  };

  return (
    <div className="space-y-6 pb-4">

      {/* Weather Alerts Banner */}
      {weatherAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4" />
            <TranslatedText text="Weather Alerts" targetLanguage={language} />
          </h3>
          {weatherAlerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{alert.title}</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">{alert.description}</p>
                {alert.timing && (
                  <p className="text-[11px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{alert.timing}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-full px-2 shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => onAdd({ ...alert })}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Task List */}
      <Card className="p-4 rounded-[2rem] border-0 shadow-soft">
        {/* Header + filter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-lg">
              <TranslatedText text="My Tasks" targetLanguage={language} />
            </h3>
            {pending > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">{pending}</span>
            )}
          </div>
          <div className="flex gap-1">
            {(['pending', 'done', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Add manual task */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add a task..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddManual()}
            className="rounded-xl text-sm h-9"
          />
          <Button size="sm" className="rounded-xl h-9 px-3 shrink-0" onClick={handleAddManual}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Task items */}
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            <TranslatedText text={filter === 'done' ? 'No completed tasks yet' : 'No pending tasks — great work!'} targetLanguage={language} />
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(task => {
              const Icon = categoryIcons[task.category] || CheckCircle2;
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${task.done ? 'opacity-50 bg-muted/30 border-transparent' : 'bg-white dark:bg-stone-900 border-border/20 shadow-sm'}`}
                >
                  <button onClick={() => onToggle(task.id)} className="mt-0.5 shrink-0 text-primary">
                    {task.done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sourceColors[task.source] || sourceColors.manual}`}>
                        {task.source}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>
                    )}
                    {task.timing && (
                      <p className="text-[11px] text-primary/70 font-medium mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{task.timing}
                      </p>
                    )}
                  </div>
                  <button onClick={() => onDelete(task.id)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Irrigation Scheduler */}
      {fields.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-cyan-700 dark:text-cyan-400 flex items-center gap-2 px-1">
            <Droplets className="w-4 h-4" />
            <TranslatedText text="Irrigation Schedule" targetLanguage={language} />
          </h3>
          {fields.map(field => (
            <IrrigationScheduler
              key={field.id}
              cropType={field.crop}
              soilType={field.soilType}
              weather={weather}
              fieldArea={field.area}
            />
          ))}
        </div>
      )}
    </div>
  );
};
