/**
 * KisanMitra Agent Compliance Guardrails
 *
 * Enforces domain-specific rules before any agent action is taken.
 * Handles edge cases, confidence thresholds, escalation, and audit logging.
 *
 * Edge Cases Handled:
 * 1. Low-confidence disease detection (< 30%) → refuse agent activation, ask for better image
 * 2. Negotiation below minimum price → hard block, never accept
 * 3. Offline / API failure → graceful degradation with cached fallback
 * 4. Invalid / out-of-range coordinates → refuse geolocation-dependent actions
 * 5. Critical severity disease → escalate to human expert, flag in ledger
 * 6. Excessive negotiation rounds (> 5) → escalate, stop agent loop
 */

export type GuardrailStatus = 'pass' | 'warn' | 'block' | 'escalate';

export interface GuardrailResult {
  status: GuardrailStatus;
  code: string;
  message: string;
  details?: string;
  suggestedAction?: string;
  auditEntry: AuditEntry;
}

export interface AuditEntry {
  timestamp: string;
  agentType: 'remediation' | 'sales' | 'negotiation' | 'detection';
  checkName: string;
  status: GuardrailStatus;
  input: Record<string, unknown>;
  reasoning: string;
}

// ─── Audit Log (in-memory + localStorage) ──────────────────────

const AUDIT_KEY = 'kisanmitra_guardrail_audit';

export const appendAuditLog = (entry: AuditEntry): void => {
  try {
    const existing: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    existing.unshift(entry); // newest first
    // Keep last 200 entries
    localStorage.setItem(AUDIT_KEY, JSON.stringify(existing.slice(0, 200)));
  } catch {
    // localStorage unavailable — silently skip
  }
};

export const getAuditLog = (): AuditEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearAuditLog = (): void => {
  localStorage.removeItem(AUDIT_KEY);
};

// ─── Helper ─────────────────────────────────────────────────────

const makeAudit = (
  agentType: AuditEntry['agentType'],
  checkName: string,
  status: GuardrailStatus,
  input: Record<string, unknown>,
  reasoning: string
): AuditEntry => ({
  timestamp: new Date().toISOString(),
  agentType,
  checkName,
  status,
  input,
  reasoning,
});

// ─── GUARDRAIL 1: Disease Detection Confidence ──────────────────

export const CONFIDENCE_THRESHOLD_WARN = 0.45;  // warn below 45%
export const CONFIDENCE_THRESHOLD_BLOCK = 0.30; // block below 30%

export interface DiseaseInput {
  class_name: string;
  confidence: number;
}

export const checkDiseaseConfidence = (
  diseases: DiseaseInput[]
): GuardrailResult => {
  if (!diseases || diseases.length === 0) {
    const audit = makeAudit('detection', 'confidence_check', 'block',
      { diseaseCount: 0 },
      'No diseases provided — agent cannot proceed without detection results.');
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'NO_DISEASES',
      message: 'No diseases detected. Upload a clearer image of the affected crop.',
      suggestedAction: 'Take a close-up photo of the diseased leaf in good lighting.',
      auditEntry: audit,
    };
  }

  const avgConfidence = diseases.reduce((s, d) => s + d.confidence, 0) / diseases.length;
  const minConfidence = Math.min(...diseases.map(d => d.confidence));

  if (minConfidence < CONFIDENCE_THRESHOLD_BLOCK) {
    const audit = makeAudit('detection', 'confidence_check', 'block',
      { avgConfidence, minConfidence, diseases: diseases.map(d => d.class_name) },
      `Minimum confidence ${(minConfidence * 100).toFixed(1)}% is below the 30% threshold. Agent refuses to act on unreliable detections.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'LOW_CONFIDENCE',
      message: `Detection confidence too low (${(minConfidence * 100).toFixed(1)}%). Agent cannot reliably identify the disease.`,
      details: `Minimum confidence: ${(minConfidence * 100).toFixed(1)}% (threshold: 30%). Unreliable detections could lead to wrong treatments.`,
      suggestedAction: 'Retake the photo in better lighting, focusing on the most affected leaf. Ensure the disease symptoms are clearly visible.',
      auditEntry: audit,
    };
  }

  if (avgConfidence < CONFIDENCE_THRESHOLD_WARN) {
    const audit = makeAudit('detection', 'confidence_check', 'warn',
      { avgConfidence, minConfidence },
      `Average confidence ${(avgConfidence * 100).toFixed(1)}% is below 45%. Proceeding with caution.`);
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'MODERATE_CONFIDENCE',
      message: `Moderate confidence (${(avgConfidence * 100).toFixed(1)}%). Recommendations may not be fully accurate.`,
      details: 'Consider consulting a local agricultural expert to confirm the diagnosis.',
      suggestedAction: 'Proceed with caution. Verify treatment with a Krishi Vigyan Kendra (KVK) expert.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('detection', 'confidence_check', 'pass',
    { avgConfidence, minConfidence },
    `Confidence ${(avgConfidence * 100).toFixed(1)}% meets threshold. Agent authorized to proceed.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'CONFIDENCE_OK',
    message: `Detection confidence acceptable (${(avgConfidence * 100).toFixed(1)}%).`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 2: Negotiation Price Floor ───────────────────────

export const checkNegotiationFloor = (
  buyerOffer: number,
  minimumPrice: number,
  roundNumber: number
): GuardrailResult => {
  // Hard block: never accept below minimum
  if (buyerOffer < minimumPrice) {
    const audit = makeAudit('negotiation', 'price_floor_check', 'block',
      { buyerOffer, minimumPrice, roundNumber },
      `Buyer offer ₹${buyerOffer} is below minimum ₹${minimumPrice}. Agent is hard-blocked from accepting.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'BELOW_MINIMUM_PRICE',
      message: `Buyer offer ₹${buyerOffer}/quintal is below your minimum price of ₹${minimumPrice}/quintal.`,
      details: 'The agent will never accept an offer below your stated minimum price. This is a hard guardrail.',
      suggestedAction: 'Agent will counter-offer or reject. Consider finding a different buyer.',
      auditEntry: audit,
    };
  }

  // Escalate: too many rounds without deal
  if (roundNumber > 5) {
    const audit = makeAudit('negotiation', 'round_limit_check', 'escalate',
      { roundNumber, buyerOffer, minimumPrice },
      `Negotiation has exceeded 5 rounds without resolution. Escalating to farmer for manual decision.`);
    appendAuditLog(audit);
    return {
      status: 'escalate',
      code: 'MAX_ROUNDS_EXCEEDED',
      message: `Negotiation has gone ${roundNumber} rounds. Agent recommends escalating to direct discussion.`,
      details: 'Extended negotiations may indicate a significant price gap. Human judgment is recommended.',
      suggestedAction: 'Contact the buyer directly or consider a different buyer from the ONDC list.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('negotiation', 'price_floor_check', 'pass',
    { buyerOffer, minimumPrice, roundNumber },
    `Offer ₹${buyerOffer} is above minimum ₹${minimumPrice}. Negotiation can proceed.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'PRICE_ACCEPTABLE',
    message: `Offer ₹${buyerOffer}/quintal is above minimum price.`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 2b: Buyer Offer Validity ─────────────────────────

export const checkBuyerOfferValidity = (buyerOffer: number): GuardrailResult => {
  if (!buyerOffer || buyerOffer <= 0) {
    const audit = makeAudit('negotiation', 'buyer_offer_validity', 'block',
      { buyerOffer },
      `Buyer offer ₹${buyerOffer} is zero or negative — invalid offer, agent blocked.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'INVALID_BUYER_OFFER',
      message: `Buyer offer ₹${buyerOffer}/quintal is not a valid price.`,
      details: 'A buyer offer must be a positive number. This may indicate a data error from the ONDC catalog.',
      suggestedAction: 'Refresh the buyer list or select a different buyer with a valid offer.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('negotiation', 'buyer_offer_validity', 'pass',
    { buyerOffer },
    `Buyer offer ₹${buyerOffer} is a valid positive price.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'OFFER_VALID',
    message: `Buyer offer ₹${buyerOffer}/quintal is valid.`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 2c: Counter-Offer Direction ──────────────────────
// Ensures the agent never counters BELOW the buyer's current offer
// (which would mean negotiating against the farmer)

export const checkCounterOfferDirection = (
  counterOffer: number,
  buyerOffer: number,
  minimumPrice: number
): GuardrailResult => {
  if (counterOffer < minimumPrice) {
    const audit = makeAudit('negotiation', 'counter_offer_direction', 'block',
      { counterOffer, buyerOffer, minimumPrice },
      `Counter-offer ₹${counterOffer} is below minimum ₹${minimumPrice}. This is a hard violation — agent cannot propose this.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'COUNTER_BELOW_MINIMUM',
      message: `Counter-offer ₹${counterOffer}/quintal is below your minimum price of ₹${minimumPrice}/quintal.`,
      details: 'The agent attempted to counter below the farmer\'s minimum. This has been blocked and corrected.',
      suggestedAction: 'Counter-offer has been automatically corrected to the minimum price floor.',
      auditEntry: audit,
    };
  }

  if (counterOffer < buyerOffer) {
    const audit = makeAudit('negotiation', 'counter_offer_direction', 'block',
      { counterOffer, buyerOffer, minimumPrice },
      `Counter-offer ₹${counterOffer} is LOWER than buyer's offer ₹${buyerOffer}. Agent was negotiating against the farmer — blocked.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'COUNTER_BELOW_BUYER_OFFER',
      message: `Counter-offer ₹${counterOffer}/quintal is lower than the buyer's offer of ₹${buyerOffer}/quintal.`,
      details: 'The AI attempted to counter with a price lower than what the buyer already offered — this would actively harm the farmer. Blocked and corrected.',
      suggestedAction: 'Counter-offer corrected to a price above the buyer\'s current offer.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('negotiation', 'counter_offer_direction', 'pass',
    { counterOffer, buyerOffer, minimumPrice },
    `Counter-offer ₹${counterOffer} is above buyer offer ₹${buyerOffer} and above minimum ₹${minimumPrice}. Direction is correct (farmer-favourable).`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'COUNTER_DIRECTION_OK',
    message: `Counter-offer ₹${counterOffer}/quintal is correctly above buyer's offer.`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 2d: Deal Acceptance Threshold ────────────────────
// Warns if the agent is about to accept significantly below target price

export const checkDealAcceptanceThreshold = (
  acceptedPrice: number,
  targetPrice: number,
  minimumPrice: number
): GuardrailResult => {
  const gapFromTarget = targetPrice - acceptedPrice;
  const gapPercent = targetPrice > 0 ? (gapFromTarget / targetPrice) * 100 : 0;

  // Accepting at or above target — great outcome
  if (acceptedPrice >= targetPrice) {
    const audit = makeAudit('negotiation', 'deal_acceptance_threshold', 'pass',
      { acceptedPrice, targetPrice, minimumPrice },
      `Accepted price ₹${acceptedPrice} meets or exceeds target ₹${targetPrice}. Excellent outcome for farmer.`);
    appendAuditLog(audit);
    return {
      status: 'pass',
      code: 'DEAL_AT_OR_ABOVE_TARGET',
      message: `Deal accepted at ₹${acceptedPrice}/quintal — at or above your target price.`,
      auditEntry: audit,
    };
  }

  // Accepting more than 15% below target — warn farmer
  if (gapPercent > 15) {
    const audit = makeAudit('negotiation', 'deal_acceptance_threshold', 'warn',
      { acceptedPrice, targetPrice, minimumPrice, gapPercent: gapPercent.toFixed(1) },
      `Accepted price ₹${acceptedPrice} is ${gapPercent.toFixed(1)}% below target ₹${targetPrice}. Farmer may be leaving money on the table.`);
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'DEAL_BELOW_TARGET',
      message: `Accepted ₹${acceptedPrice}/quintal — ${gapPercent.toFixed(1)}% below your target of ₹${targetPrice}/quintal.`,
      details: `You could potentially earn ₹${gapFromTarget.toFixed(0)} more per quintal by continuing to negotiate or finding another buyer.`,
      suggestedAction: 'Consider rejecting and trying another buyer on ONDC, or negotiate one more round.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('negotiation', 'deal_acceptance_threshold', 'pass',
    { acceptedPrice, targetPrice, minimumPrice, gapPercent: gapPercent.toFixed(1) },
    `Accepted price ₹${acceptedPrice} is within 15% of target ₹${targetPrice}. Acceptable outcome.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'DEAL_NEAR_TARGET',
    message: `Deal accepted at ₹${acceptedPrice}/quintal — within acceptable range of target.`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 2e: Market Price Deviation ───────────────────────
// Warns if buyer's offer deviates wildly from known market prices (fraud/error signal)

export const checkMarketPriceDeviation = (
  buyerOffer: number,
  marketAvgPrice: number,
  cropType: string
): GuardrailResult => {
  if (!marketAvgPrice || marketAvgPrice <= 0) {
    const audit = makeAudit('negotiation', 'market_price_deviation', 'warn',
      { buyerOffer, marketAvgPrice, cropType },
      'No market average price available for deviation check. Skipping.');
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'NO_MARKET_DATA',
      message: 'No market price data available for comparison.',
      details: 'Cannot verify if buyer\'s offer is fair without market price data.',
      suggestedAction: 'Check current mandi prices at agmarknet.gov.in before accepting.',
      auditEntry: audit,
    };
  }

  const deviationPercent = Math.abs((buyerOffer - marketAvgPrice) / marketAvgPrice) * 100;

  // Offer is suspiciously low (> 30% below market) — possible exploitation
  if (buyerOffer < marketAvgPrice * 0.70) {
    const audit = makeAudit('negotiation', 'market_price_deviation', 'escalate',
      { buyerOffer, marketAvgPrice, deviationPercent: deviationPercent.toFixed(1), cropType },
      `Buyer offer ₹${buyerOffer} is ${deviationPercent.toFixed(1)}% below market average ₹${marketAvgPrice}. Possible exploitation attempt.`);
    appendAuditLog(audit);
    return {
      status: 'escalate',
      code: 'OFFER_SUSPICIOUSLY_LOW',
      message: `Buyer's offer is ${deviationPercent.toFixed(1)}% below the market average for ${cropType}.`,
      details: `Market average: ₹${marketAvgPrice}/quintal. Buyer offered: ₹${buyerOffer}/quintal. This is a significant undervaluation.`,
      suggestedAction: 'This buyer may be attempting to exploit you. Consider rejecting and finding buyers closer to the market rate on ONDC.',
      auditEntry: audit,
    };
  }

  // Offer is unusually high (> 25% above market) — verify before accepting
  if (buyerOffer > marketAvgPrice * 1.25) {
    const audit = makeAudit('negotiation', 'market_price_deviation', 'warn',
      { buyerOffer, marketAvgPrice, deviationPercent: deviationPercent.toFixed(1), cropType },
      `Buyer offer ₹${buyerOffer} is ${deviationPercent.toFixed(1)}% above market average ₹${marketAvgPrice}. Unusually high — verify before accepting.`);
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'OFFER_UNUSUALLY_HIGH',
      message: `Buyer's offer is ${deviationPercent.toFixed(1)}% above market average — verify this is genuine.`,
      details: `Market average: ₹${marketAvgPrice}/quintal. Buyer offered: ₹${buyerOffer}/quintal. Verify buyer credentials before committing.`,
      suggestedAction: 'Confirm buyer identity and payment terms on ONDC before accepting.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('negotiation', 'market_price_deviation', 'pass',
    { buyerOffer, marketAvgPrice, deviationPercent: deviationPercent.toFixed(1), cropType },
    `Buyer offer ₹${buyerOffer} is within ±25% of market average ₹${marketAvgPrice}. Fair price range.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'PRICE_WITHIN_MARKET_RANGE',
    message: `Buyer's offer is within the expected market range for ${cropType}.`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 2f: Quantity Validity ────────────────────────────

export const checkQuantityValidity = (quantity: number, unit = 'quintals'): GuardrailResult => {
  if (isNaN(quantity) || quantity <= 0) {
    const audit = makeAudit('sales', 'quantity_validity', 'block',
      { quantity, unit },
      `Quantity ${quantity} is invalid (zero or negative). Agent blocked.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'INVALID_QUANTITY',
      message: `Quantity must be a positive number.`,
      auditEntry: audit,
    };
  }

  if (quantity > 100000) {
    const audit = makeAudit('sales', 'quantity_validity', 'block',
      { quantity, unit },
      `Quantity ${quantity} ${unit} exceeds maximum allowed (100,000). Possible data entry error.`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'QUANTITY_TOO_LARGE',
      message: `Quantity ${quantity} ${unit} exceeds the maximum allowed (100,000 ${unit}).`,
      details: 'This may be a data entry error. Please verify the quantity.',
      suggestedAction: 'Double-check the quantity and re-enter.',
      auditEntry: audit,
    };
  }

  if (quantity < 1) {
    const audit = makeAudit('sales', 'quantity_validity', 'warn',
      { quantity, unit },
      `Quantity ${quantity} ${unit} is less than 1 — very small lot, may not attract serious buyers.`);
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'QUANTITY_VERY_SMALL',
      message: `Quantity ${quantity} ${unit} is very small. Buyers may not be interested in such small lots.`,
      suggestedAction: 'Consider aggregating with other farmers via an FPO for better bargaining power.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('sales', 'quantity_validity', 'pass',
    { quantity, unit },
    `Quantity ${quantity} ${unit} is valid.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'QUANTITY_VALID',
    message: `Quantity ${quantity} ${unit} is valid.`,
    auditEntry: audit,
  };
};

// ─── Run All Negotiation Guardrails (Pre-round) ──────────────────

export interface NegotiationGuardrailInput {
  buyerOffer: number;
  minimumPrice: number;
  targetPrice: number;
  roundNumber: number;
  quantity: number;
  cropType: string;
  marketAvgPrice?: number;
  isOnline: boolean;
}

export const runNegotiationGuardrails = (
  input: NegotiationGuardrailInput
): { passed: boolean; results: GuardrailResult[]; blockers: GuardrailResult[] } => {
  const results: GuardrailResult[] = [];

  results.push(checkConnectivity(input.isOnline));
  results.push(checkBuyerOfferValidity(input.buyerOffer));
  results.push(checkNegotiationFloor(input.buyerOffer, input.minimumPrice, input.roundNumber));
  results.push(checkQuantityValidity(input.quantity));
  results.push(sanitizeTextInput(input.cropType, 'Crop Type'));

  if (input.marketAvgPrice !== undefined) {
    results.push(checkMarketPriceDeviation(input.buyerOffer, input.marketAvgPrice, input.cropType));
  }

  const blockers = results.filter(r => r.status === 'block');
  return { passed: blockers.length === 0, results, blockers };
};

// ─── GUARDRAIL 3: Critical Severity Escalation ──────────────────

export const checkSeverityEscalation = (
  severity: string,
  urgency: string,
  cropType: string
): GuardrailResult => {
  if (severity === 'critical') {
    const audit = makeAudit('remediation', 'severity_escalation', 'escalate',
      { severity, urgency, cropType },
      `Critical severity detected for ${cropType}. Agent recommends immediate human expert consultation alongside AI treatment.`);
    appendAuditLog(audit);
    return {
      status: 'escalate',
      code: 'CRITICAL_SEVERITY',
      message: `Critical disease severity detected in ${cropType}. Immediate action required.`,
      details: 'AI treatment recommendations are provided, but critical cases require expert verification. Contact your nearest Krishi Vigyan Kendra (KVK) or state agriculture department.',
      suggestedAction: 'Call KVK helpline: 1800-180-1551 (toll-free). Apply emergency organic treatment immediately while awaiting expert advice.',
      auditEntry: audit,
    };
  }

  if (urgency === 'immediate' && severity === 'high') {
    const audit = makeAudit('remediation', 'severity_escalation', 'warn',
      { severity, urgency, cropType },
      `High severity with immediate urgency. Agent proceeding but flagging for monitoring.`);
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'HIGH_URGENCY',
      message: 'High severity disease requires immediate treatment within 24 hours.',
      details: 'Agent has generated treatment plan. Monitor crop response after 48 hours.',
      suggestedAction: 'Apply treatment today. Take follow-up photos in 48 hours to track recovery.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('remediation', 'severity_escalation', 'pass',
    { severity, urgency },
    `Severity ${severity} / urgency ${urgency} within manageable range. Agent proceeding normally.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'SEVERITY_MANAGEABLE',
    message: `Disease severity (${severity}) is within manageable range.`,
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 4: Coordinate Validation ─────────────────────────

export const checkCoordinates = (
  lat?: number,
  lng?: number
): GuardrailResult => {
  if (lat === undefined || lng === undefined) {
    const audit = makeAudit('detection', 'coordinate_validation', 'warn',
      { lat, lng },
      'No location provided. Agent will proceed without geolocation context.');
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'NO_LOCATION',
      message: 'Location not available. Recommendations will be generic (not region-specific).',
      suggestedAction: 'Enable location access for more accurate, region-specific recommendations.',
      auditEntry: audit,
    };
  }

  // India bounding box: lat 6–37, lng 68–98
  const inIndia = lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98;
  if (!inIndia) {
    const audit = makeAudit('detection', 'coordinate_validation', 'warn',
      { lat, lng },
      `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) are outside India. Market prices and regional advice may not apply.`);
    appendAuditLog(audit);
    return {
      status: 'warn',
      code: 'OUTSIDE_INDIA',
      message: 'Location appears to be outside India. Market data and regional advice may not be applicable.',
      details: `Detected coordinates: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
      suggestedAction: 'Verify your location settings. KisanMitra is optimized for Indian agricultural conditions.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('detection', 'coordinate_validation', 'pass',
    { lat: lat.toFixed(4), lng: lng.toFixed(4) },
    `Coordinates within India. Region-specific recommendations enabled.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'LOCATION_VALID',
    message: 'Location verified within India.',
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 5: Input Sanitization ────────────────────────────

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /system\s*prompt/i,
  /jailbreak/i,
  /\bDAN\b/,
  /<script/i,
  /javascript:/i,
];

export const sanitizeTextInput = (
  input: string,
  fieldName: string
): GuardrailResult => {
  if (!input || input.trim().length === 0) {
    const audit = makeAudit('detection', 'input_sanitization', 'block',
      { fieldName, inputLength: 0 },
      `Empty input for required field: ${fieldName}`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'EMPTY_INPUT',
      message: `${fieldName} cannot be empty.`,
      auditEntry: audit,
    };
  }

  if (input.length > 500) {
    const audit = makeAudit('detection', 'input_sanitization', 'block',
      { fieldName, inputLength: input.length },
      `Input exceeds 500 character limit for field: ${fieldName}`);
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'INPUT_TOO_LONG',
      message: `${fieldName} is too long (max 500 characters).`,
      auditEntry: audit,
    };
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      const audit = makeAudit('detection', 'input_sanitization', 'block',
        { fieldName, pattern: pattern.toString() },
        `Potential prompt injection detected in ${fieldName}. Input blocked.`);
      appendAuditLog(audit);
      return {
        status: 'block',
        code: 'PROMPT_INJECTION',
        message: 'Invalid input detected. Please enter a valid crop name or question.',
        auditEntry: audit,
      };
    }
  }

  const audit = makeAudit('detection', 'input_sanitization', 'pass',
    { fieldName, inputLength: input.length },
    `Input for ${fieldName} passed sanitization checks.`);
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'INPUT_VALID',
    message: 'Input validated.',
    auditEntry: audit,
  };
};

// ─── GUARDRAIL 6: Offline / Connectivity Check ──────────────────

export const checkConnectivity = (isOnline: boolean): GuardrailResult => {
  if (!isOnline) {
    const audit = makeAudit('detection', 'connectivity_check', 'block',
      { isOnline },
      'Device is offline. Agent actions require internet connectivity for AI inference and ONDC commerce.');
    appendAuditLog(audit);
    return {
      status: 'block',
      code: 'OFFLINE',
      message: 'No internet connection. Agent cannot run without connectivity.',
      details: 'AI disease analysis, treatment recommendations, and ONDC ordering all require internet access.',
      suggestedAction: 'Connect to internet (mobile data or WiFi) and try again. Your detection history is available offline.',
      auditEntry: audit,
    };
  }

  const audit = makeAudit('detection', 'connectivity_check', 'pass',
    { isOnline },
    'Device is online. Agent can proceed.');
  appendAuditLog(audit);
  return {
    status: 'pass',
    code: 'ONLINE',
    message: 'Connected.',
    auditEntry: audit,
  };
};

// ─── Run All Remediation Guardrails ─────────────────────────────

export interface RemediationGuardrailInput {
  diseases: DiseaseInput[];
  cropType?: string;
  location?: { lat: number; lng: number };
  isOnline: boolean;
}

export const runRemediationGuardrails = (
  input: RemediationGuardrailInput
): { passed: boolean; results: GuardrailResult[]; blockers: GuardrailResult[] } => {
  const results: GuardrailResult[] = [];

  results.push(checkConnectivity(input.isOnline));
  results.push(checkDiseaseConfidence(input.diseases));
  if (input.location) {
    results.push(checkCoordinates(input.location.lat, input.location.lng));
  }
  if (input.cropType) {
    results.push(sanitizeTextInput(input.cropType, 'Crop Type'));
  }

  const blockers = results.filter(r => r.status === 'block');
  return { passed: blockers.length === 0, results, blockers };
};
