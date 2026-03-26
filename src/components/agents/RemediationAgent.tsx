import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { AgentActivityLog } from './AgentActivityLog';
import { GuardrailSummary, EscalationAlert, AuditTrailViewer } from './ComplianceGuardrails';
import { analyzeDisease, AgentThought } from '@/lib/agents/groqClient';
import {
    runRemediationGuardrails,
    checkSeverityEscalation,
    type GuardrailResult,
} from '@/lib/agents/guardrails';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
    searchTreatments,
    selectItem,
    confirmOrder,
    saveOrder,
    ONDCProvider,
    ONDCItem,
    ONDCOrder,
} from '@/lib/agents/ondcService';
import {
    Bot, Pill, ShoppingCart, CheckCircle2, Loader2, AlertTriangle,
    ArrowRight, Package, MapPin, Star, IndianRupee, Truck, ShieldCheck
} from 'lucide-react';

interface RemediationAgentProps {
    diseases?: Array<{ class_name: string; confidence: number }>;
    cropType?: string;
    location?: { lat: number; lng: number };
    imageUrl?: string;
}

type AgentStep = 'idle' | 'analyzing' | 'searching' | 'results' | 'ordering' | 'confirmed' | 'error';

export function RemediationAgent({ diseases, cropType = 'General Crop', location, imageUrl }: RemediationAgentProps) {
    const { language } = useLanguage();

    const isOnline = useOnlineStatus();

    const [step, setStep] = useState<AgentStep>('idle');
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);
    const [treatmentPlan, setTreatmentPlan] = useState<any>(null);
    const [ondcResults, setOndcResults] = useState<ONDCProvider[]>([]);
    const [transactionId, setTransactionId] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<{ provider: ONDCProvider; item: ONDCItem } | null>(null);
    const [confirmedOrder, setConfirmedOrder] = useState<ONDCOrder | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guardrailResults, setGuardrailResults] = useState<GuardrailResult[]>([]);
    const [severityGuardrail, setSeverityGuardrail] = useState<GuardrailResult | null>(null);

    const runRemediationAgent = useCallback(async () => {
        if (!diseases || diseases.length === 0) return;
        setStep('analyzing');
        setError(null);
        setThoughts([]);
        setTreatmentPlan(null);
        setOndcResults([]);
        setConfirmedOrder(null);
        setGuardrailResults([]);
        setSeverityGuardrail(null);

        // ── Run compliance guardrails BEFORE any agent action ──
        const { passed, results, blockers } = runRemediationGuardrails({
            diseases,
            cropType,
            location,
            isOnline,
        });
        setGuardrailResults(results);

        if (!passed) {
            setStep('error');
            setError(blockers[0]?.message || 'Guardrail check failed.');
            return;
        }

        try {
            // Step 1: Analyze diseases with Groq LLM
            const analysis = await analyzeDisease(diseases, cropType, location, imageUrl);
            setTreatmentPlan(analysis.result);
            setThoughts([...analysis.thoughts]);

            // ── Post-analysis severity guardrail ──
            const severity = analysis.result.analysis?.severity || 'low';
            const urgency = analysis.result.analysis?.urgency || 'monitoring';
            const sevGuardrail = checkSeverityEscalation(severity, urgency, cropType);
            setSeverityGuardrail(sevGuardrail);

            // Step 2: Search ONDC for treatments
            setStep('searching');
            const searchQuery =
                analysis.result.treatments?.[0]?.ondc_search_query ||
                analysis.result.treatments?.[0]?.treatment_name ||
                'fungicide';

            const searchResults = await searchTreatments(searchQuery, location);
            setTransactionId(searchResults.transaction_id);
            setOndcResults(searchResults.providers);

            setThoughts(prev => [
                ...prev,
                {
                    step: prev.length + 1,
                    type: 'observing' as const,
                    title: 'ONDC Search Complete',
                    content: `Found ${searchResults.providers.length} suppliers with ${searchResults.providers.reduce((sum, p) => sum + p.items.length, 0)} products on ONDC network.`,
                    timestamp: Date.now(),
                },
            ]);

            setStep('results');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Agent encountered an error');
            setStep('error');
        }
    }, [diseases, cropType, location, imageUrl, isOnline]);

    const handleSelectProduct = useCallback((provider: ONDCProvider, item: ONDCItem) => {
        setSelectedItem({ provider, item });
    }, []);

    const handlePlaceOrder = useCallback(async () => {
        if (!selectedItem) return;

        setStep('ordering');
        try {
            // Select item on ONDC
            await selectItem(
                transactionId,
                selectedItem.provider.id,
                selectedItem.item.id,
                1
            );

            // Confirm order
            const order = await confirmOrder(
                transactionId,
                selectedItem.provider.id,
                selectedItem.item.id,
                1,
                'ON-FULFILLMENT'
            );

            // Attach names for display
            order.provider.name = selectedItem.provider.name;
            order.items = [selectedItem.item];
            order.total_amount = parseFloat(selectedItem.item.price.value);

            saveOrder(order);
            setConfirmedOrder(order);

            setThoughts(prev => [
                ...prev,
                {
                    step: prev.length + 1,
                    type: 'complete' as const,
                    title: '✅ Order Confirmed via ONDC',
                    content: `Order ${order.order_id} placed with ${selectedItem.provider.name} for ₹${selectedItem.item.price.value}. Payment: Cash on Delivery. Delivery expected in 2-3 days.`,
                    timestamp: Date.now(),
                },
            ]);

            setStep('confirmed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Order placement failed');
            setStep('error');
        }
    }, [selectedItem, transactionId]);

    const reset = () => {
        setStep('idle');
        setThoughts([]);
        setTreatmentPlan(null);
        setOndcResults([]);
        setSelectedItem(null);
        setConfirmedOrder(null);
        setError(null);
        setGuardrailResults([]);
        setSeverityGuardrail(null);
    };

    return (
        <Card className="shadow-lg border-green-200/50 dark:border-green-800/30">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">
                                <TranslatedText text="Remediation Agent" targetLanguage={language} />
                            </CardTitle>
                            <CardDescription>
                                <TranslatedText text="AI-powered treatment procurement via ONDC" targetLanguage={language} />
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={step === 'idle' ? 'secondary' : step === 'confirmed' ? 'default' : step === 'error' ? 'destructive' : 'outline'}
                        className={step !== 'idle' && step !== 'confirmed' && step !== 'error' ? 'animate-pulse' : ''}>
                        {step === 'idle' ? '● Idle' :
                            step === 'analyzing' ? '🧠 Analyzing' :
                                step === 'searching' ? '🔍 Searching ONDC' :
                                    step === 'results' ? '📋 Results Ready' :
                                        step === 'ordering' ? '📦 Placing Order' :
                                            step === 'confirmed' ? '✅ Order Placed' :
                                                '❌ Error'}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Compliance Guardrails Summary */}
                {guardrailResults.length > 0 && (
                    <>
                        <GuardrailSummary results={guardrailResults} title="Pre-Flight Compliance Checks" />
                        <Separator />
                    </>
                )}

                {/* Severity Escalation Alert */}
                {severityGuardrail && severityGuardrail.status === 'escalate' && (
                    <>
                        <EscalationAlert result={severityGuardrail} />
                        <Separator />
                    </>
                )}

                {/* Idle State — Show trigger */}
                {step === 'idle' && (
                    <div className="text-center py-6">
                        {diseases && diseases.length > 0 ? (
                            <>
                                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                                    <p className="font-medium text-amber-800 dark:text-amber-200">
                                        <TranslatedText text={`${diseases.length} disease(s) detected in your crop`} targetLanguage={language} />
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                                        {diseases.map((d, i) => (
                                            <Badge key={i} variant="outline" className="text-amber-700 border-amber-300">
                                                {d.class_name} ({(d.confidence * 100).toFixed(0)}%)
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <Button size="lg" onClick={runRemediationAgent} className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                                    <Bot className="h-5 w-5" />
                                    <TranslatedText text="Activate Remediation Agent" targetLanguage={language} />
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                                <p className="text-xs text-muted-foreground mt-2">
                                    <TranslatedText text="Agent will analyze diseases, find treatments on ONDC, and help you order" targetLanguage={language} />
                                </p>
                            </>
                        ) : (
                            <div className="text-muted-foreground">
                                <Pill className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p><TranslatedText text="No diseases detected yet. Run disease detection first to activate this agent." targetLanguage={language} /></p>
                            </div>
                        )}
                    </div>
                )}

                {/* Processing States */}
                {(step === 'analyzing' || step === 'searching') && (
                    <div className="text-center py-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-3" />
                        <p className="font-medium">
                            {step === 'analyzing' && <TranslatedText text="Agent is analyzing diseases and formulating treatment plan..." targetLanguage={language} />}
                            {step === 'searching' && <TranslatedText text="Searching ONDC network for treatment suppliers..." targetLanguage={language} />}
                        </p>
                    </div>
                )}

                {/* Chain of Thought */}
                {thoughts.length > 0 && (
                    <>
                        <Separator />
                        <AgentActivityLog thoughts={thoughts} isLive={step === 'analyzing' || step === 'searching'} />
                    </>
                )}

                {/* Treatment Plan */}
                {treatmentPlan && step !== 'idle' && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Pill className="h-4 w-4 text-green-600" />
                                <TranslatedText text="AI Treatment Plan" targetLanguage={language} />
                            </h4>
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant={treatmentPlan.analysis?.severity === 'critical' ? 'destructive' :
                                        treatmentPlan.analysis?.severity === 'high' ? 'destructive' : 'secondary'}>
                                        {treatmentPlan.analysis?.severity?.toUpperCase()} severity
                                    </Badge>
                                    <Badge variant="outline">
                                        {treatmentPlan.analysis?.urgency?.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <p className="text-sm">{treatmentPlan.analysis?.summary}</p>
                            </div>

                            {treatmentPlan.treatments?.map((t: any, i: number) => (
                                <div key={i} className="mt-2 p-3 bg-muted/50 rounded-lg">
                                    <p className="font-medium text-sm">{t.treatment_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t.type} · {t.dosage} · {t.application_method}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        <TranslatedText text={`Est. cost: ₹${t.estimated_cost_inr}`} targetLanguage={language} />
                                    </p>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ONDC Results */}
                {ondcResults.length > 0 && (step === 'results' || step === 'ordering' || step === 'confirmed') && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-blue-600" />
                                <TranslatedText text="ONDC Marketplace — Available Treatments" targetLanguage={language} />
                                <Badge variant="outline" className="ml-auto text-xs">
                                    {ondcResults.reduce((sum, p) => sum + p.items.length, 0)} products
                                </Badge>
                            </h4>

                            <div className="space-y-3">
                                {ondcResults.map((provider) => (
                                    <div key={provider.id} className="border rounded-xl p-3 space-y-2">
                                        {/* Provider header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium text-sm">{provider.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {provider.rating && (
                                                    <span className="flex items-center gap-0.5">
                                                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                                        {provider.rating}
                                                    </span>
                                                )}
                                                {provider.location && (
                                                    <span className="flex items-center gap-0.5">
                                                        <MapPin className="h-3 w-3" />
                                                        {provider.location.city}
                                                    </span>
                                                )}
                                            </div>
                                        </div>                                        {/* Items */}
                                        {provider.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer ${selectedItem?.item.id === item.id
                                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                        : 'border-muted hover:bg-muted/50 hover:border-primary/40'
                                                    }`}
                                                onClick={() => handleSelectProduct(provider, item)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{item.name}</p>
                                                    {item.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                                                    )}
                                                    {item.fulfillment && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                                            <Truck className="h-3 w-3" /> {item.fulfillment.estimated_delivery}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-green-600 flex items-center justify-end">
                                                            <IndianRupee className="h-3 w-3" />{item.price.value}
                                                        </p>
                                                        {item.quantity && (
                                                            <p className="text-[10px] text-muted-foreground">{item.quantity.available} in stock</p>
                                                        )}
                                                    </div>
                                                    {step === 'results' && (
                                                        <Button
                                                            size="sm"
                                                            className="h-7 px-2 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectProduct(provider, item);
                                                                // Auto-trigger order if already selected
                                                                if (selectedItem?.item.id === item.id) {
                                                                    handlePlaceOrder();
                                                                }
                                                            }}
                                                        >
                                                            <ShoppingCart className="h-3 w-3" />
                                                            {selectedItem?.item.id === item.id ? 'Buy Now' : 'Select'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Order button */}
                            {selectedItem && step === 'results' && (
                                <Button
                                    className="w-full mt-3 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                    size="lg"
                                    onClick={handlePlaceOrder}
                                >
                                    <ShoppingCart className="h-5 w-5" />
                                    <TranslatedText
                                        text={`Order ${selectedItem.item.name} — ₹${selectedItem.item.price.value}`}
                                        targetLanguage={language}
                                    />
                                </Button>
                            )}
                        </div>
                    </>
                )}

                {/* Ordering State */}
                {step === 'ordering' && (
                    <div className="text-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-sm font-medium">
                            <TranslatedText text="Placing order via ONDC network..." targetLanguage={language} />
                        </p>
                    </div>
                )}

                {/* Order Confirmed */}
                {confirmedOrder && step === 'confirmed' && (
                    <>
                        <Separator />
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800/30 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                            <h4 className="font-bold text-lg text-green-800 dark:text-green-200">
                                <TranslatedText text="Order Confirmed!" targetLanguage={language} />
                            </h4>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                <TranslatedText text={`Order ID: ${confirmedOrder.order_id}`} targetLanguage={language} />
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                <TranslatedText text={`Total: ₹${confirmedOrder.total_amount} · ${confirmedOrder.fulfillment_status}`} targetLanguage={language} />
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                <TranslatedText text="Payment: Cash on Delivery · Transaction via ONDC Network" targetLanguage={language} />
                            </p>
                        </div>
                    </>
                )}

                {/* Error State */}
                {step === 'error' && error && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/30">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={reset}>
                            <TranslatedText text="Try Again" targetLanguage={language} />
                        </Button>
                    </div>
                )}

                {/* Reset */}
                {(step === 'confirmed' || step === 'error') && (
                    <Button variant="outline" className="w-full" onClick={reset}>
                        <TranslatedText text="Start New Remediation" targetLanguage={language} />
                    </Button>
                )}

                {/* Audit Trail */}
                <Separator />
                <AuditTrailViewer />
            </CardContent>
        </Card>
    );
}
