// KisanMitra Lambda API Server
// Single Lambda function handling all API routes
// Node.js 20 runtime — native fetch, zero npm dependencies
// All API keys read from Lambda environment variables

// ─── CORS & Response Helpers ───────────────────────────────────

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
};

const ok = (body) => ({
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
});

const err = (statusCode, message) => ({
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
});

// ─── Environment Variables (set in Lambda config) ──────────────

const env = (key) => process.env[key] || '';

// ─── Route Handler ─────────────────────────────────────────────

export const handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    // Parse path from API Gateway v1 or v2
    let path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

    // Strip API Gateway stage prefix (e.g. /prod, /dev) if present
    // API Gateway HTTP API v2 includes the stage in rawPath
    if (path.match(/^\/(prod|dev|staging)\//)) {
        path = path.replace(/^\/(prod|dev|staging)/, '');
    }

    let body = {};
    if (event.body) {
        try {
            body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body);
        } catch { body = {}; }
    }

    // Parse query string params
    const query = event.queryStringParameters || {};

    console.log(`[${method}] ${path}`);

    try {
        // ─── AGENT ROUTES ────────────────────────────────────────

        if (path === '/api/agents/remediation' && method === 'POST') {
            return await handleRemediationAgent(body);
        }
        if (path === '/api/agents/sales' && method === 'POST') {
            return await handleSalesAgent(body);
        }
        if (path === '/api/agents/negotiate' && method === 'POST') {
            return await handleNegotiation(body);
        }

        // ─── ONDC ROUTES ─────────────────────────────────────────

        if (path === '/api/ondc/search' && method === 'POST') {
            return await handleONDCSearch(body);
        }
        if (path === '/api/ondc/select' && method === 'POST') {
            return await handleONDCSelect(body);
        }
        if (path === '/api/ondc/confirm' && method === 'POST') {
            return await handleONDCConfirm(body);
        }

        // ─── GEMINI ROUTES ───────────────────────────────────────

        if (path === '/api/gemini/chat' && method === 'POST') {
            return await handleGeminiChat(body);
        }
        if (path === '/api/gemini/tasks' && method === 'POST') {
            return await handleGeminiTasks(body);
        }
        if (path === '/api/gemini/treatment' && method === 'POST') {
            return await handleGeminiTreatment(body);
        }
        if (path === '/api/gemini/video' && method === 'POST') {
            return await handleGeminiVideo(body);
        }

        // ─── TRANSLATE ROUTE ─────────────────────────────────────

        if (path === '/api/translate' && method === 'POST') {
            return await handleTranslation(body);
        }

        // ─── WEATHER ROUTE ───────────────────────────────────────

        if (path === '/api/weather' && method === 'GET') {
            return await handleWeather(query);
        }

        // ─── FORECAST ROUTE ──────────────────────────────────────

        if (path === '/api/forecast' && method === 'GET') {
            return await handleForecast(query);
        }

        // ─── SOIL ROUTE ──────────────────────────────────────────

        if (path === '/api/soil' && method === 'GET') {
            return await handleSoil(query);
        }

        // ─── DISEASE DETECTION ROUTE ─────────────────────────────

        if (path === '/api/disease-detect' && method === 'POST') {
            return await handleDiseaseDetection(event);
        }

        // ─── LEDGER ROUTE ────────────────────────────────────────
        if (path === '/api/ledger' && method === 'GET') {
            return await handleLedgerGet(query);
        }
        if (path === '/api/ledger' && method === 'POST') {
            return await handleLedgerPost(body);
        }

        // ─── HEALTH CHECK ────────────────────────────────────────

        if (path === '/api/health') {
            return ok({ status: 'ok', service: 'kisanmitra-api', timestamp: new Date().toISOString() });
        }

        return err(404, `Route not found: ${method} ${path}`);
    } catch (error) {
        console.error('Handler error:', error);
        return err(500, error.message || 'Internal server error');
    }
};

// ═══════════════════════════════════════════════════════════════
// DYNAMODB — Farmer's Digital Ledger
// ═══════════════════════════════════════════════════════════════

const LEDGER_TABLE = 'KisanMitra-Ledger';

const getDynamoDocClient = async () => {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
    const client = new DynamoDBClient({ region: env('AWS_REGION') || 'us-east-1' });
    return DynamoDBDocumentClient.from(client);
};

const saveLedgerEntry = async (userId, type, details, title) => {
    try {
        const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
        const docClient = await getDynamoDocClient();
        await docClient.send(new PutCommand({
            TableName: LEDGER_TABLE,
            Item: {
                userId: userId || 'farmer_001',
                timestamp: new Date().toISOString(),
                type,
                title,
                details
            }
        }));
        console.log(`Saved ledger entry: ${type}`);
    } catch (err) {
        console.error('Failed to save to ledger:', err);
    }
};

const handleLedgerGet = async (query) => {
    try {
        const userId = query.userId || 'farmer_001';
        const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
        const docClient = await getDynamoDocClient();
        const data = await docClient.send(new QueryCommand({
            TableName: LEDGER_TABLE,
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': userId },
            ScanIndexForward: false // latest first
        }));
        return ok({ entries: data.Items || [] });
    } catch (err) {
        console.error('Ledger error:', err);
        return err(500, 'Failed to fetch ledger');
    }
};

const handleLedgerPost = async (body) => {
    try {
        const { userId, type, details, title } = body;
        if (!type || !title) return err(400, "Missing type or title");

        await saveLedgerEntry(userId, type, details, title);
        return ok({ success: true });
    } catch (err) {
        console.error('Ledger POST error:', err);
        return err(500, 'Failed to save to ledger');
    }
};

// ═══════════════════════════════════════════════════════════════
// GEMINI AI — Primary LLM (replaces Bedrock)
// ═══════════════════════════════════════════════════════════════

const callGeminiLLM = async (systemPrompt, userMessage, imageUrl = null, temperature = 0.3) => {
    const apiKey = env('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const prompt = `${systemPrompt}\n\n${userMessage}`;

    // Build parts — include image inline if provided (base64 data URL or raw base64)
    const parts = [];
    if (imageUrl) {
        // Support both "data:image/jpeg;base64,..." and raw base64
        const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
        }
    }
    parts.push({ text: prompt });

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature, maxOutputTokens: 4096 },
            }),
        }
    );

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown');
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    console.log('Gemini inference successful: gemini-2.5-flash-lite', imageUrl ? '(multimodal)' : '(text-only)');
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// ─── Remediation Agent ─────────────────────────────────────────

const handleRemediationAgent = async (body) => {
    const { diseases, cropType, location, imageUrl } = body;
    if (!diseases?.length) return err(400, 'diseases array required');

    // ── Server-side Guardrail: Confidence Threshold ──
    const avgConf = diseases.reduce((s, d) => s + (d.confidence || 0), 0) / diseases.length;
    const minConf = Math.min(...diseases.map(d => d.confidence || 0));
    if (minConf < 0.30) {
        return err(422, JSON.stringify({
            guardrail: 'LOW_CONFIDENCE',
            message: `Detection confidence too low (${(minConf * 100).toFixed(1)}%). Agent refuses to act on unreliable detections.`,
            suggestedAction: 'Retake the photo in better lighting, focusing on the most affected leaf.',
            avgConfidence: avgConf,
            minConfidence: minConf,
        }));
    }

    // ── Server-side Guardrail: Input Sanitization ──
    if (cropType && cropType.length > 100) {
        return err(400, 'cropType exceeds maximum length');
    }
    const injectionPatterns = [/ignore\s+(previous|all)\s+instructions/i, /system\s*prompt/i, /<script/i];
    for (const p of injectionPatterns) {
        if (p.test(cropType || '') || diseases.some(d => p.test(d.class_name || ''))) {
            return err(400, 'Invalid input detected');
        }
    }

    // ── Server-side Guardrail: Coordinate Validation ──
    if (location) {
        const { lat, lng } = location;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return err(400, 'Invalid coordinates: lat must be -90 to 90, lng must be -180 to 180');
        }
    }

    const systemPrompt = `You are the KisanMitra Remediation Agent — an expert agricultural AI for Indian farmers. Analyze disease detection results and recommend specific treatments.
RULES: Respond in valid JSON only. Prioritize ORGANIC treatments. Include specific product names available in Indian agri-markets. Provide dosages, application methods, timing. Include urgency level.`;

    const userMessage = `Disease detection for crop: ${cropType || 'General'}
Location: ${location ? `Lat ${location.lat}, Lon ${location.lng}` : 'Not specified'}
Detected diseases:
${diseases.map((d, i) => `${i + 1}. ${d.class_name} (Confidence: ${(d.confidence * 100).toFixed(1)}%)`).join('\n')}

Respond in JSON:
{
  "analysis": {"severity":"low|medium|high|critical","urgency":"immediate|within_24h|within_week|monitoring","summary":"Brief summary"},
  "treatments": [{"disease":"name","treatment_name":"product name","type":"organic|chemical|biological","active_ingredient":"ingredient","dosage":"dosage","application_method":"how","frequency":"frequency","estimated_cost_inr":500,"availability":"widely_available|specialized_store|online","ondc_search_query":"search query for ONDC"}],
  "preventive_measures": ["measure1"],
  "monitoring_advice": "what to watch"
}`;

    const raw = await callGeminiLLM(systemPrompt, userMessage, imageUrl || null);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        if (derivedPricing) {
            return ok({
                result: {
                    market_analysis: {
                        current_avg_price: derivedPricing.pricing.current_avg_price,
                        price_trend: 'stable',
                        demand_level: 'moderate',
                        best_time_to_sell: 'Use current market window and compare nearby mandis.',
                        summary: 'Pricing derived from live market prices.',
                    },
                    pricing_strategy: {
                        minimum_acceptable_price: derivedPricing.pricing.minimum_acceptable_price,
                        target_price: derivedPricing.pricing.target_price,
                        premium_price: derivedPricing.pricing.premium_price,
                        justification: 'Derived from live market prices and crop quality.',
                    },
                    potential_buyers: [],
                    negotiation_tips: [],
                    logistics_advice: { packaging: 'Standard gunny bags', transport: 'Local transport', estimated_logistics_cost: 500 },
                    _pricing_source: 'market_prices_fallback',
                    _pricing_stats: derivedPricing.stats,
                },
                rawResponse: raw,
                aiProvider: 'fallback',
            });
        }
        return err(500, 'Failed to parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // ── Post-analysis Guardrail: Critical Severity Escalation ──
    const severity = result.analysis?.severity;
    const escalationFlag = severity === 'critical' ? {
        escalate: true,
        reason: 'CRITICAL_SEVERITY',
        message: 'Critical disease severity detected. Immediate expert consultation recommended.',
        helpline: '1800-180-1551 (KVK Toll-Free)',
    } : null;

    // Save to digital ledger with guardrail metadata
    await saveLedgerEntry(
        body.userId || 'farmer_001',
        'DISEASE_ANALYSIS',
        {
            cropType, diseases, severity,
            avgConfidence: avgConf,
            guardrailsPassed: true,
            escalated: !!escalationFlag,
        },
        `Disease Analysis for ${cropType || 'Crop'}`
    );

    return ok({ result, rawResponse: raw, aiProvider: 'gemini', escalation: escalationFlag, guardrails: { confidenceCheck: 'passed', avgConfidence: avgConf } });
};

// ─── Sales Agent ───────────────────────────────────────────────

const handleSalesAgent = async (body) => {
    const { cropType, quantity, unit, quality, location, marketPrices } = body;
    if (!cropType || !quantity) return err(400, 'cropType and quantity required');

    // ── Server-side Guardrail: Input Validation ──
    if (typeof quantity !== 'number' && isNaN(parseFloat(quantity))) {
        return err(400, 'quantity must be a valid number');
    }
    const qty = parseFloat(quantity);
    if (qty <= 0 || qty > 100000) {
        return err(400, 'quantity must be between 1 and 100,000 quintals');
    }
    if (cropType.length > 100) {
        return err(400, 'cropType exceeds maximum length');
    }

    // ── Server-side Guardrail: Coordinate Validation ──
    if (location) {
        const { lat, lng } = location;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return err(400, 'Invalid coordinates');
        }
    }

    const computeMarketStats = (prices) => {
        const nums = (prices || [])
            .map(p => Number(p.modalPrice))
            .filter(n => Number.isFinite(n) && n > 0);
        if (!nums.length) return null;
        nums.sort((a, b) => a - b);
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = sum / nums.length;
        const mid = Math.floor(nums.length / 2);
        const median = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        return { avg, median, min: nums[0], max: nums[nums.length - 1], count: nums.length };
    };

    const getQualityMultiplier = (q) => {
        const v = String(q || '').toLowerCase();
        if (v.includes('premium') || v.includes('grade a')) return 1.08;
        if (v.includes('average') || v.includes('grade b')) return 0.92;
        if (v.includes('mixed')) return 0.95;
        return 1.0; // Standard (FAQ)
    };

    const derivePricingFromMarket = (prices, q) => {
        const stats = computeMarketStats(prices);
        if (!stats) return null;
        const base = stats.median || stats.avg;
        const qMul = getQualityMultiplier(q);
        const currentAvg = Math.round(base);
        const minimum = Math.max(1, Math.round(base * qMul * 0.9));
        let target = Math.round(base * qMul * 1.05);
        if (target < minimum) target = Math.round(minimum * 1.05);
        const premium = Math.round(base * qMul * 1.18);
        return {
            stats,
            pricing: {
                current_avg_price: currentAvg,
                minimum_acceptable_price: minimum,
                target_price: target,
                premium_price: premium,
                quality_multiplier: qMul,
            },
        };
    };

    const derivedPricing = derivePricingFromMarket(marketPrices, quality);

    const priceCtx = marketPrices?.length
        ? `\nCurrent market prices:\n${marketPrices.map(p => `- ${p.market}: ₹${p.modalPrice}/quintal`).join('\n')}`
        : '';

    const systemPrompt = `You are the KisanMitra Sales Negotiation Agent for Indian farmers. Analyze market conditions and create negotiation strategies.
RULES: Respond in valid JSON only. Use realistic Indian market prices (INR per quintal). Consider seasonal variations and regional demand.`;

    const userMessage = `Farmer wants to sell:
- Crop: ${cropType}
- Quantity: ${quantity} ${unit || 'quintals'}
- Quality: ${quality || 'Standard'}
- Location: ${location ? `Lat ${location.lat}, Lon ${location.lng}` : 'Not specified'}
${priceCtx}

Respond in JSON:
{
  "market_analysis": {"current_avg_price":2500,"price_trend":"rising|stable|falling","demand_level":"high|moderate|low","best_time_to_sell":"description","summary":"Brief summary"},
  "pricing_strategy": {"minimum_acceptable_price":2200,"target_price":2800,"premium_price":3200,"justification":"why"},
  "potential_buyers": [{"buyer_type":"mandi_trader|fpo|processor|exporter|retailer","description":"desc","expected_price_range":{"min":2200,"max":2800},"pros":["pro"],"cons":["con"],"ondc_search_query":"search query"}],
  "negotiation_tips": ["tip1"],
  "logistics_advice": {"packaging":"rec","transport":"rec","estimated_logistics_cost":500}
}`;

    const raw = await callGeminiLLM(systemPrompt, userMessage);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err(500, 'Failed to parse AI response');

    const result = JSON.parse(jsonMatch[0]);

    // ── Post-LLM Guardrail: Sanity check pricing ──
    const minPrice = result.pricing_strategy?.minimum_acceptable_price;
    const targetPrice = result.pricing_strategy?.target_price;
    if (minPrice && targetPrice && targetPrice < minPrice) {
        result.pricing_strategy.target_price = Math.ceil(minPrice * 1.1);
        result._guardrail_note = 'Target price was below minimum — corrected to 110% of minimum.';
    }

    if (derivedPricing) {
        result.market_analysis = {
            ...(result.market_analysis || {}),
            current_avg_price: derivedPricing.pricing.current_avg_price,
        };
        result.pricing_strategy = {
            ...(result.pricing_strategy || {}),
            minimum_acceptable_price: derivedPricing.pricing.minimum_acceptable_price,
            target_price: derivedPricing.pricing.target_price,
            premium_price: derivedPricing.pricing.premium_price,
            justification: result.pricing_strategy?.justification || 'Derived from live market prices and crop quality.',
        };
        result._pricing_source = 'market_prices';
        result._pricing_stats = derivedPricing.stats;
    }

    return ok({ result, rawResponse: raw, aiProvider: 'gemini' });
};

// ─── Negotiation Round ─────────────────────────────────────────

const handleNegotiation = async (body) => {
    const { cropType, quantity, buyerOffer, targetPrice, minimumPrice, roundNumber, previousOffers } = body;
    const safeBuyerOffer = Number(buyerOffer);
    const safeMin = Number(minimumPrice);
    const safeTarget = Number(targetPrice);
    const effectiveMin = Number.isFinite(safeMin) && safeMin > 0 ? safeMin : Math.max(1, safeBuyerOffer * 0.8);
    let effectiveTarget = Number.isFinite(safeTarget) && safeTarget > 0 ? safeTarget : Math.ceil(effectiveMin * 1.1);
    if (effectiveTarget < effectiveMin) effectiveTarget = Math.ceil(effectiveMin * 1.1);

    // ── Server-side Guardrail: Price Floor (HARD BLOCK) ──
    if (buyerOffer !== undefined && minimumPrice !== undefined) {
        if (buyerOffer < minimumPrice) {
            // Log the guardrail block to ledger
            await saveLedgerEntry(
                body.userId || 'farmer_001',
                'GUARDRAIL_BLOCK',
                { reason: 'BELOW_MINIMUM_PRICE', buyerOffer, minimumPrice, cropType, roundNumber },
                `Guardrail: Blocked offer ₹${buyerOffer} below minimum ₹${minimumPrice}`
            );
            // Return a forced reject — agent NEVER accepts below minimum
            return ok({
                result: {
                    decision: 'reject',
                    counter_offer: Math.ceil(minimumPrice * 1.05),
                    reasoning: `GUARDRAIL ENFORCED: Buyer offer ₹${buyerOffer}/quintal is below the farmer's minimum price of ₹${minimumPrice}/quintal. This offer cannot be accepted under any circumstances.`,
                    message_to_buyer: `We appreciate your offer, but ₹${buyerOffer}/quintal is below our minimum acceptable price. Our counter-offer is ₹${Math.ceil(minimumPrice * 1.05)}/quintal.`,
                    confidence: 1.0,
                    guardrail: 'PRICE_FLOOR_ENFORCED',
                },
                guardrailTriggered: true,
                aiProvider: 'guardrail',
            });
        }
    }

    // ── Server-side Guardrail: Auto-accept if offer meets/exceeds target ──
    if (Number.isFinite(safeBuyerOffer) && safeBuyerOffer >= effectiveTarget) {
        await saveLedgerEntry(
            body.userId || 'farmer_001',
            'NEGOTIATION_ACCEPTED',
            { cropType, quantity, finalPrice: safeBuyerOffer, roundNumber, guardrailsPassed: true },
            `Sold ${quantity} quintals of ${cropType} for ₹${safeBuyerOffer}/q`
        );
        return ok({
            result: {
                decision: 'accept',
                reasoning: `Offer ₹${safeBuyerOffer}/quintal meets or exceeds the target price ₹${effectiveTarget}/quintal. Accepting in the farmer's favor.`,
                message_to_buyer: `Your offer of ₹${safeBuyerOffer}/quintal meets our target. We accept.`,
                confidence: 0.99,
                guardrail: 'OFFER_AT_OR_ABOVE_TARGET_ACCEPTED',
            },
            guardrailTriggered: true,
            aiProvider: 'guardrail',
        });
    }

    // ── Server-side Guardrail: Max Rounds (Escalation) ──
    if (roundNumber > 5) {
        await saveLedgerEntry(
            body.userId || 'farmer_001',
            'GUARDRAIL_ESCALATE',
            { reason: 'MAX_ROUNDS_EXCEEDED', roundNumber, cropType },
            `Guardrail: Negotiation escalated after ${roundNumber} rounds`
        );
        return ok({
            result: {
                decision: 'escalate',
                reasoning: `Negotiation has exceeded 5 rounds without resolution. Agent recommends direct farmer-buyer discussion or seeking alternative buyers on ONDC.`,
                message_to_buyer: 'We suggest a direct conversation to resolve the price difference.',
                confidence: 0.5,
                guardrail: 'MAX_ROUNDS_ESCALATION',
            },
            guardrailTriggered: true,
            aiProvider: 'guardrail',
        });
    }

    const systemPrompt = `You are the KisanMitra Sales Negotiation Agent acting exclusively on behalf of the FARMER (SELLER). Your job is to get the HIGHEST possible price for the farmer's crop.
RULES:
- Respond in valid JSON only.
- You are the SELLER's agent. The buyer wants to pay LESS; you want to get MORE.
- Never accept below minimum price.
- If the buyer's offer is already at or above the target price, ACCEPT immediately.
- If the buyer's offer is between minimum and target, counter with a price HIGHER than the buyer's offer (closer to target).
- counter_offer must ALWAYS be >= minimum price AND >= buyer's current offer when countering.
- Never counter with a price LOWER than the buyer's current offer — that would be negotiating against the farmer.`;

    const historyStr = (previousOffers || []).map(o =>
        `Round ${o.round}: Buyer offered ₹${o.buyerOffer} → Farmer's agent countered ₹${o.counterOffer || 'N/A'}`
    ).join('\n');

    const userMessage = `Negotiation for ${quantity} quintals of ${cropType} (FARMER IS SELLING):
- Farmer's target price: ₹${effectiveTarget}/quintal (ideal)
- Farmer's minimum price: ₹${effectiveMin}/quintal (hard floor — never go below)
- Buyer's current offer: ₹${buyerOffer}/quintal (buyer wants to pay this)
- Round: ${roundNumber}
History:
${historyStr || 'First round'}

Your counter_offer must be BETWEEN ₹${buyerOffer} and ₹${effectiveTarget} (or accept if offer >= target).
Respond in JSON: {"decision":"accept|counter|reject","counter_offer":${Math.ceil((buyerOffer + effectiveTarget) / 2)},"reasoning":"why this counter helps the farmer","message_to_buyer":"professional message","confidence":0.85}`;

    const raw = await callGeminiLLM(systemPrompt, userMessage, 0.2);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return err(500, 'Failed to parse negotiation response');

    const result = JSON.parse(jsonMatch[0]);

    // ── Post-LLM Guardrail: Verify AI didn't accept below minimum ──
    if (result.decision === 'accept' && buyerOffer < minimumPrice) {
        result.decision = 'reject';
        result.reasoning = `GUARDRAIL OVERRIDE: AI attempted to accept ₹${buyerOffer} which is below minimum ₹${minimumPrice}. Decision overridden to reject.`;
        result.guardrail = 'POST_LLM_PRICE_FLOOR_OVERRIDE';
    }

    // ── Post-LLM Guardrail: Counter-offer must never be LOWER than buyer's offer ──
    // (that would mean negotiating against the farmer)
    if (result.decision === 'counter' && result.counter_offer !== undefined) {
        if (result.counter_offer < buyerOffer) {
            result.counter_offer = Math.ceil((buyerOffer + effectiveTarget) / 2);
            result.reasoning += ` [GUARDRAIL: counter was below buyer offer — corrected to midpoint ₹${result.counter_offer}]`;
            result.guardrail = 'COUNTER_BELOW_BUYER_OFFER_CORRECTED';
        }
        if (result.counter_offer < minimumPrice) {
            result.counter_offer = Math.ceil(effectiveMin * 1.05);
            result.reasoning += ` [GUARDRAIL: counter was below minimum — corrected to ₹${result.counter_offer}]`;
            result.guardrail = 'COUNTER_BELOW_MINIMUM_CORRECTED';
        }
    }

    // If the agent accepted the deal, log it
    if (result.decision === 'accept') {
        await saveLedgerEntry(
            body.userId || 'farmer_001',
            'NEGOTIATION_ACCEPTED',
            { cropType, quantity, finalPrice: buyerOffer, roundNumber, guardrailsPassed: true },
            `Sold ${quantity} quintals of ${cropType} for ₹${buyerOffer}/q`
        );
    }

    return ok({ result, rawResponse: raw, aiProvider: 'gemini' });
};

// ═══════════════════════════════════════════════════════════════
// ONDC SANDBOX — Beckn Protocol Integration
// ═══════════════════════════════════════════════════════════════

const ONDC_GATEWAY = env('ONDC_GATEWAY_URL') || 'https://staging.gateway.proteantech.in';
const ONDC_MOCK = env('ONDC_MOCK_URL');
const BAP_ID = env('BAP_ID') || 'kisanmitra.ondc.org';
const BAP_URI = env('BAP_URI');
const DOMAIN_AGRI_INPUT = 'ONDC:AGR10';
const DOMAIN_AGRI_OUTPUT = 'ONDC:AGR11';

const genTxnId = () => `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
const genMsgId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

const buildContext = (action, domain, transactionId) => ({
    domain,
    country: 'IND',
    city: 'std:080',
    action,
    core_version: '1.2.0',
    bap_id: BAP_ID,
    bap_uri: BAP_URI,
    transaction_id: transactionId || genTxnId(),
    message_id: genMsgId(),
    timestamp: new Date().toISOString(),
    ttl: 'PT30S',
});

const handleONDCSearch = async (body) => {
    const { searchQuery, domain, location, searchType } = body;
    const txnId = genTxnId();
    const domainCode = domain || (searchType === 'buyers' ? DOMAIN_AGRI_OUTPUT : DOMAIN_AGRI_INPUT);

    const payload = {
        context: buildContext('search', domainCode, txnId),
        message: {
            intent: {
                item: { descriptor: { name: searchQuery || '' } },
                ...(location && {
                    fulfillment: {
                        type: searchType === 'buyers' ? 'Seller-Fulfilled' : 'Delivery',
                        [searchType === 'buyers' ? 'start' : 'end']: {
                            location: { gps: `${location.lat},${location.lng}`, area_code: '560001' },
                        },
                    },
                }),
            },
        },
    };

    // Try real ONDC gateway first
    try {
        const res = await fetch(`${ONDC_GATEWAY}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            const data = await res.json();
            return ok({ transaction_id: txnId, data, source: 'ondc_gateway' });
        }
    } catch (e) { console.warn('ONDC gateway error:', e.message); }

    // Try ONDC Mock Playground (deployed on EB) — full lifecycle
    try {
        // Pick session based on search type
        const sessionId = searchType === 'buyers'
            ? 'kisanmitra-agri-output-session' : 'kisanmitra-agri-input-session';
        const flowId = searchType === 'buyers'
            ? 'agri-output-sell-flow' : 'agri-input-search-flow';
        const sessionTxnId = searchType === 'buyers'
            ? 'txn_kisanmitra_agri_002' : 'txn_kisanmitra_agri_001';

        const mockBase = `${ONDC_MOCK}/mock/playground`;

        // Step 1: Initialize the flow
        const initRes = await fetch(`${mockBase}/flows/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                flow_id: flowId,
                transaction_id: sessionTxnId,
                inputs: { search_query: searchQuery || 'agricultural products' },
            }),
        });
        const initData = await initRes.json();
        console.log('ONDC mock flow init:', JSON.stringify(initData));

        // Step 2: Send the search action
        const searchPayload = {
            context: {
                ...payload.context,
                transaction_id: sessionTxnId,
                bap_uri: BAP_URI,
            },
            message: payload.message,
        };

        await fetch(`${mockBase}/manual/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchPayload),
        });

        // Step 3: Wait a moment for mock to process on_search
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Step 4: Fetch the populated catalog from flow status
        const statusRes = await fetch(`${mockBase}/flows/current-status?transaction_id=${sessionTxnId}&session_id=${sessionId}`, {
            method: 'GET'
        });
        const statusData = await statusRes.json();
        let rawRefData = statusData.reference_data || {};
        let refData = rawRefData.catalog_form || rawRefData;

        // Ensure refData values are arrays of objects and strip empty keys
        const allProducts = Array.isArray(refData) ? refData : Object.values(refData).filter(i => typeof i === 'object');

        // Filter products to only those matching the search query (crop type)
        const queryLower = (searchQuery || '').toLowerCase();
        const productList = queryLower
            ? allProducts.filter(item => {
                const name = (item.name || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                return name.includes(queryLower) || desc.includes(queryLower);
              })
            : allProducts;

        // Emulate an on_search ONDC response by wrapping reference_data products
        const onSearchResponse = {
            context: searchPayload.context,
            message: {
                catalog: {
                    "bpp/providers": [
                        {
                            id: "mock_provider_1",
                            descriptor: { name: "ONDC Agri Provider" },
                            items: productList.map((item, idx) => ({
                                id: item.id || `item_${idx}`,
                                descriptor: { name: item.name || "Agri Product", short_desc: item.description || "High quality agricultural input" },
                                price: { value: item.price || "100", currency: "INR" }
                            }))
                        }
                    ]
                }
            }
        };

        if (statusData.data && Object.keys(refData).length === 0) {
            console.log('ONDC mock status empty reference_data:', JSON.stringify(statusData));
        }

        return ok({ transaction_id: sessionTxnId, data: [onSearchResponse], source: 'ondc_mock_playground' });
    } catch (e) {
        console.warn('ONDC mock playground error:', e.message);
    }

    // Return structured fallback with realistic ONDC format data
    const fallbackData = searchType === 'buyers'
        ? generateBuyerFallback(searchQuery, txnId, body.quantity, body.unit)
        : generateTreatmentFallback(searchQuery, txnId);

    return ok({ transaction_id: txnId, data: fallbackData, source: 'ondc_format_catalog' });
};

const handleONDCSelect = async (body) => {
    const { transactionId, providerId, itemId, quantity } = body;
    const payload = {
        context: buildContext('select', DOMAIN_AGRI_INPUT, transactionId),
        message: { order: { provider: { id: providerId }, items: [{ id: itemId, quantity: { count: quantity || 1 } }] } },
    };

    try {
        const res = await fetch(`${ONDC_GATEWAY}/select`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) return ok({ data: await res.json(), source: 'ondc_gateway' });
    } catch (e) { /* fallback */ }

    return ok({
        data: {
            context: buildContext('on_select', DOMAIN_AGRI_INPUT, transactionId),
            message: { order: { provider: { id: providerId }, items: [{ id: itemId, quantity: { count: quantity || 1 } }], quote: { price: { currency: 'INR', value: '500' }, breakup: [{ title: 'Item', price: { currency: 'INR', value: '450' } }, { title: 'Delivery', price: { currency: 'INR', value: '50' } }] } } },
        },
        source: 'ondc_format_catalog',
    });
};

const handleONDCConfirm = async (body) => {
    const { transactionId, providerId, itemId, quantity, paymentMethod } = body;
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const payload = {
        context: buildContext('confirm', DOMAIN_AGRI_INPUT, transactionId),
        message: {
            order: {
                id: orderId,
                provider: { id: providerId },
                items: [{ id: itemId, quantity: { count: quantity || 1 } }],
                payment: { type: paymentMethod || 'ON-FULFILLMENT', status: paymentMethod === 'PRE-PAID' ? 'PAID' : 'NOT-PAID' },
            },
        },
    };

    try {
        const res = await fetch(`${ONDC_GATEWAY}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            const data = await res.json();
            saveLedgerEntry(body.userId || 'farmer_001', 'ONDC_ORDER', { orderId, providerId, itemId, quantity, providerSource: 'gateway' }, `Placed ONDC Order ${orderId}`);
            return ok({ order_id: orderId, data, source: 'ondc_gateway' });
        }
    } catch (e) { /* fallback */ }

    saveLedgerEntry(body.userId || 'farmer_001', 'ONDC_ORDER', { orderId, providerId, itemId, quantity, providerSource: 'mock' }, `Placed ONDC Order ${orderId}`);

    return ok({
        order_id: orderId,
        transaction_id: transactionId,
        status: 'confirmed',
        fulfillment_status: 'Order Confirmed — Delivery in 2-3 days',
        source: 'ondc_format_catalog',
    });
};

// ─── ONDC Fallback Data Generators ─────────────────────────────

const generateTreatmentFallback = (query, txnId) => {
    const q = (query || '').toLowerCase();
    const providers = [
        {
            id: 'bpp_agri_001', name: 'Krishi Seva Kendra (ONDC)', rating: '4.3',
            location: { city: 'Jaipur', state: 'Rajasthan' },
            items: [
                { id: 'item_f001', name: 'Neem Oil (Organic Fungicide) — 500ml', description: 'Cold-pressed neem oil for organic fungal disease control', price: { currency: 'INR', value: '280' }, quantity: { available: 150, unit: 'bottle' }, category: 'Organic Fungicide', fulfillment: { type: 'Delivery', estimated_delivery: '2-3 days' } },
                { id: 'item_f002', name: 'Trichoderma Viride (Bio-fungicide) — 1kg', description: 'Biological fungicide for soil-borne diseases', price: { currency: 'INR', value: '350' }, quantity: { available: 75, unit: 'kg' }, category: 'Bio-fungicide', fulfillment: { type: 'Delivery', estimated_delivery: '2-3 days' } },
                { id: 'item_f003', name: 'Copper Oxychloride 50% WP — 500g', description: 'Contact fungicide for blights and leaf spots', price: { currency: 'INR', value: '220' }, quantity: { available: 200, unit: 'pack' }, category: 'Fungicide', fulfillment: { type: 'Delivery', estimated_delivery: '1-2 days' } },
            ],
        },
        {
            id: 'bpp_agri_002', name: 'AgriMart India (ONDC)', rating: '4.5',
            location: { city: 'Delhi', state: 'Delhi NCR' },
            items: [
                { id: 'item_f004', name: 'Pseudomonas Fluorescens — 1L', description: 'Bio-control agent for fungal and bacterial diseases', price: { currency: 'INR', value: '420' }, quantity: { available: 50, unit: 'litre' }, category: 'Bio-fungicide', fulfillment: { type: 'Delivery', estimated_delivery: '3-4 days' } },
                { id: 'item_f005', name: 'Mancozeb 75% WP — 500g', description: 'Broad-spectrum contact fungicide', price: { currency: 'INR', value: '195' }, quantity: { available: 300, unit: 'pack' }, category: 'Fungicide', fulfillment: { type: 'Delivery', estimated_delivery: '2-3 days' } },
            ],
        },
        {
            id: 'bpp_agri_003', name: 'Organic Agri Store (ONDC)', rating: '4.6',
            location: { city: 'Pune', state: 'Maharashtra' },
            items: [
                { id: 'item_p001', name: 'Panchagavya (Organic Pesticide) — 5L', description: 'Traditional organic pest repellent', price: { currency: 'INR', value: '450' }, quantity: { available: 80, unit: 'can' }, category: 'Organic Pesticide', fulfillment: { type: 'Delivery', estimated_delivery: '2-3 days' } },
                { id: 'item_p002', name: 'Beauveria Bassiana — 1kg', description: 'Bio-pesticide for whiteflies, aphids, thrips', price: { currency: 'INR', value: '380' }, quantity: { available: 60, unit: 'kg' }, category: 'Bio-pesticide', fulfillment: { type: 'Delivery', estimated_delivery: '3-4 days' } },
            ],
        },
    ];
    return { context: buildContext('on_search', DOMAIN_AGRI_INPUT, txnId), message: { catalog: { 'bpp/providers': providers } } };
};

const generateBuyerFallback = (produceType, txnId, quantity, unit) => {
    const basePrices = { wheat: 2500, rice: 2800, cotton: 7500, sugarcane: 350, maize: 2200, onion: 3500, tomato: 4000, potato: 1800, mustard: 5500, soyabean: 4800 };
    const base = basePrices[(produceType || '').toLowerCase()] || 3000;
    const v = () => Math.floor(base * (0.85 + Math.random() * 0.3));

    const buyers = [
        { id: 'buyer_001', name: 'AgriTrade FPO (ONDC)', rating: '4.5', location: { city: 'Delhi', state: 'Delhi NCR' }, items: [{ id: 'bid_001', name: `Buying: ${produceType} (Grade A)`, description: `Direct purchase. ${quantity || ''} ${unit || 'quintals'}`, price: { currency: 'INR', value: `${v()}` }, category: 'Buyer Bid', fulfillment: { type: 'Seller-Fulfilled', estimated_delivery: 'Pickup in 3-5 days' } }] },
        { id: 'buyer_002', name: 'Kisan Mandi Wholesale (ONDC)', rating: '4.2', location: { city: 'Mumbai', state: 'Maharashtra' }, items: [{ id: 'bid_002', name: `Buying: ${produceType} (FAQ)`, description: 'Wholesale buyer. Quick UPI payment.', price: { currency: 'INR', value: `${v()}` }, category: 'Buyer Bid', fulfillment: { type: 'Seller-Fulfilled', estimated_delivery: 'Pickup in 2-4 days' } }] },
        { id: 'buyer_003', name: 'Fresh Harvest Exports (ONDC)', rating: '4.7', location: { city: 'Chennai', state: 'Tamil Nadu' }, items: [{ id: 'bid_003', name: `Buying: Premium ${produceType}`, description: 'Export-quality required. Premium rates.', price: { currency: 'INR', value: `${Math.floor(base * 1.15)}` }, category: 'Buyer Bid', fulfillment: { type: 'Seller-Fulfilled', estimated_delivery: 'Pickup in 5-7 days' } }] },
        { id: 'buyer_004', name: 'Village Cooperative (ONDC)', rating: '4.0', location: { city: 'Lucknow', state: 'UP' }, items: [{ id: 'bid_004', name: `Buying: ${produceType} (All Grades)`, description: 'Immediate payment. No commission.', price: { currency: 'INR', value: `${v()}` }, category: 'Buyer Bid', fulfillment: { type: 'Seller-Fulfilled', estimated_delivery: 'Pickup in 1-2 days' } }] },
    ];
    return { context: buildContext('on_search', DOMAIN_AGRI_OUTPUT, txnId), message: { catalog: { 'bpp/providers': buyers } } };
};

// ═══════════════════════════════════════════════════════════════
// GEMINI AI — Chat, Tasks, Treatment, Video Analysis
// ═══════════════════════════════════════════════════════════════

const callGemini = async (prompt, model = 'gemini-2.5-flash-lite') => {
    const apiKey = env('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
        }
    );

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown');
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const callGeminiMultimodal = async (base64Data, mimeType, prompt, model = 'gemini-2.5-flash-lite') => {
    const apiKey = env('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType, data: base64Data } },
                        { text: prompt },
                    ],
                }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
        }
    );

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown');
        throw new Error(`Gemini multimodal error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const getSeason = (month) => {
    if (month >= 2 && month <= 5) return 'Summer (Zaid)';
    if (month >= 6 && month <= 9) return 'Monsoon (Kharif)';
    return 'Winter (Rabi)';
};

const sanitizePlainText = (input) => {
    if (!input) return '';
    let text = String(input);

    // Strip fenced code blocks and inline code markers
    text = text.replace(/```[\s\S]*?```/g, ' ');
    text = text.replace(/`([^`]+)`/g, '$1');

    // Strip markdown links: [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove markdown formatting characters and list markers
    text = text.replace(/^\s*[#>*-]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');
    text = text.replace(/[*_~]/g, '');

    // Remove bracketed text: (), [], {}
    text = text.replace(/\([^)]*\)/g, ' ');
    text = text.replace(/\[[^\]]*]/g, ' ');
    text = text.replace(/\{[^}]*}/g, ' ');

    // Remove emojis and variation selectors
    text = text.replace(/[\p{Extended_Pictographic}]/gu, '');
    text = text.replace(/[\uFE0F\u200D]/g, '');

    // Remove exclamation marks as requested
    text = text.replace(/!/g, '');

    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
};

const shortenResponse = (text, maxSentences = 2, maxWords = 70) => {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;

    const sentences = text.split(/(?<=[.?])\s+/);
    if (sentences.length > 1) {
        return sentences.slice(0, maxSentences).join(' ').trim();
    }

    return words.slice(0, maxWords).join(' ').trim();
};

const handleGeminiChat = async (body) => {
    const { message, context } = body;
    if (!message) return err(400, 'message required');

    const season = getSeason(new Date().getMonth());

    const systemPrompt = `You are KisanMitra AI, an ORGANIC FARMING expert for Indian farmers.

YOUR MISSION: Promote sustainable, chemical-free agriculture.
ALWAYS PRIORITIZE ORGANIC METHODS:
1. Pest Control: Neem oil, panchagavya, botanical extracts, companion planting
2. Fertilizers: Compost, vermicompost, FYM, green manure, biofertilizers
3. Disease Management: Trichoderma, pseudomonas, organic copper fungicides
4. Traditional Wisdom: Panchagavya, Jeevamrut, Amrit Pani, Beejamrut

RESPONSE RULES:
- Keep it short: 2-3 brief sentences, max ~60 words.
- Plain text only: no markdown, no bullet lists, no emojis.
- Do not include any bracketed text like (...) or [...] or {..}.

CURRENT SEASON: ${season}
DATE: ${new Date().toLocaleDateString('en-IN')}`;

    const userMessage = `${(context || []).length > 0 ? `Previous conversation:\n${context.join('\n')}\n\n` : ''}Farmer's question: ${message}

Provide practical, organic farming advice in simple language with Indian context.`;

    // Use Gemini 2.0 Flash Lite for chat responses
    const raw = await callGeminiLLM(systemPrompt, userMessage, 0.7);
    const cleaned = shortenResponse(sanitizePlainText(raw));
    return ok({ response: cleaned });
};

const handleGeminiTasks = async (body) => {
    const { userData, soilData, weather, forecast, ndviData } = body;

    // Support both old SoilGrids shape and new data.gov.in shape
    const layers = soilData?.properties?.layers || [];
    const ph = layers.find(l => l.name === 'phh2o')?.depths?.[0]?.values?.mean;
    const nitrogen = layers.find(l => l.name === 'nitrogen')?.depths?.[0]?.values?.mean;
    const clay = layers.find(l => l.name === 'clay')?.depths?.[0]?.values?.mean;
    const sand = layers.find(l => l.name === 'sand')?.depths?.[0]?.values?.mean;
    const soc = layers.find(l => l.name === 'soc')?.depths?.[0]?.values?.mean;
    const soilMoisture = soilData?.soilMoisture ?? null;
    const soilLocation = soilData?.district ? `${soilData.district}, ${soilData.state}` : null;

    const currentDate = new Date();
    const season = getSeason(currentDate.getMonth());
    const cropType = userData?.fields?.[0]?.crop || 'Not specified';

    const forecastStr = forecast?.daily?.length
        ? forecast.daily.map(d =>
            `  ${d.date}: ${d.tempMin}-${d.tempMax}°C, ${d.description}, Rain: ${d.rainMm}mm, Humidity: ${d.humidity}%, Wind: ${d.windSpeed}m/s`
          ).join('\n')
        : '  Not available';

    const prompt = `You are an ORGANIC FARMING expert for Indian farmers.

CURRENT CONTEXT:
- Date: ${currentDate.toLocaleDateString('en-IN')} (${currentDate.toLocaleDateString('en-IN', { weekday: 'long' })})
- Season: ${season}
- Crop: ${cropType}
- Field Size: ${userData?.fields?.[0]?.area?.toFixed(2) || 'N/A'} acres

SOIL DATA:
- pH: ${ph ? (ph / 10).toFixed(1) : 'N/A'}
- Nitrogen: ${nitrogen ? (nitrogen / 100).toFixed(2) : 'N/A'} g/kg
- Clay: ${clay ? (clay / 10).toFixed(0) : 'N/A'}%
- Sand: ${sand ? (sand / 10).toFixed(0) : 'N/A'}%
- Organic Carbon: ${soc ? (soc / 10).toFixed(1) : 'N/A'} g/kg
- Soil Moisture (15cm): ${soilMoisture !== null ? soilMoisture + '%' : 'N/A'}${soilLocation ? `\n- Location: ${soilLocation}` : ''}

CURRENT WEATHER:
- Temp: ${weather?.main?.temp?.toFixed(1) || 'N/A'}°C
- Humidity: ${weather?.main?.humidity || 'N/A'}%
- Conditions: ${weather?.weather?.[0]?.description || 'N/A'}
- Wind: ${weather?.wind?.speed || 'N/A'} m/s

5-DAY FORECAST:
${forecastStr}

Use the forecast to advise on timing — e.g. if rain is coming in 2 days, delay fertilizer application; if it's dry for 5 days, prioritize irrigation; if wind is high, avoid spraying.

RESPONSE FORMAT (JSON only, no markdown):
[{"title": "task name", "description": "organic method with Indian context and specific timing based on forecast", "priority": "high/medium/low", "category": "irrigation/fertilization/pest_control/harvesting/planting", "timing": "e.g. Do today before rain on Day 3"}]

Generate 5 ORGANIC farming tasks based on current season, weather, 5-day forecast, and soil conditions.`;

    try {
        const text = await callGeminiLLM('', prompt, 0.5);
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) return ok({ tasks: JSON.parse(jsonMatch[0]) });
        throw new Error('Invalid format');
    } catch {
        return ok({
            tasks: [
                { title: 'Apply Organic Compost', description: 'Enrich soil with homemade compost or vermicompost (10 kg per acre)', priority: 'high', category: 'fertilization' },
                { title: 'Prepare Neem Spray', description: 'Make organic neem oil spray (30ml neem oil + 10ml soap in 1L water)', priority: 'high', category: 'pest_control' },
                { title: 'Mulch Field', description: 'Apply organic mulch (straw or leaves) to conserve water', priority: 'medium', category: 'irrigation' },
            ],
        });
    }
};

const handleGeminiTreatment = async (body) => {
    const { diseases, confidences, cropType, location } = body;
    if (!diseases?.length) return err(400, 'diseases array required');

    const diseaseContext = diseases.map((d, i) => {
        const conf = ((confidences?.[i] || 0) * 100).toFixed(1);
        return `- ${d} (${conf}% confidence)`;
    }).join('\n');

    const locCtx = location ? `\nLOCATION: Lat ${location.lat.toFixed(4)}, Lon ${location.lng.toFixed(4)}` : '';

    const prompt = `You are an expert agricultural pathologist specializing in ORGANIC FARMING for Indian farmers.

DETECTED DISEASES:
${diseaseContext}

CROP TYPE: ${cropType || 'Not specified'}${locCtx}

Provide comprehensive ORGANIC treatment recommendations including:
1. Disease Overview
2. Immediate Organic Actions (24-48 hours)
3. Short-term Treatment (1-2 weeks) with recipes and dosages
4. Long-term Prevention
5. Organic Treatment Options (neem, botanical extracts, biocontrol agents, traditional remedies)
6. Monitoring & Follow-up

ALL recommendations must be 100% organic and chemical-free.`;

    const text = await callGemini(prompt);
    return ok({ treatment: text });
};

const handleGeminiVideo = async (body) => {
    const { base64Data, mimeType, cropType, fieldName } = body;
    if (!base64Data) return err(400, 'base64Data required');

    const prompt = `You are an expert agricultural pathologist analyzing a crop video in India.
CROP TYPE: ${cropType || 'Unknown'}
FIELD: ${fieldName || 'Unknown'}

Analyze for: overall health (0-100), diseases, pests, nutrient deficiencies, and organic recommendations.

Respond in JSON:
{"overallHealth":<0-100>,"healthStatus":"<Excellent/Good/Fair/Poor/Critical>","diseases":[{"name":"","severity":"Low/Medium/High","confidence":<0-100>,"symptoms":[""],"organicTreatment":""}],"pests":[{"name":"","severity":"","confidence":<0-100>,"organicControl":""}],"nutrientDeficiencies":[{"nutrient":"","symptoms":"","organicSolution":""}],"recommendations":[""],"detailedAnalysis":""}`;

    const text = await callGeminiMultimodal(base64Data, mimeType || 'video/mp4', prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return ok(JSON.parse(jsonMatch[0]));

    return ok({
        overallHealth: 70, healthStatus: 'Good', diseases: [], pests: [],
        nutrientDeficiencies: [], recommendations: ['Continue monitoring crop health.'],
        detailedAnalysis: text,
    });
};

// ═══════════════════════════════════════════════════════════════
// BHASHINI — Translation (Govt of India API)
// ═══════════════════════════════════════════════════════════════

let cachedBhashiniToken = null;
let bhashiniTokenExpiry = 0;
let cachedBhashiniConfigs = { asr: [], translation: [], tts: [] };

const normalizeConfigList = (cfg) => Array.isArray(cfg) ? cfg : (cfg ? [cfg] : []);

const setBhashiniConfigsFromResponse = (data) => {
    const candidates = [
        data?.pipelineResponseConfig,
        data?.pipelineResponseConfig?.pipelineTasks,
        data?.pipelineInferenceAPIEndPoint?.pipelineResponseConfig,
        data?.pipelineInferenceAPIEndPoint?.pipelineResponseConfig?.pipelineTasks,
    ];
    const list = candidates.find(Array.isArray);
    if (!list) return;

    const next = { ...cachedBhashiniConfigs };
    for (const task of list) {
        if (!task?.taskType) continue;
        next[task.taskType] = normalizeConfigList(task.config);
    }
    cachedBhashiniConfigs = next;
};

const pickBhashiniConfig = (taskType, sourceLanguage, targetLanguage) => {
    const configs = cachedBhashiniConfigs?.[taskType] || [];
    if (!configs.length) return null;
    if (taskType === 'translation') {
        return configs.find(c =>
            c?.language?.sourceLanguage === sourceLanguage &&
            c?.language?.targetLanguage === targetLanguage
        ) || null;
    }
    return configs.find(c => c?.language?.sourceLanguage === sourceLanguage) || null;
};

const listSupportedLanguages = (taskType) =>
    (cachedBhashiniConfigs?.[taskType] || [])
        .map(c => ({
            sourceLanguage: c?.language?.sourceLanguage,
            targetLanguage: c?.language?.targetLanguage,
            supportedVoices: c?.supportedVoices
        }))
        .filter(c => c.sourceLanguage);

const getBhashiniToken = async () => {
    if (cachedBhashiniToken && Date.now() < bhashiniTokenExpiry) return cachedBhashiniToken;

    const apiKey = env('BHASHINI_API_KEY');
    const userId = env('BHASHINI_USER_ID');
    const pipelineId = env('BHASHINI_PIPELINE_ID') || '64392f96daac500b55c543cd';

    if (!apiKey || !userId) throw new Error('BHASHINI credentials not configured');

    const res = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
        method: 'POST',
        headers: { 'ulcaApiKey': apiKey, 'userID': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pipelineTasks: [{ taskType: 'asr' }, { taskType: 'translation' }, { taskType: 'tts' }],
            pipelineRequestConfig: { pipelineId },
        }),
    });

    if (!res.ok) throw new Error(`Bhashini auth failed (${res.status})`);

    const data = await res.json();
    const token = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value;
    if (!token) throw new Error('No auth token in Bhashini response');

    setBhashiniConfigsFromResponse(data);

    cachedBhashiniToken = token;
    bhashiniTokenExpiry = Date.now() + 3500000;
    return token;
};

const DEFAULT_BHASHINI_TRANSLATION_SERVICE = 'ai4bharat/indictrans-v2-all-gpu--t4';
const DEFAULT_BHASHINI_ASR_SERVICE = 'ai4bharat/conformer-hi-gpu--t4';

const handleTranslation = async (body) => {
    const {
        mode,
        audioBase64,
        language,
        text,
        sourceLanguage,
        targetLanguage,
        serviceId,
        asrServiceId,
        translationServiceId,
        ttsServiceId,
        audioFormat,
        samplingRate,
        gender
    } = body;

    // ─── ASR Mode: audio (base64 WAV) → transcript ────────────
    if (mode === 'asr') {
        if (!audioBase64) return err(400, 'audioBase64 required for ASR mode');
        try {
            const token = await getBhashiniToken();
            const langCode = language || 'hi';
            const asrCfg = pickBhashiniConfig('asr', langCode);
            const resolvedAsrServiceId =
                asrServiceId ||
                serviceId ||
                asrCfg?.serviceId ||
                (langCode === 'hi' ? DEFAULT_BHASHINI_ASR_SERVICE : undefined);
            const asrConfig = {
                language: { sourceLanguage: langCode },
                audioFormat: audioFormat || 'wav',
                samplingRate: samplingRate || 16000,
            };
            if (resolvedAsrServiceId) asrConfig.serviceId = resolvedAsrServiceId;

            const res = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
                method: 'POST',
                headers: { 'Accept': '*/*', 'Authorization': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pipelineTasks: [{
                        taskType: 'asr',
                        config: asrConfig,
                    }],
                    inputData: { audio: [{ audioContent: audioBase64 }] },
                }),
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => 'Unknown');
                throw new Error(`ASR API error (${res.status}): ${errText}`);
            }

            const data = await res.json();
            const transcript = data.pipelineResponse?.[0]?.output?.[0]?.source || '';
            console.log('Bhashini ASR transcript:', transcript);
            return ok({ transcript });
        } catch (error) {
            console.error('ASR failed:', error.message);
            // Return empty transcript so client can show keyboard fallback
            return ok({ transcript: '', error: error.message });
        }
    }

    // ─── TTS Mode: text → audio (base64) ───────────────────────────────────────
    if (mode === 'tts') {
        if (!text) return err(400, 'text required for TTS mode');
        try {
            const token = await getBhashiniToken();
            const langCode = language || sourceLanguage || targetLanguage || 'en';

            const ttsCfg = pickBhashiniConfig('tts', langCode);
            const resolvedTtsServiceId = ttsServiceId || serviceId || ttsCfg?.serviceId;
            if (!resolvedTtsServiceId) {
                return err(400, `TTS not supported for ${langCode}. Supported: ${JSON.stringify(listSupportedLanguages('tts'))}`);
            }
            const voices = Array.isArray(ttsCfg?.supportedVoices) ? ttsCfg.supportedVoices : [];
            const resolvedGender = gender || (voices.includes('female') ? 'female' : (voices[0] || 'female'));
            const ttsConfig = { language: { sourceLanguage: langCode }, serviceId: resolvedTtsServiceId, gender: resolvedGender };

            const res = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
                method: 'POST',
                headers: { 'Accept': '*/*', 'Authorization': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pipelineTasks: [{
                        taskType: 'tts',
                        config: ttsConfig,
                    }],
                    inputData: { input: [{ source: text }] },
                }),
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => 'Unknown');
                throw new Error(`TTS API error (${res.status}): ${errText}`);
            }

            const data = await res.json();
            const task = data.pipelineResponse?.find(r => r?.taskType === 'tts') || data.pipelineResponse?.[0];
            const audioContent = task?.audio?.[0]?.audioContent || task?.output?.[0]?.audioContent || '';
            const audioFormat = task?.config?.audioFormat || task?.audio?.[0]?.audioFormat || 'wav';
            if (!audioContent) throw new Error('No audioContent in TTS response');
            return ok({ audioContent, audioFormat });
        } catch (error) {
            console.error('TTS failed:', error.message || error);
            return ok({ audioContent: '', audioFormat: 'wav', error: error.message || String(error) });
        }
    }

    // ─── Translation Mode: text → translatedText OR texts → translatedTexts ──────────────
    const reqTexts = body.texts && Array.isArray(body.texts) ? body.texts : (text ? [text] : []);
    if (reqTexts.length === 0) return err(400, 'text or texts required');
    
    // Quick exit if source and target are the same
    if (sourceLanguage === targetLanguage || !targetLanguage) {
        if (body.texts) return ok({ translatedTexts: reqTexts });
        return ok({ translatedText: reqTexts[0] });
    }

    try {
        const token = await getBhashiniToken();

        const inputItems = reqTexts.map(t => ({ source: t }));

        const translationCfg = pickBhashiniConfig('translation', sourceLanguage || 'en', targetLanguage);
        const resolvedTranslationServiceId =
            translationServiceId ||
            serviceId ||
            translationCfg?.serviceId ||
            DEFAULT_BHASHINI_TRANSLATION_SERVICE;
        const res = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
            method: 'POST',
            headers: { 'Accept': '*/*', 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pipelineTasks: [{
                    taskType: 'translation',
                    config: { language: { sourceLanguage: sourceLanguage || 'en', targetLanguage }, serviceId: resolvedTranslationServiceId },
                }],
                inputData: { input: inputItems },
            }),
        });

        if (!res.ok) throw new Error(`Translation API error (${res.status})`);

        const data = await res.json();
        const outputs = data.pipelineResponse?.[0]?.output || [];
        
        if (body.texts) {
            const translatedTexts = reqTexts.map((original, i) => {
                const out = outputs[i]?.target;
                return out || original;
            });
            return ok({ translatedTexts });
        } else {
            const translated = outputs[0]?.target;
            return ok({ translatedText: translated || text });
        }
    } catch (error) {
        console.error('Translation failed:', error);
        if (body.texts) return ok({ translatedTexts: reqTexts, error: error.message });
        return ok({ translatedText: reqTexts[0], error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// WEATHER — OpenWeather Proxy
// ═══════════════════════════════════════════════════════════════

const handleWeather = async (query) => {
    const apiKey = env('OPENWEATHER_API_KEY');
    if (!apiKey) return err(500, 'OPENWEATHER_API_KEY not configured');

    const { lat, lon } = query;
    if (!lat || !lon) return err(400, 'lat and lon query params required');

    const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown');
        return err(res.status, `Weather API error: ${errText}`);
    }

    return ok(await res.json());
};

// ─── 5-Day Forecast Proxy ──────────────────────────────────────

const handleForecast = async (query) => {
    const apiKey = env('OPENWEATHER_API_KEY');
    if (!apiKey) return err(500, 'OPENWEATHER_API_KEY not configured');

    const { lat, lon } = query;
    if (!lat || !lon) return err(400, 'lat and lon query params required');

    // OpenWeather free tier: 5-day / 3-hour forecast (40 data points)
    const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=40`
    );

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown');
        return err(res.status, `Forecast API error: ${errText}`);
    }

    const raw = await res.json();

    // Aggregate into daily summaries (5 days)
    const dailyMap = {};
    for (const item of raw.list || []) {
        const day = item.dt_txt.split(' ')[0]; // "2025-03-24"
        if (!dailyMap[day]) {
            dailyMap[day] = { temps: [], humidity: [], descriptions: [], icons: [], rain: 0, wind: [] };
        }
        dailyMap[day].temps.push(item.main.temp);
        dailyMap[day].humidity.push(item.main.humidity);
        dailyMap[day].descriptions.push(item.weather[0].description);
        dailyMap[day].icons.push(item.weather[0].icon);
        dailyMap[day].wind.push(item.wind.speed);
        dailyMap[day].rain += item.rain?.['3h'] || 0;
    }

    const daily = Object.entries(dailyMap).slice(0, 5).map(([date, d]) => ({
        date,
        tempMin: Math.round(Math.min(...d.temps)),
        tempMax: Math.round(Math.max(...d.temps)),
        humidity: Math.round(d.humidity.reduce((a, b) => a + b, 0) / d.humidity.length),
        description: d.descriptions[Math.floor(d.descriptions.length / 2)], // midday reading
        icon: d.icons[Math.floor(d.icons.length / 2)],
        rainMm: parseFloat(d.rain.toFixed(1)),
        windSpeed: parseFloat((d.wind.reduce((a, b) => a + b, 0) / d.wind.length).toFixed(1)),
    }));

    return ok({ city: raw.city?.name, daily });
};

// ─── Soil Data Proxy (avoids CORS on data.gov.in) ──────────────

const handleSoil = async (query) => {
    const { lat, lon } = query;
    if (!lat || !lon) return err(400, 'lat and lon query params required');

    try {
        // Step 1: Reverse geocode via Nominatim
        const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'KisanMitra/1.0' } }
        );
        const geo = await geoRes.json();
        const state = geo.address?.state;
        const district = geo.address?.county || geo.address?.state_district || geo.address?.district;

        if (!state) return ok({ source: 'data.gov.in', state: null, soilMoisture: null });

        // Step 2: Fetch soil moisture from data.gov.in (server-side, no CORS)
        const apiKey = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';
        const resourceId = '4554a3c8-74e3-4f93-8727-8fd92161e345';
        let url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=10&filters[State]=${encodeURIComponent(state)}`;
        if (district) url += `&filters[District]=${encodeURIComponent(district)}`;

        const soilRes = await fetch(url);
        const soilJson = await soilRes.json();
        const records = soilJson.records || [];

        const avgMoisture = records.length
            ? records.reduce((s, r) => s + Number(r.Avg_smlvl_at15cm || 0), 0) / records.length
            : null;

        return ok({
            source: 'data.gov.in',
            state,
            district: district || state,
            soilMoisture: avgMoisture ? parseFloat(avgMoisture.toFixed(2)) : null,
            unit: '% vol at 15cm',
            agency: records[0]?.Agency_name || 'NRSC VIC MODEL',
            recordCount: records.length,
        });
    } catch (e) {
        console.error('Soil proxy error:', e);
        return err(500, 'Failed to fetch soil data');
    }
};
// ═══════════════════════════════════════════════════════════════

const inferImageContentType = (buffer, fallback = 'image/jpeg') => {
    if (!buffer || buffer.length < 12) return fallback;

    // JPEG magic number: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    // PNG magic number: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
    // WEBP magic: RIFF....WEBP
    if (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return 'image/webp';
    }

    return fallback;
};

const extractMultipartFile = (bodyBuffer, contentTypeHeader) => {
    const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
    if (!boundary) return null;

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const separatorBuffer = Buffer.from('\r\n\r\n');
    const trailingCrlf = Buffer.from('\r\n');

    let cursor = bodyBuffer.indexOf(boundaryBuffer);
    while (cursor !== -1) {
        const nextBoundary = bodyBuffer.indexOf(boundaryBuffer, cursor + boundaryBuffer.length);
        if (nextBoundary === -1) break;

        let part = bodyBuffer.slice(cursor + boundaryBuffer.length, nextBoundary);

        if (part.length >= 2 && part[0] === 0x0d && part[1] === 0x0a) {
            part = part.slice(2); // Trim part-leading CRLF
        }

        const headerEnd = part.indexOf(separatorBuffer);
        if (headerEnd !== -1) {
            const headerText = part.slice(0, headerEnd).toString('utf-8');
            const hasFilename = /content-disposition:\s*form-data;[^\r\n]*filename=/i.test(headerText);

            if (hasFilename) {
                let fileBuffer = part.slice(headerEnd + separatorBuffer.length);
                if (fileBuffer.length >= 2 && fileBuffer.slice(-2).equals(trailingCrlf)) {
                    fileBuffer = fileBuffer.slice(0, -2);
                }

                const partTypeMatch = headerText.match(/content-type:\s*([^\r\n;]+)/i);
                const partContentType = partTypeMatch?.[1]?.trim() || inferImageContentType(fileBuffer);

                return {
                    fileBuffer,
                    contentType: partContentType,
                };
            }
        }

        cursor = nextBoundary;
    }

    return null;
};

// ═══════════════════════════════════════════════════════════════
// DISEASE DETECTION — AWS SageMaker Serverless Inference
// ═══════════════════════════════════════════════════════════════

const handleDiseaseDetection = async (event) => {
    const endpointName = env('SAGEMAKER_ENDPOINT_NAME') || 'kisanmitra-disease-endpoint';
    // AWS_REGION is automatically provided by Lambda runtime
    const region = process.env.AWS_REGION || 'us-east-1';

    const requestContentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';

    let bodyBuffer;
    if (event.isBase64Encoded) {
        bodyBuffer = Buffer.from(event.body, 'base64');
    } else {
        bodyBuffer = Buffer.from(event.body || '', 'utf-8');
    }

    // Frontend sends FormData, but SageMaker expects raw image bytes.
    let inferenceBuffer = bodyBuffer;
    let inferenceContentType = requestContentType || 'application/octet-stream';

    if (requestContentType.toLowerCase().includes('multipart/form-data')) {
        const extracted = extractMultipartFile(bodyBuffer, requestContentType);
        if (!extracted || !extracted.fileBuffer || extracted.fileBuffer.length === 0) {
            return err(400, 'No image file found in multipart request');
        }

        inferenceBuffer = extracted.fileBuffer;
        inferenceContentType = inferImageContentType(extracted.fileBuffer, extracted.contentType || 'image/jpeg');
    }

    try {
        // Import AWS SDK v3 SageMaker Runtime client (available in Lambda Node.js 20 runtime)
        const { SageMakerRuntimeClient, InvokeEndpointCommand } = await import('@aws-sdk/client-sagemaker-runtime');

        const client = new SageMakerRuntimeClient({ region });

        const command = new InvokeEndpointCommand({
            EndpointName: endpointName,
            ContentType: inferenceContentType,
            Body: inferenceBuffer,
            Accept: 'application/json',
        });

        const response = await client.send(command);

        // Parse SageMaker response
        const responseBody = Buffer.from(response.Body).toString('utf-8');
        const data = JSON.parse(responseBody);

        console.log('SageMaker inference successful:', { endpointName, predictionsCount: data.predictions?.length || 0 });

        return ok(data);
    } catch (error) {
        console.error('SageMaker inference error:', error);

        // Fallback to HuggingFace if SageMaker fails (for development/testing)
        const hfEndpoint = env('DISEASE_DETECTION_ENDPOINT');
        if (hfEndpoint) {
            console.log('Falling back to HuggingFace endpoint...');
            try {
                const hfApiKey = env('HUGGINGFACE_API_KEY');
                const res = await fetch(hfEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': inferenceContentType,
                        ...(hfApiKey && { 'Authorization': `Bearer ${hfApiKey}` }),
                    },
                    body: inferenceBuffer,
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => 'Unknown');
                    return err(res.status, `HuggingFace fallback error: ${errText}`);
                }

                const data = await res.json();
                return ok({ ...data, source: 'huggingface_fallback' });
            } catch (fallbackError) {
                console.error('HuggingFace fallback also failed:', fallbackError);
                return err(500, `Disease detection failed: ${fallbackError.message}`);
            }
        }

        return err(500, `SageMaker inference failed: ${error.message}`);
    }
};
