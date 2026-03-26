import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { AgentActivityLog } from './AgentActivityLog';
import { GuardrailSummary, AuditTrailViewer, EscalationAlert } from './ComplianceGuardrails';
import { analyzeMarket, negotiateOffer, AgentThought } from '@/lib/agents/groqClient';
import { searchBuyers, ONDCProvider } from '@/lib/agents/ondcService';
import {
    checkConnectivity, checkNegotiationFloor, sanitizeTextInput,
    runNegotiationGuardrails, checkCounterOfferDirection, checkDealAcceptanceThreshold,
    checkMarketPriceDeviation,
    type GuardrailResult,
} from '@/lib/agents/guardrails';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
    Bot, TrendingUp, HandshakeIcon, Loader2, ArrowRight, IndianRupee,
    MapPin, Star, BarChart3, CheckCircle2, XCircle, RefreshCw, ShoppingBag, ShieldCheck
} from 'lucide-react';

interface SalesAgentProps {
    defaultCrop?: string;
    marketPrices?: Array<{ market: string; modalPrice: number }>;
    location?: { lat: number; lng: number };
}

type SalesStep = 'form' | 'analyzing' | 'searching' | 'results' | 'negotiating' | 'deal_done' | 'error';

const CROP_OPTIONS = [
    'Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Maize', 'Bajra', 'Jowar',
    'Mustard', 'Soyabean', 'Onion', 'Tomato', 'Potato', 'Gram', 'Arhar',
];

const QUALITY_OPTIONS = ['Premium (Grade A)', 'Standard (FAQ)', 'Average (Grade B)', 'Mixed'];

interface NegotiationRound {
    round: number;
    buyerId: string;
    buyerName: string;
    buyerOffer: number;
    counterOffer?: number;
    decision?: string;
    message?: string;
}

export function SalesAgent({ defaultCrop, marketPrices, location }: SalesAgentProps) {
    const { language } = useLanguage();

    const isOnline = useOnlineStatus();

    // Form state
    const [crop, setCrop] = useState(defaultCrop || '');
    const [quantity, setQuantity] = useState('10');
    const [quality, setQuality] = useState('Standard (FAQ)');

    // Agent state
    const [step, setStep] = useState<SalesStep>('form');
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);
    const [marketAnalysis, setMarketAnalysis] = useState<any>(null);
    const [buyerResults, setBuyerResults] = useState<ONDCProvider[]>([]);
    const [selectedBuyer, setSelectedBuyer] = useState<ONDCProvider | null>(null);
    const [negotiations, setNegotiations] = useState<NegotiationRound[]>([]);
    const [finalDeal, setFinalDeal] = useState<{ buyer: string; price: number; quantity: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guardrailResults, setGuardrailResults] = useState<GuardrailResult[]>([]);
    const [negotiationGuardrailResults, setNegotiationGuardrailResults] = useState<GuardrailResult[]>([]);
    const [negotiationEscalation, setNegotiationEscalation] = useState<GuardrailResult | null>(null);

    const runSalesAgent = useCallback(async () => {
        if (!crop || !quantity) return;

        setStep('analyzing');
        setError(null);
        setThoughts([]);
        setMarketAnalysis(null);
        setBuyerResults([]);
        setNegotiations([]);
        setFinalDeal(null);
        setGuardrailResults([]);

        // ── Pre-flight guardrails ──
        const checks: GuardrailResult[] = [];
        checks.push(checkConnectivity(isOnline));
        checks.push(sanitizeTextInput(crop, 'Crop Type'));
        const qtyNum = parseFloat(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            checks.push({
                status: 'block',
                code: 'INVALID_QUANTITY',
                message: 'Quantity must be a positive number.',
                auditEntry: { timestamp: new Date().toISOString(), agentType: 'sales', checkName: 'quantity_validation', status: 'block', input: { quantity }, reasoning: 'Invalid quantity value.' },
            });
        }
        setGuardrailResults(checks);
        const blockers = checks.filter(c => c.status === 'block');
        if (blockers.length > 0) {
            setStep('error');
            setError(blockers[0].message);
            return;
        }

        try {
            // Step 1: Market analysis with Groq LLM
            const analysis = await analyzeMarket(
                crop,
                parseFloat(quantity),
                'quintals',
                quality,
                location,
                marketPrices
            );
            setMarketAnalysis(analysis.result);
            setThoughts([...analysis.thoughts]);

            // Step 2: Search ONDC for buyers
            setStep('searching');
            const buyers = await searchBuyers(crop, parseFloat(quantity), 'quintals', location);
            setBuyerResults(buyers.providers);

            setThoughts(prev => [
                ...prev,
                {
                    step: prev.length + 1,
                    type: 'observing' as const,
                    title: 'ONDC Buyer Search Complete',
                    content: `Found ${buyers.providers.length} potential buyers on ONDC network. Analyzing offers...`,
                    timestamp: Date.now(),
                },
            ]);

            setStep('results');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sales agent encountered an error');
            setStep('error');
        }
    }, [crop, quantity, quality, location, marketPrices, isOnline]);

    const startNegotiation = useCallback(async (buyer: ONDCProvider) => {
        setSelectedBuyer(buyer);
        setStep('negotiating');
        setNegotiationGuardrailResults([]);
        setNegotiationEscalation(null);

        const buyerOffer = parseFloat(buyer.items[0]?.price?.value || '0');
        const targetPrice = marketAnalysis?.pricing_strategy?.target_price || buyerOffer * 1.1;
        const minPrice = marketAnalysis?.pricing_strategy?.minimum_acceptable_price || buyerOffer * 0.9;
        const marketAvgPrice = marketAnalysis?.market_analysis?.current_avg_price;

        // ── Run full negotiation guardrails before round 1 ──
        const { results, blockers } = runNegotiationGuardrails({
            buyerOffer,
            minimumPrice: minPrice,
            targetPrice,
            roundNumber: 1,
            quantity: parseFloat(quantity),
            cropType: crop,
            marketAvgPrice,
            isOnline,
        });
        setNegotiationGuardrailResults(results);

        // Surface any escalation (e.g. suspiciously low offer)
        const escalation = results.find(r => r.status === 'escalate') || null;
        setNegotiationEscalation(escalation);

        if (blockers.length > 0) {
            setError(blockers[0].message);
            setStep('error');
            return;
        }

        const round: NegotiationRound = {
            round: 1,
            buyerId: buyer.id,
            buyerName: buyer.name,
            buyerOffer,
        };

        try {
            const negotiation = await negotiateOffer(
                crop,
                parseFloat(quantity),
                buyerOffer,
                targetPrice,
                minPrice,
                1,
                []
            );

            round.decision = negotiation.result.decision;
            round.counterOffer = negotiation.result.counter_offer;
            round.message = negotiation.result.reasoning;

            // ── Post-round guardrail: verify counter direction ──
            if (round.decision === 'counter' && round.counterOffer !== undefined) {
                const dirCheck = checkCounterOfferDirection(round.counterOffer, buyerOffer, minPrice);
                setNegotiationGuardrailResults(prev => [...prev, dirCheck]);
            }

            // ── Post-round guardrail: deal acceptance threshold ──
            if (round.decision === 'accept') {
                const acceptCheck = checkDealAcceptanceThreshold(buyerOffer, targetPrice, minPrice);
                setNegotiationGuardrailResults(prev => [...prev, acceptCheck]);
                if (acceptCheck.status === 'warn') setNegotiationEscalation(acceptCheck);
            }

            setNegotiations([round]);
            setThoughts(prev => [...prev, ...negotiation.thoughts]);

            if (negotiation.result.decision === 'accept') {
                setFinalDeal({ buyer: buyer.name, price: buyerOffer, quantity: parseFloat(quantity) });
                setStep('deal_done');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Negotiation failed');
            setStep('error');
        }
    }, [crop, quantity, marketAnalysis, isOnline]);

    const continueNegotiation = useCallback(async (newOffer: number) => {
        if (!selectedBuyer || !marketAnalysis) return;

        const roundNum = negotiations.length + 1;
        const targetPrice = marketAnalysis.pricing_strategy?.target_price;
        const minPrice = marketAnalysis.pricing_strategy?.minimum_acceptable_price;
        const marketAvgPrice = marketAnalysis.market_analysis?.current_avg_price;

        // ── Run guardrails for this round ──
        const { results, blockers } = runNegotiationGuardrails({
            buyerOffer: newOffer,
            minimumPrice: minPrice,
            targetPrice,
            roundNumber: roundNum,
            quantity: parseFloat(quantity),
            cropType: crop,
            marketAvgPrice,
            isOnline,
        });
        setNegotiationGuardrailResults(prev => [...prev, ...results]);

        const escalation = results.find(r => r.status === 'escalate') || null;
        if (escalation) setNegotiationEscalation(escalation);

        if (blockers.length > 0) {
            setError(blockers[0].message);
            setStep('error');
            return;
        }

        const round: NegotiationRound = {
            round: roundNum,
            buyerId: selectedBuyer.id,
            buyerName: selectedBuyer.name,
            buyerOffer: newOffer,
        };

        try {
            const prevOffers = negotiations.map(n => ({
                round: n.round,
                buyerOffer: n.buyerOffer,
                counterOffer: n.counterOffer,
            }));

            const negotiation = await negotiateOffer(
                crop,
                parseFloat(quantity),
                newOffer,
                targetPrice,
                minPrice,
                roundNum,
                prevOffers
            );

            round.decision = negotiation.result.decision;
            round.counterOffer = negotiation.result.counter_offer;
            round.message = negotiation.result.reasoning;

            // ── Post-round guardrail: verify counter direction ──
            if (round.decision === 'counter' && round.counterOffer !== undefined) {
                const dirCheck = checkCounterOfferDirection(round.counterOffer, newOffer, minPrice);
                setNegotiationGuardrailResults(prev => [...prev, dirCheck]);
            }

            // ── Post-round guardrail: deal acceptance threshold ──
            if (round.decision === 'accept') {
                const acceptCheck = checkDealAcceptanceThreshold(newOffer, targetPrice, minPrice);
                setNegotiationGuardrailResults(prev => [...prev, acceptCheck]);
                if (acceptCheck.status === 'warn') setNegotiationEscalation(acceptCheck);
            }

            setNegotiations(prev => [...prev, round]);
            setThoughts(prev => [...prev, ...negotiation.thoughts]);

            if (negotiation.result.decision === 'accept') {
                setFinalDeal({ buyer: selectedBuyer.name, price: newOffer, quantity: parseFloat(quantity) });
                setStep('deal_done');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Negotiation round failed');
        }
    }, [selectedBuyer, negotiations, marketAnalysis, crop, quantity, isOnline]);

    const reset = () => {
        setStep('form');
        setThoughts([]);
        setMarketAnalysis(null);
        setBuyerResults([]);
        setSelectedBuyer(null);
        setNegotiations([]);
        setFinalDeal(null);
        setError(null);
        setGuardrailResults([]);
        setNegotiationGuardrailResults([]);
        setNegotiationEscalation(null);
    };

    return (
        <Card className="shadow-lg border-blue-200/50 dark:border-blue-800/30">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shrink-0">
                            <HandshakeIcon className="h-6 w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg md:text-xl truncate">
                                <TranslatedText text="Sales Negotiation Agent" targetLanguage={language} />
                            </CardTitle>
                            <CardDescription className="truncate text-xs md:text-sm">
                                <TranslatedText text="AI-powered produce sales via ONDC" targetLanguage={language} />
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={step === 'form' ? 'secondary' : step === 'deal_done' ? 'default' : step === 'error' ? 'destructive' : 'outline'}
                        className={`whitespace-nowrap shrink-0 w-fit ${!['form', 'deal_done', 'error', 'results'].includes(step) ? 'animate-pulse' : ''}`}>
                        {step === 'form' ? '● Ready' :
                            step === 'analyzing' ? '📊 Analyzing' :
                                step === 'searching' ? '🔍 Finding Buyers' :
                                    step === 'results' ? '📋 Buyers Found' :
                                        step === 'negotiating' ? '🤝 Negotiating' :
                                            step === 'deal_done' ? '✅ Deal Done' :
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

                {/* Harvest form */}
                {step === 'form' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
                            <ShoppingBag className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-center text-sm font-medium text-blue-800 dark:text-blue-200 mb-4">
                                <TranslatedText text="Tell us about your harvest — the agent will find buyers and negotiate the best price" targetLanguage={language} />
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs"><TranslatedText text="Crop" targetLanguage={language} /></Label>
                                    <Select value={crop} onValueChange={setCrop}>
                                        <SelectTrigger><SelectValue placeholder="Select crop" /></SelectTrigger>
                                        <SelectContent>
                                            {CROP_OPTIONS.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs"><TranslatedText text="Quantity (quintals)" targetLanguage={language} /></Label>
                                    <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs"><TranslatedText text="Quality" targetLanguage={language} /></Label>
                                    <Select value={quality} onValueChange={setQuality}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {QUALITY_OPTIONS.map(q => (
                                                <SelectItem key={q} value={q}>{q}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            onClick={runSalesAgent}
                            disabled={!crop || !quantity}
                        >
                            <Bot className="h-5 w-5" />
                            <TranslatedText text="Find Buyers & Negotiate" targetLanguage={language} />
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Loading states */}
                {(step === 'analyzing' || step === 'searching') && (
                    <div className="text-center py-6">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="font-medium">
                            {step === 'analyzing' && <TranslatedText text="Analyzing market conditions and pricing strategy..." targetLanguage={language} />}
                            {step === 'searching' && <TranslatedText text="Searching ONDC for produce buyers..." targetLanguage={language} />}
                        </p>
                    </div>
                )}

                {/* Chain of Thought */}
                {thoughts.length > 0 && (
                    <>
                        <Separator />
                        <AgentActivityLog thoughts={thoughts} isLive={['analyzing', 'searching', 'negotiating'].includes(step)} />
                    </>
                )}

                {/* Market Analysis */}
                {marketAnalysis && step !== 'form' && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                                <TranslatedText text="AI Market Analysis" targetLanguage={language} />
                            </h4>
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                                <div className="grid grid-cols-3 gap-3 mb-2">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Min Price</p>
                                        <p className="text-lg font-bold text-red-600">₹{marketAnalysis.pricing_strategy?.minimum_acceptable_price}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Target Price</p>
                                        <p className="text-lg font-bold text-green-600">₹{marketAnalysis.pricing_strategy?.target_price}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Premium</p>
                                        <p className="text-lg font-bold text-blue-600">₹{marketAnalysis.pricing_strategy?.premium_price}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        Trend: {marketAnalysis.market_analysis?.price_trend === 'rising' ? '📈' : marketAnalysis.market_analysis?.price_trend === 'falling' ? '📉' : '➡️'} {marketAnalysis.market_analysis?.price_trend}
                                    </Badge>
                                    <Badge variant="outline">
                                        Demand: {marketAnalysis.market_analysis?.demand_level}
                                    </Badge>
                                </div>
                                <p className="text-sm mt-2">{marketAnalysis.market_analysis?.summary}</p>
                            </div>
                        </div>
                    </>
                )}

                {/* Buyer Results */}
                {buyerResults.length > 0 && (step === 'results' || step === 'negotiating' || step === 'deal_done') && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                <TranslatedText text="ONDC Buyers — Offers Received" targetLanguage={language} />
                            </h4>

                            <div className="space-y-2">
                                {buyerResults.map(buyer => {
                                    const offer = buyer.items[0]?.price?.value || '0';
                                    const isSelected = selectedBuyer?.id === buyer.id;

                                    return (
                                        <div
                                            key={buyer.id}
                                            className={`p-3 rounded-xl border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-sm">{buyer.name}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                        {buyer.rating && (
                                                            <span className="flex items-center gap-0.5">
                                                                <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {buyer.rating}
                                                            </span>
                                                        )}
                                                        {buyer.location && (
                                                            <span className="flex items-center gap-0.5">
                                                                <MapPin className="h-3 w-3" /> {buyer.location.city}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {buyer.items[0]?.description}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-green-600 flex items-center">
                                                        <IndianRupee className="h-4 w-4" />{offer}
                                                        <span className="text-xs font-normal text-muted-foreground ml-1">/qtl</span>
                                                    </p>
                                                    {step === 'results' && (
                                                        <Button size="sm" variant="outline" className="mt-1" onClick={() => startNegotiation(buyer)}>
                                                            <HandshakeIcon className="h-3 w-3 mr-1" />
                                                            <TranslatedText text="Negotiate" targetLanguage={language} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                <>
                    <Separator className="my-6 block bg-blue-100 dark:bg-blue-900/40 opacity-70" />

                    {/* Negotiation Compliance Guardrails */}
                    {negotiationGuardrailResults.length > 0 && (
                        <>
                            <GuardrailSummary results={negotiationGuardrailResults} title="Negotiation Compliance Checks" />
                            <Separator className="my-2" />
                        </>
                    )}

                    {/* Escalation Alert (e.g. suspiciously low offer, deal below target) */}
                    {negotiationEscalation && (
                        <>
                            <EscalationAlert result={negotiationEscalation} />
                            <Separator className="my-2" />
                        </>
                    )}

                    <div className="rounded-xl overflow-hidden border border-blue-200 dark:border-blue-800/40 shadow-sm bg-white dark:bg-slate-950">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-3 px-4 text-white flex items-center justify-between">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Bot className="h-4 w-4" />
                                <TranslatedText text="AI Negotiation Room" targetLanguage={language} />
                            </h4>
                            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] uppercase font-bold tracking-wider">
                                {step === 'deal_done' ? 'Deal Closed' : 'Live Negotiation'}
                            </Badge>
                        </div>

                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 space-y-6">
                            {negotiations.map((n, i) => (
                                <div key={i} className="space-y-4 relative">
                                    {/* Connector line between rounds */}
                                    {i > 0 && (
                                        <div className="absolute -top-6 left-6 h-6 w-0.5 bg-border/50"></div>
                                    )}

                                    {/* Buyer Offer (Left aligned) */}
                                    <div className="flex gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 z-10 border-2 border-white dark:border-slate-950 shadow-sm">
                                            <TrendingUp className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 border shadow-sm rounded-2xl rounded-tl-sm p-3 max-w-[85%] text-sm relative group">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-semibold text-xs text-slate-500">{n.buyerName} <span className="font-normal opacity-70">(Buyer)</span></span>
                                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Round {n.round}</span>
                                            </div>
                                            <p className="font-medium">
                                                <span className="opacity-70 font-normal">Offer:</span> <span className="text-blue-600 dark:text-blue-400 font-bold">₹{n.buyerOffer}/quintal</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Agent Thinking & Counter Offer (Right aligned) */}
                                    <div className="flex flex-col items-end gap-3 mt-4">
                                        {/* AI Reasoning Block */}
                                        {n.message && (
                                            <div className="bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-3 max-w-[85%] text-xs text-indigo-800 dark:text-indigo-300 shadow-inner relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                                                <div className="flex items-center gap-1.5 mb-1 opacity-70 font-mono tracking-tight uppercase font-semibold">
                                                    <Bot className="h-3 w-3" /> AI Reasoning
                                                </div>
                                                <p className="italic leading-relaxed">{n.message}</p>
                                            </div>
                                        )}

                                        {n.counterOffer && (
                                            <div className="flex gap-3 flex-row-reverse w-full">
                                                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0 z-10 border-2 border-white dark:border-slate-950 shadow-sm">
                                                    <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="bg-indigo-600 text-white shadow-md rounded-2xl rounded-tr-sm p-3 max-w-[85%] text-sm">
                                                    <div className="flex justify-between items-start mb-1 opacity-80">
                                                        <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded">
                                                            {n.decision === 'accept' ? 'ACCEPTED' : n.decision === 'counter' ? 'COUNTER-OFFER' : 'REJECTED'}
                                                        </span>
                                                        <span className="font-semibold text-xs text-indigo-100">KisanMitra AI Sales Agent</span>
                                                    </div>
                                                    <p className="font-medium">
                                                        <span className="opacity-80 font-normal">Countering with:</span> <span className="font-bold text-lg">₹{n.counterOffer}/quintal</span>
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Accept state */}
                                        {n.decision === 'accept' && !n.counterOffer && (
                                            <div className="flex gap-3 flex-row-reverse w-full">
                                                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0 z-10 border-2 border-white dark:border-slate-950 shadow-sm">
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                </div>
                                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 shadow-md rounded-2xl rounded-tr-sm p-3 text-sm flex items-center gap-2">
                                                    <span className="font-bold text-green-700 dark:text-green-400">Offer Accepted</span>
                                                    <span className="text-green-600 dark:text-green-300 font-medium">₹{n.buyerOffer}/quintal</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Continue negotiation actions */}
                            {step === 'negotiating' && negotiations[negotiations.length - 1]?.decision === 'counter' && (
                                <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-dashed">
                                    <Button
                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border shadow-sm"
                                        onClick={() => {
                                            const lastCounter = negotiations[negotiations.length - 1]?.counterOffer || 0;
                                            const midpoint = Math.floor((lastCounter + (negotiations[negotiations.length - 1]?.buyerOffer || 0)) / 2);
                                            continueNegotiation(midpoint);
                                        }}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2 text-indigo-500" />
                                        <TranslatedText text="Simulate Buyer Response" targetLanguage={language} />
                                    </Button>
                                    <Button
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md"
                                        onClick={async () => {
                                            const lastOffer = negotiations[negotiations.length - 1]?.buyerOffer || 0;
                                            setFinalDeal({
                                                buyer: selectedBuyer?.name || '',
                                                price: lastOffer,
                                                quantity: parseFloat(quantity),
                                            });
                                            setStep('deal_done');

                                            // Record the manual acceptance to the digital ledger!
                                            const { addLedgerEntry } = await import('@/lib/ledgerService');
                                            await addLedgerEntry(
                                                'farmer_001',
                                                'NEGOTIATION_ACCEPTED',
                                                `Sold ${quantity} quintals of ${crop} for ₹${lastOffer}/q`,
                                                { cropType: crop, quantity: parseFloat(quantity), finalPrice: lastOffer }
                                            );
                                        }}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        <TranslatedText text="Override & Accept Last" targetLanguage={language} />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </>

                {/* Deal Done */}
                {finalDeal && step === 'deal_done' && (
                    <>
                        <Separator />
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800/30 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                            <h4 className="font-bold text-lg text-green-800 dark:text-green-200">
                                <TranslatedText text="Deal Confirmed!" targetLanguage={language} />
                            </h4>
                            <div className="grid grid-cols-3 gap-4 mt-3 text-center">
                                <div>
                                    <p className="text-xs text-muted-foreground">Buyer</p>
                                    <p className="text-sm font-medium">{finalDeal.buyer}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Price</p>
                                    <p className="text-lg font-bold text-green-600">₹{finalDeal.price}/qtl</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Value</p>
                                    <p className="text-lg font-bold text-green-600">₹{(finalDeal.price * finalDeal.quantity).toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                                <TranslatedText text="Transaction facilitated via ONDC Network · Payment via UPI on delivery" targetLanguage={language} />
                            </p>
                        </div>
                    </>
                )}

                {/* Error */}
                {step === 'error' && error && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/30">
                        <XCircle className="h-6 w-6 text-red-500 mb-2" />
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={reset}>
                            <TranslatedText text="Try Again" targetLanguage={language} />
                        </Button>
                    </div>
                )}

                {/* Reset */}
                {(step === 'deal_done' || step === 'results') && (
                    <Button variant="outline" className="w-full" onClick={reset}>
                        <TranslatedText text={step === 'deal_done' ? 'Start New Sale' : 'Back to Form'} targetLanguage={language} />
                    </Button>
                )}

                {/* Audit Trail */}
                <Separator />
                <AuditTrailViewer />
            </CardContent>
        </Card>
    );
}
