import { AgentThought } from '@/lib/agents/groqClient';
import { Brain, Zap, Eye, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';

interface AgentActivityLogProps {
    thoughts: AgentThought[];
    isLive?: boolean;
}

const iconMap: Record<AgentThought['type'], React.ReactNode> = {
    thinking: <Brain className="h-4 w-4 text-blue-500 animate-pulse" />,
    acting: <Zap className="h-4 w-4 text-amber-500 animate-pulse" />,
    observing: <Eye className="h-4 w-4 text-purple-500" />,
    deciding: <HelpCircle className="h-4 w-4 text-cyan-500" />,
    complete: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
};

const bgMap: Record<AgentThought['type'], string> = {
    thinking: 'border-l-blue-500 bg-blue-500/5',
    acting: 'border-l-amber-500 bg-amber-500/5',
    observing: 'border-l-purple-500 bg-purple-500/5',
    deciding: 'border-l-cyan-500 bg-cyan-500/5',
    complete: 'border-l-green-500 bg-green-500/5',
    error: 'border-l-red-500 bg-red-500/5',
};

export function AgentActivityLog({ thoughts, isLive }: AgentActivityLogProps) {
    const { language } = useLanguage();

    if (thoughts.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">
                    <TranslatedText text="Agent Chain of Thought" targetLanguage={language} />
                </h4>
                {isLive && (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Live
                    </span>
                )}
            </div>

            <div className="space-y-1.5">
                {thoughts.map((thought, index) => (
                    <div
                        key={index}
                        className={`border-l-2 pl-3 py-2 pr-3 rounded-r-lg transition-all duration-300 ${bgMap[thought.type]}`}
                        style={{
                            animationDelay: `${index * 150}ms`,
                        }}
                    >
                        <div className="flex items-center gap-2 mb-0.5">
                            {iconMap[thought.type]}
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Step {thought.step} · {thought.type}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                                {new Date(thought.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <p className="text-sm font-medium">{thought.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{thought.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
