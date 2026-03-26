// Bhashini Translation API — proxied through Lambda server
// NO API keys on client — calls go through /api/translate

import { serverPost } from '@/lib/serverApi';

interface TranslateRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

let translationQueue: TranslateRequest[] = [];
let batchTimeout: ReturnType<typeof setTimeout> | null = null;

const processTranslationBatch = async () => {
    const queueToProcess = [...translationQueue];
    translationQueue = [];
    batchTimeout = null;

    type GroupedQueue = Record<string, TranslateRequest[]>;
    const grouped: GroupedQueue = {};
    for (const req of queueToProcess) {
        const key = `${req.sourceLanguage}->${req.targetLanguage}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(req);
    }

    // Process each group
    for (const [key, reqs] of Object.entries(grouped)) {
        const [src, tgt] = key.split('->');
        const texts = reqs.map(r => r.text);
        
        try {
            const data = await serverPost<{ translatedTexts: string[] }>('/api/translate', {
                texts,
                sourceLanguage: src,
                targetLanguage: tgt
            });
            const results = data.translatedTexts || texts;
            reqs.forEach((req, i) => req.resolve(results[i] || req.text));
        } catch (e) {
            reqs.forEach(req => req.resolve(req.text)); // fallback to original
        }
    }
};

export const translateText = async (
  text: string,
  sourceLanguage: string = 'en',
  targetLanguage: string = 'hi'
): Promise<string> => {
  if (sourceLanguage === targetLanguage || !text || text.trim().length === 0) {
    return text;
  }

  return new Promise<string>((resolve, reject) => {
      translationQueue.push({ text, sourceLanguage, targetLanguage, resolve, reject });
      if (!batchTimeout) {
          batchTimeout = setTimeout(processTranslationBatch, 50); // 50ms batching window
      }
  });
};

// Supported languages
export const LANGUAGES = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  pa: 'ਪੰਜਾਬੀ (Punjabi)',
  gu: 'ગુજરાતી (Gujarati)',
  mr: 'मराठी (Marathi)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  kn: 'ಕನ್ನಡ (Kannada)',
  bn: 'বাংলা (Bengali)',
  ml: 'മലയാളം (Malayalam)'
};
