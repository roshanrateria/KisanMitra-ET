/**
 * ComplianceGuardrails Component
 *
 * Displays guardrail check results, escalation alerts, and the full
 * agent audit trail. Shown inline within agent cards.
 */

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAuditLog, clearAuditLog, type GuardrailResult, type AuditEntry } from '@/lib/agents/guardrails';
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  ChevronDown, ChevronUp, ClipboardList, Trash2, Clock,
  CheckCircle2, XCircle, Info, PhoneCall
} from 'lucide-react';

// ─── Single Guardrail Result Badge ──────────────────────────────

interface GuardrailBadgeProps {
  result: GuardrailResult;
}

export function GuardrailBadge({ result }: GuardrailBadgeProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  const config = {
    pass: { icon: <ShieldCheck className="h-4 w-4 text-green-500" />, variant: 'default' as const, bg: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/40' },
    warn: { icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, variant: 'default' as const, bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40' },
    block: { icon: <ShieldX className="h-4 w-4 text-red-500" />, variant: 'destructive' as const, bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40' },
    escalate: { icon: <ShieldAlert className="h-4 w-4 text-orange-500" />, variant: 'default' as const, bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40' },
  }[result.status];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-lg border p-3 ${config.bg}`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="text-sm font-medium">{result.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {result.code}
              </Badge>
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {result.details && <p>{result.details}</p>}
            {result.suggestedAction && (
              <div className="flex items-start gap-1.5 mt-2 p-2 bg-white/60 dark:bg-black/20 rounded">
                <Info className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                <p className="text-blue-700 dark:text-blue-300">{result.suggestedAction}</p>
              </div>
            )}
            {result.status === 'escalate' && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-orange-100 dark:bg-orange-900/20 rounded">
                <PhoneCall className="h-3 w-3 text-orange-600 shrink-0" />
                <p className="text-orange-700 dark:text-orange-300 font-medium">
                  <TranslatedText text="KVK Helpline: 1800-180-1551 (Toll-Free)" targetLanguage={language} />
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Guardrail Summary Panel ─────────────────────────────────────

interface GuardrailSummaryProps {
  results: GuardrailResult[];
  title?: string;
}

export function GuardrailSummary({ results, title }: GuardrailSummaryProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  if (results.length === 0) return null;

  const blockers = results.filter(r => r.status === 'block');
  const escalations = results.filter(r => r.status === 'escalate');
  const warnings = results.filter(r => r.status === 'warn');
  const passes = results.filter(r => r.status === 'pass');

  const overallStatus = blockers.length > 0 ? 'block'
    : escalations.length > 0 ? 'escalate'
    : warnings.length > 0 ? 'warn'
    : 'pass';

  const statusConfig = {
    pass: { icon: <ShieldCheck className="h-5 w-5 text-green-500" />, label: 'All Checks Passed', color: 'text-green-700 dark:text-green-300' },
    warn: { icon: <AlertTriangle className="h-5 w-5 text-amber-500" />, label: 'Warnings — Proceed with Caution', color: 'text-amber-700 dark:text-amber-300' },
    block: { icon: <ShieldX className="h-5 w-5 text-red-500" />, label: 'Blocked — Action Required', color: 'text-red-700 dark:text-red-300' },
    escalate: { icon: <ShieldAlert className="h-5 w-5 text-orange-500" />, label: 'Escalation Required', color: 'text-orange-700 dark:text-orange-300' },
  }[overallStatus];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            {statusConfig.icon}
            <span className={`text-sm font-semibold ${statusConfig.color}`}>
              <TranslatedText text={title || 'Compliance Guardrails'} targetLanguage={language} />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {blockers.length > 0 && <Badge variant="destructive" className="text-[10px]">{blockers.length} blocked</Badge>}
            {escalations.length > 0 && <Badge className="text-[10px] bg-orange-500">{escalations.length} escalate</Badge>}
            {warnings.length > 0 && <Badge variant="outline" className="text-[10px] text-amber-600">{warnings.length} warn</Badge>}
            {passes.length > 0 && <Badge variant="outline" className="text-[10px] text-green-600">{passes.length} pass</Badge>}
            {open ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-2 mt-2">
          {results.map((r, i) => (
            <GuardrailBadge key={i} result={r} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Audit Trail Viewer ──────────────────────────────────────────

export function AuditTrailViewer() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>(() => getAuditLog());

  const refresh = () => setEntries(getAuditLog());

  const handleClear = () => {
    clearAuditLog();
    setEntries([]);
  };

  const statusIcon = (status: AuditEntry['status']) => ({
    pass: <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />,
    warn: <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />,
    block: <XCircle className="h-3 w-3 text-red-500 shrink-0" />,
    escalate: <ShieldAlert className="h-3 w-3 text-orange-500 shrink-0" />,
  }[status]);

  const agentColor = (type: AuditEntry['agentType']) => ({
    remediation: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    sales: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    negotiation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    detection: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  }[type]);

  return (
    <Collapsible open={open} onOpenChange={(v) => { setOpen(v); if (v) refresh(); }}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              <TranslatedText text="Agent Audit Trail" targetLanguage={language} />
            </span>
            {entries.length > 0 && (
              <Badge variant="outline" className="text-[10px]">{entries.length} entries</Badge>
            )}
          </div>
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              <TranslatedText text="No audit entries yet. Run an agent to see the audit trail." targetLanguage={language} />
            </p>
          ) : (
            entries.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                {statusIcon(entry.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${agentColor(entry.agentType)}`}>
                      {entry.agentType}
                    </span>
                    <span className="font-medium truncate">{entry.checkName}</span>
                    <span className="text-muted-foreground ml-auto flex items-center gap-0.5 shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2">{entry.reasoning}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-muted-foreground"
            onClick={handleClear}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            <TranslatedText text="Clear Audit Log" targetLanguage={language} />
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Escalation Alert ────────────────────────────────────────────

interface EscalationAlertProps {
  result: GuardrailResult;
}

export function EscalationAlert({ result }: EscalationAlertProps) {
  const { language } = useLanguage();

  if (result.status !== 'escalate') return null;

  return (
    <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
      <ShieldAlert className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800 dark:text-orange-200">
        <TranslatedText text="Expert Consultation Required" targetLanguage={language} />
      </AlertTitle>
      <AlertDescription className="text-orange-700 dark:text-orange-300 space-y-1">
        <p>{result.details}</p>
        {result.suggestedAction && <p className="font-medium">{result.suggestedAction}</p>}
      </AlertDescription>
    </Alert>
  );
}
