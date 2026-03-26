import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sprout, Droplets, Bug, Scissors, CheckCircle2, Plus, Clock } from 'lucide-react';
import { useState } from 'react';

interface Task {
  title: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  timing?: string;
}

interface AITaskListProps {
  tasks: Task[];
  isLoading: boolean;
  onAddTask?: (task: Task) => void;
}

const categoryIcons: Record<string, any> = {
  irrigation: Droplets,
  fertilization: Sprout,
  pest_control: Bug,
  harvesting: Scissors,
  planting: Sprout,
  general: CheckCircle2,
};

const priorityColors: Record<string, string> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'default',
};

export const AITaskList = ({ tasks, isLoading, onAddTask }: AITaskListProps) => {
  const { language } = useLanguage();
  const [added, setAdded] = useState<Set<number>>(new Set());

  const handleAdd = (task: Task, idx: number) => {
    onAddTask?.(task);
    setAdded(prev => new Set(prev).add(idx));
  };

  if (isLoading) {
    return (
      <Card className="p-8 rounded-[2rem] border-0 shadow-soft bg-surface-lowest">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-surface-container rounded-2xl" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-[2rem] shadow-soft border-0 bg-surface-lowest relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
      <h3 className="text-xl font-heading font-semibold mb-4 flex items-center gap-3 relative z-10">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Sprout className="w-6 h-6" />
        </div>
        <TranslatedText text="AI Suggestions" targetLanguage={language} />
      </h3>

      <div className="space-y-3 relative z-10">
        {tasks.map((task, idx) => {
          const Icon = categoryIcons[task.category] || CheckCircle2;
          const isAdded = added.has(idx);

          return (
            <div
              key={idx}
              className="p-4 bg-surface-container-low/50 rounded-2xl border border-outline-variant/5 hover:bg-surface-lowest hover:shadow-soft transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white dark:bg-surface-high rounded-xl shadow-sm text-primary shrink-0 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <TranslatedText
                      text={task.title}
                      targetLanguage={language}
                      className="font-heading font-bold text-foreground leading-tight text-sm"
                    />
                    <Badge variant={priorityColors[task.priority] as any} className="rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider text-[9px] shrink-0">
                      <TranslatedText text={task.priority} targetLanguage={language} />
                    </Badge>
                  </div>
                  <TranslatedText
                    text={task.description}
                    targetLanguage={language}
                    className="text-xs text-muted-foreground leading-relaxed"
                  />
                  {task.timing && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="w-3 h-3 text-primary/60" />
                      <span className="text-[11px] text-primary/80 font-medium">{task.timing}</span>
                    </div>
                  )}
                </div>
              </div>
              {onAddTask && (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant={isAdded ? 'secondary' : 'outline'}
                    className="h-7 text-xs rounded-full px-3 gap-1"
                    disabled={isAdded}
                    onClick={() => handleAdd(task, idx)}
                  >
                    {isAdded ? (
                      <><CheckCircle2 className="w-3 h-3" /> Added</>
                    ) : (
                      <><Plus className="w-3 h-3" /> Add to Tasks</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
