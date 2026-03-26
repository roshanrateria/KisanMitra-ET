import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, Activity, ShoppingCart, Handshake, CalendarClock } from 'lucide-react';
import { getLedgerHistory, LedgerEntry } from '@/lib/ledgerService';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';

export function DigitalLedger() {
    const { language } = useLanguage();
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLedger = async () => {
            setLoading(true);
            const data = await getLedgerHistory();
            setEntries(data);
            setLoading(false);
        };
        fetchLedger();
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'DISEASE_ANALYSIS': return <Activity className="h-5 w-5 text-amber-500" />;
            case 'ONDC_ORDER': return <ShoppingCart className="h-5 w-5 text-blue-500" />;
            case 'NEGOTIATION_ACCEPTED': return <Handshake className="h-5 w-5 text-green-500" />;
            default: return <ShieldCheck className="h-5 w-5 text-slate-500" />;
        }
    };

    return (
        <Card className="shadow-lg border-primary/20 bg-background/50 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                        <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">
                            <TranslatedText text="Digital Ledger" targetLanguage={language} />
                        </CardTitle>
                        <CardDescription>
                            <TranslatedText text="Verifiable history powered by Amazon DynamoDB" targetLanguage={language} />
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[400px] p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 h-full">
                            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Fetching Immutable Ledger...
                            </p>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-10 opacity-50 flex flex-col items-center justify-center h-full">
                            <CalendarClock className="h-12 w-12 mx-auto mb-3" />
                            <p><TranslatedText text="No history recorded yet." targetLanguage={language} /></p>
                            <p className="text-xs mt-1">Use the AI Agents to generate ledger traces.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {entries.map((entry, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-100 bg-white shadow-sm dark:border-indigo-900/50 dark:bg-slate-900 z-10">
                                            {getIcon(entry.type)}
                                        </div>
                                        {i !== entries.length - 1 && (
                                            <div className="w-0.5 h-full bg-border/50 my-1 flex-1"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 pb-6">
                                        <div className="mb-1 flex items-center justify-between">
                                            <h4 className="flex items-end font-semibold text-slate-900 dark:text-slate-100">{entry.title}</h4>
                                            <time className="text-xs font-medium text-muted-foreground whitespace-nowrap pl-4">
                                                {new Date(entry.timestamp).toLocaleString(undefined, {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </time>
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-border/50">
                                            {entry.type === 'DISEASE_ANALYSIS' && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                                                        <TranslatedText text="Disease Detect" targetLanguage={language} />
                                                    </Badge>
                                                    <span className="text-xs">Crop: {entry.details.cropType}</span>
                                                    <span className="text-xs">• Severity: {entry.details.severity}</span>
                                                </div>
                                            )}
                                            {entry.type === 'ONDC_ORDER' && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                                                        <TranslatedText text="ONDC Network" targetLanguage={language} />
                                                    </Badge>
                                                    <span className="text-xs font-mono">ID: {entry.details.orderId}</span>
                                                    <span className="text-xs">• Type: Procurement</span>
                                                </div>
                                            )}
                                            {entry.type === 'NEGOTIATION_ACCEPTED' && (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                                                            <TranslatedText text="Sale Finalized" targetLanguage={language} />
                                                        </Badge>
                                                        <span className="text-xs">{entry.details.quantity} quintals</span>
                                                    </div>
                                                    <p className="text-xs flex items-center gap-1 opacity-80 pt-1 border-t border-border/50 mt-1">
                                                        <span className="font-bold">Final Price: ₹{entry.details.finalPrice}</span> per quintal
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
