// KisanVoiceBot — Talking avatar AI assistant for KisanMitra
// Replaces the floating VoiceChatbot + AIChatbot tab
// Uses DoctorAvatar (Dr. AYUSH) + VoiceRecorder + Claude 3 Haiku via Bedrock
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Keyboard, Ear, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { serverPost } from '@/lib/serverApi';

// ─── Types ────────────────────────────────────────────────────────────────────
type BotState = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Message { id: string; role: 'user' | 'bot'; text: string; ts: number; }

const MAX_TTS_CHARS = 280;

const splitTextForTts = (text: string, maxChars: number = MAX_TTS_CHARS): string[] => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  // Split into sentences without lookbehind for broader runtime support
  const tokens = cleaned.split(/([.!?।])/);
  const sentences: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const s = (tokens[i] + (tokens[i + 1] || '')).trim();
    if (s) sentences.push(s);
  }

  const chunks: string[] = [];
  let current = '';
  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const s of sentences) {
    if (s.length > maxChars) {
      const words = s.split(/\s+/);
      for (const w of words) {
        const next = current ? `${current} ${w}` : w;
        if (next.length > maxChars) {
          pushCurrent();
          current = w;
        } else {
          current = next;
        }
      }
      pushCurrent();
      continue;
    }

    const next = current ? `${current} ${s}` : s;
    if (next.length > maxChars) {
      pushCurrent();
      current = s;
    } else {
      current = next;
    }
  }

  pushCurrent();
  return chunks.length ? chunks : [cleaned];
};

// ─── WAV Encoder (PCM Float32 → 16-bit mono WAV) ────────────────────────────
function writeStr(v: DataView, off: number, s: string) {
  for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
}
function pcmToWav(samples: Float32Array, sr: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  writeStr(v, 0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true);
  writeStr(v, 8, 'WAVE'); writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  writeStr(v, 36, 'data'); v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
  }
  return buf;
}
function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let b = '';
  for (let i = 0; i < bytes.length; i += 8192)
    b += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
  return btoa(b);
}
async function blobToWavB64(blob: Blob, ctx: AudioContext | null = null): Promise<string> {
  const ab = await blob.arrayBuffer();
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const dec = ctx ?? new AC(); const owns = !ctx;
  let audio: AudioBuffer;
  try { audio = await dec.decodeAudioData(ab); }
  finally { if (owns) await dec.close().catch(() => {}); }
  const frames = Math.ceil(16000 * audio.duration) || 1;
  const off = new OfflineAudioContext(1, frames, 16000);
  const src = off.createBufferSource(); src.buffer = audio;
  src.connect(off.destination); src.start(0);
  const res = await off.startRendering();
  return toB64(pcmToWav(res.getChannelData(0), 16000));
}

// ─── Doctor Avatar (Dr. AYUSH) ───────────────────────────────────────────────
function DoctorAvatar({ state, audioLevel = 0 }: { state: BotState; audioLevel?: number }) {
  const [blinkKey, setBlinkKey] = useState(0);
  const [eye, setEye] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const blink = () => { setBlinkKey(k => k + 1); t = setTimeout(blink, 2500 + Math.random() * 4000); };
    t = setTimeout(blink, 2000); return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const move = () => {
      if (state === 'thinking') setEye({ x: 3 + Math.random() * 2, y: -4 - Math.random() * 2 });
      else if (state === 'listening') setEye({ x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 2 });
      else if (state === 'speaking') setEye({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) });
      else setEye({ x: 0, y: 0 });
      t = setTimeout(move, 1500 + Math.random() * 2500);
    };
    t = setTimeout(move, 1000); return () => clearTimeout(t);
  }, [state]);

  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const lvl = isNaN(audioLevel) ? 0 : Math.min(Math.max(Number(audioLevel), 0), 1);
  const open = isSpeaking ? Math.min(lvl * 1.5, 1) : 0;
  const jawDrop = open * 7;
  const mW = 14 + open * 5, mH = isSpeaking ? 2 + open * 18 : 2;
  const mY = 110 + jawDrop * 0.4;
  const uLipY = mY - (isSpeaking ? open * 2 : 0);
  const lLipY = mY + mH;
  const chinY = 125 + jawDrop, jawCtY = 125 + jawDrop * 0.7, jawCtSY = 110 + jawDrop * 0.3;
  const facePath = `M 60 80 C 60 40, 140 40, 140 80 C 140 ${jawCtSY}, 120 ${jawCtY}, 100 ${chinY} C 80 ${jawCtY}, 60 ${jawCtSY}, 60 80 Z`;
  const cavPath = `M ${100 - mW} ${mY} Q 100 ${uLipY - mH * 0.3} ${100 + mW} ${mY} Q 100 ${lLipY + mH * 0.3} ${100 - mW} ${mY} Z`;
  const uLipPath = `M ${100 - mW - 1} ${mY + 0.5} Q 100 ${uLipY - mH * 0.2 - 4} ${100 + mW + 1} ${mY + 0.5} Q 100 ${uLipY} ${100 - mW - 1} ${mY + 0.5} Z`;
  const lLipPath = `M ${100 - mW - 1} ${mY - 0.5} Q 100 ${lLipY + mH * 0.3 + 5} ${100 + mW + 1} ${mY - 0.5} Q 100 ${lLipY} ${100 - mW - 1} ${mY - 0.5} Z`;
  const ebL = isSpeaking ? -1.5 * open : isThinking ? -3 : isListening ? -1.5 : 0;
  const ebR = isSpeaking ? -1.5 * open : isThinking ? 2 : isListening ? -1.5 : 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Pulse rings */}
      <div className="absolute inset-0 top-10 flex items-center justify-center pointer-events-none -z-10">
        <AnimatePresence>
          {isListening && (<>
            <motion.div className="absolute w-64 h-64 rounded-full bg-emerald-500/10"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.2, opacity: 0.5 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }} />
            <motion.div className="absolute w-52 h-52 rounded-full bg-emerald-500/20"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.15, opacity: 0.7 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4, ease: 'easeOut' }} />
          </>)}
          {isSpeaking && (
            <motion.div className="absolute w-60 h-60 rounded-full bg-blue-500/10"
              animate={{ scale: [1, 1.05 + open * 0.1, 1], opacity: [0.3, 0.6 + open * 0.2, 0.3] }}
              transition={{ duration: 0.1 }} />
          )}
          {isThinking && (
            <motion.div className="absolute w-60 h-60 rounded-full bg-amber-500/10"
              animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              style={{ backgroundImage: 'conic-gradient(from 0deg, transparent, rgba(245,158,11,0.2), transparent)' }} />
          )}
        </AnimatePresence>
      </div>

      {/* Avatar SVG */}
      <motion.div className="relative w-52 h-52 md:w-64 md:h-64 mx-auto drop-shadow-xl"
        animate={state === 'idle' ? { y: [0, -4, 0] } : { y: 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible" aria-label="Kisan Mitra">
          <defs>
            <filter id="kv-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
            <radialGradient id="kv-skin" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#f5cdbf" /><stop offset="70%" stopColor="#e2bbaa" /><stop offset="100%" stopColor="#d3a899" />
            </radialGradient>
            <radialGradient id="kv-blush" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#f2a9a0" stopOpacity="0.25" /><stop offset="60%" stopColor="#f2a9a0" stopOpacity="0.08" /><stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id="kv-noseH" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="transparent" /><stop offset="50%" stopColor="#fbe9df" stopOpacity="0.8" /><stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="kv-chin" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="transparent" /><stop offset="100%" stopColor="#d3a899" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="kv-bindi" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff4560" /><stop offset="100%" stopColor="#b83a3a" />
            </radialGradient>
            <radialGradient id="kv-iris" cx="50%" cy="50%" r="50%">
              <stop offset="30%" stopColor="#6b4f3a" /><stop offset="100%" stopColor="#3b2a1f" />
            </radialGradient>
            <linearGradient id="kv-uLip" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d08a83" /><stop offset="100%" stopColor="#b96b63" />
            </linearGradient>
            <linearGradient id="kv-lLip" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d5918a" /><stop offset="100%" stopColor="#b15f57" />
            </linearGradient>
            <linearGradient id="kv-hair" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2A2421" /><stop offset="40%" stopColor="#1C1816" /><stop offset="100%" stopColor="#0B0908" />
            </linearGradient>
            <linearGradient id="kv-coat" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <filter id="kv-hShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="6" floodColor="#000000" floodOpacity="0.1" /></filter>
            <filter id="kv-sShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.08" /></filter>
            <filter id="kv-iGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
              <feFlood floodColor="#FFFFFF" floodOpacity="0.5" result="gc" />
              <feComposite in="gc" in2="blur" operator="in" result="g" />
              <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="kv-bDrop" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.15" /></filter>
            <clipPath id="kv-mClip"><path d={cavPath} /></clipPath>
          </defs>
          {/* Background */}
          <circle cx="100" cy="100" r="95"
            fill={isListening ? '#F0FDF4' : isThinking ? '#FFFBEB' : isSpeaking ? '#EFF6FF' : '#F8FAFC'}
            stroke={isListening ? '#4ADE80' : isThinking ? '#FBBF24' : isSpeaking ? '#60A5FA' : '#E2E8F0'}
            strokeWidth="3" className="transition-colors duration-500" />
          {/* Back hair bun */}
          <ellipse cx="100" cy="115" rx="36" ry="42" fill="url(#kv-hair)" />
          {/* Body */}
          <rect x="83" y="110" width="34" height="60" fill="url(#kv-skin)" />
          <rect x="83" y="110" width="34" height="60" fill="url(#kv-chin)" filter="url(#kv-blur)" />
          <path d="M 50 145 C 50 200, 150 200, 150 145" stroke="#1E293B" strokeWidth="6" fill="none" />
          <path d="M 20 200 C 20 150, 45 130, 100 130 C 155 130, 180 150, 180 200 Z" fill="url(#kv-coat)" filter="url(#kv-hShadow)" />
          <path d="M 80 130 L 70 200 L 95 200 L 100 155 Z" fill="#F8FAFC" filter="url(#kv-sShadow)" />
          <path d="M 120 130 L 130 200 L 105 200 L 100 155 Z" fill="#F8FAFC" filter="url(#kv-sShadow)" />
          <path d="M 82 130 L 100 160 L 118 130 Z" fill="#0369A1" filter="url(#kv-iGlow)" />
          <path d="M 68 150 C 68 140, 72 135, 80 120" stroke="#1E293B" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M 132 150 C 132 140, 128 135, 120 120" stroke="#1E293B" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M 100 185 L 100 200" stroke="#1E293B" strokeWidth="6" fill="none" />
          <circle cx="100" cy="185" r="9" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2.5" filter="url(#kv-hShadow)" />
          <circle cx="100" cy="185" r="4.5" fill="#1E293B" />
          {/* Head */}
          <motion.g
            animate={isSpeaking ? { rotate: [-0.5, 1, -0.5], y: [0, -1, 0] } : isThinking ? { rotate: -2, y: -2 } : isListening ? { scale: 1.01, y: -1 } : { rotate: 0, scale: 1, y: 0 }}
            transition={isSpeaking ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.8, ease: 'easeOut' }}
            style={{ transformOrigin: '100px 125px' }}>
            {/* Hair top */}
            <path d="M 53 85 C 45 35, 155 35, 147 85 C 145 105, 125 110, 100 110 C 75 110, 55 105, 53 85 Z" fill="url(#kv-hair)" filter="url(#kv-sShadow)" />
            {/* Face */}
            <path d={facePath} fill="url(#kv-skin)" filter="url(#kv-hShadow)" />
            {/* Cheeks */}
            <ellipse cx="70" cy="92" rx="20" ry="12" fill="url(#kv-blush)" />
            <ellipse cx="130" cy="92" rx="20" ry="12" fill="url(#kv-blush)" />
            {/* Nose */}
            <rect x="98" y="70" width="4" height="25" fill="url(#kv-noseH)" opacity="0.8" filter="url(#kv-blur)" rx="2" />
            <circle cx="95" cy="100" r="1.5" fill="#a07a6d" opacity="0.5" />
            <circle cx="105" cy="100" r="1.5" fill="#a07a6d" opacity="0.5" />
            {/* Left eye */}
            <motion.g animate={{ scaleY: [1, 0.05, 1] }} transition={{ duration: 0.15, times: [0, 0.5, 1] }} style={{ transformOrigin: '79px 80px' }} key={`el-${blinkKey}`}>
              <ellipse cx="79" cy="80" rx="11" ry="4" fill="#fffdfb" filter="url(#kv-sShadow)" />
              <circle cx={79 + eye.x * 0.7} cy={80 + eye.y * 0.7} r="3.8" fill="url(#kv-iris)" />
              <circle cx={79 + eye.x * 0.7} cy={80 + eye.y * 0.7} r="1.8" fill="#000" />
              <circle cx={77.5 + eye.x * 0.7} cy={78.5 + eye.y * 0.7} r="0.8" fill="#fff" opacity="0.9" />
              <ellipse cx="79" cy="77" rx="10" ry="2" fill="#000" opacity="0.08" />
              <path d="M 68 77 C 72 74, 86 74, 90 77" stroke="#b58d7d" strokeWidth="1" fill="none" strokeLinecap="round" filter="url(#kv-blur)" />
            </motion.g>
            {/* Right eye */}
            <motion.g animate={{ scaleY: [1, 0.05, 1] }} transition={{ duration: 0.15, times: [0, 0.5, 1] }} style={{ transformOrigin: '121px 80px' }} key={`er-${blinkKey}`}>
              <ellipse cx="121" cy="80" rx="11" ry="4" fill="#fffdfb" filter="url(#kv-sShadow)" />
              <circle cx={121 + eye.x * 0.7} cy={80 + eye.y * 0.7} r="3.8" fill="url(#kv-iris)" />
              <circle cx={121 + eye.x * 0.7} cy={80 + eye.y * 0.7} r="1.8" fill="#000" />
              <circle cx={119.5 + eye.x * 0.7} cy={78.5 + eye.y * 0.7} r="0.8" fill="#fff" opacity="0.9" />
              <ellipse cx="121" cy="77" rx="10" ry="2" fill="#000" opacity="0.08" />
              <path d="M 110 77 C 114 74, 128 74, 132 77" stroke="#b58d7d" strokeWidth="1" fill="none" strokeLinecap="round" filter="url(#kv-blur)" />
            </motion.g>
            {/* Eyebrows */}
            <path d={`M 89 ${68 + ebL} Q 76 ${62 + ebL} 64 ${71 + ebL}`} stroke="#382922" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity="0.85" />
            <path d={`M 111 ${68 + ebR} Q 124 ${62 + ebR} 136 ${71 + ebR}`} stroke="#382922" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity="0.85" />
            {/* Mouth */}
            <g>
              <path d={cavPath} fill="#3A1212" />
              <rect x="75" y={uLipY - mH * 0.2} width="50" height="7" fill="#FDFDFD" clipPath="url(#kv-mClip)" />
              <circle cx="100" cy={lLipY + 4} r="12" fill="#E66767" clipPath="url(#kv-mClip)" />
              <path d={uLipPath} fill="url(#kv-uLip)" />
              <path d={lLipPath} fill="url(#kv-lLip)" />
              <path d={`M ${100 - mW - 1} ${mY} Q 100 ${mY + 1} ${100 + mW + 1} ${mY}`} stroke="#541b14" strokeWidth="1.2" fill="none" opacity={isSpeaking ? 0.2 : 0.6} filter="url(#kv-blur)" />
            </g>
            {/* Front hair */}
            <path d="M 100 35 C 75 35, 50 50, 56 85 C 65 65, 80 44, 100 44 Z" fill="url(#kv-hair)" filter="url(#kv-sShadow)" />
            <path d="M 100 35 C 125 35, 150 50, 144 85 C 135 65, 120 44, 100 44 Z" fill="url(#kv-hair)" filter="url(#kv-sShadow)" />
            <path d="M 65 55 Q 60 70 56 85" stroke="#1c1816" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M 135 55 Q 140 70 144 85" stroke="#1c1816" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
            {/* Bindi */}
            <circle cx="100" cy="68" r="3.5" fill="url(#kv-bindi)" filter="url(#kv-bDrop)" />
          </motion.g>
          {/* Name badge */}
          <g transform="translate(10, 0)">
            <rect x="115" y="152" width="55" height="24" rx="4" fill="#0F172A" filter="url(#kv-hShadow)" />
            <rect x="115" y="152" width="4" height="24" fill="#F59E0B" rx="1.5" />
            <text x="144" y="167" fontSize="9" fill="#F8FAFC" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.5">Kisan Mitra</text>
          </g>
        </svg>
      </motion.div>

      {/* Status chip */}
      <motion.div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold shadow-sm border backdrop-blur-sm transition-all duration-300"
        style={{
          background: state === 'listening' ? '#F0FDF4' : state === 'thinking' ? '#FFFBEB' : state === 'speaking' ? '#EFF6FF' : '#F8FAFC',
          borderColor: state === 'listening' ? '#4ADE80' : state === 'thinking' ? '#FBBF24' : state === 'speaking' ? '#60A5FA' : '#E2E8F0',
          color: state === 'listening' ? '#15803D' : state === 'thinking' ? '#92400E' : state === 'speaking' ? '#1D4ED8' : '#475569',
        }}>
        <AnimatePresence mode="popLayout">
          <motion.div key={state} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 45 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            {state === 'idle' && <div className="w-4 h-4" />}
            {state === 'listening' && <Ear className="w-4 h-4 text-emerald-500 animate-pulse" />}
            {state === 'thinking' && <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />}
            {state === 'speaking' && (
              <div className="flex gap-0.5 items-center h-4">
                {[0.5, 0.6, 0.4].map((d, i) => (
                  <motion.span key={i} animate={{ height: [6, 14 + i * 2, 6] }} transition={{ repeat: Infinity, duration: d }}
                    className="w-1 bg-blue-500 rounded-full inline-block" />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <span>{state === 'idle' ? 'Ready' : state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Thinking…' : 'Speaking'}</span>
      </motion.div>
    </div>
  );
}

// ─── Waveform bars ────────────────────────────────────────────────────────────
function Waveform({ active, level }: { active: boolean; level: number }) {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: 18 }).map((_, i) => {
        const mul = 12 + (i % 5) * 6;
        return (
          <motion.div key={i} className="w-1 bg-emerald-500 rounded-full origin-center"
            animate={{ height: active ? 6 + level * mul : 3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function KisanVoiceBot() {
  const { language } = useLanguage();
  const [state, setState] = useState<BotState>('idle');
  const [msgs, setMsgs] = useState<Message[]>([{
    id: 'welcome', role: 'bot',
    text: 'Namaste! I am a Kisan Mitra, your AI advisor. Ask me anything about organic farming, crop diseases, soil health, or market prices — in any language!',
    ts: Date.now(),
  }]);
  const [textInput, setTextInput] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const speakRafRef = useRef<number>(0);   // ← lip-sync animation during TTS
  const speakSeqRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lipSyncActiveRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(speakRafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // TTS via Bhashini (server) + simulated lip-sync animation
  const cancelTts = useCallback(() => {
    speakSeqRef.current += 1;
    cleanupAudio();
    cancelAnimationFrame(speakRafRef.current);
    lipSyncActiveRef.current = false;
    setAudioLevel(0);
  }, [cleanupAudio]);

  const speak = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) { setState('idle'); return; }

    cancelTts();
    setState('speaking');
    const seq = (speakSeqRef.current += 1);
    const chunks = splitTextForTts(trimmed);

    // Drive jaw animation with mixed sine waves that mimic natural speech rhythm
    let t = 0;
    const startLipSync = () => {
      if (lipSyncActiveRef.current) return;
      lipSyncActiveRef.current = true;
      const animate = () => {
        if (!lipSyncActiveRef.current) return;
        t += 0.18;
        const level = Math.max(0, Math.min(1,
          0.35
          + Math.sin(t * 2.4) * 0.28
          + Math.sin(t * 5.9) * 0.14
          + Math.sin(t * 11.3) * 0.07
          + (Math.random() - 0.5) * 0.08
        ));
        setAudioLevel(level);
        speakRafRef.current = requestAnimationFrame(animate);
      };
      speakRafRef.current = requestAnimationFrame(animate);
    };
    const stopLipSync = () => {
      lipSyncActiveRef.current = false;
      cancelAnimationFrame(speakRafRef.current);
      setAudioLevel(0);
    };

    const playChunk = async (index: number) => {
      if (seq !== speakSeqRef.current) return;
      if (index >= chunks.length) {
        stopLipSync();
        cancelTts();
        setState('idle');
        return;
      }

      try {
        const data = await serverPost<{ audioContent: string; audioFormat?: string; error?: string }>(
          '/api/translate',
          { mode: 'tts', text: chunks[index], language }
        );
        const audioContent = data.audioContent || '';
        if (!audioContent) throw new Error(data.error || 'Empty TTS audio');

        const format = (data.audioFormat || 'wav').toLowerCase();
        const mime = format.startsWith('audio/') ? format : `audio/${format}`;

        const bytes = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => startLipSync();
        audio.onended = () => {
          cleanupAudio();
          stopLipSync();
          playChunk(index + 1);
        };
        audio.onerror = () => {
          console.warn('Bhashini TTS playback failed');
          stopLipSync();
          cancelTts();
          setState('idle');
        };
        await audio.play();
      } catch (err) {
        console.warn('Bhashini TTS failed:', err);
        stopLipSync();
        cancelTts();
        setState('idle');
      }
    };

    playChunk(0);
  }, [language, cancelTts, cleanupAudio]);

  // Send text to AI
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, ts: Date.now() };
    setMsgs(prev => [...prev, userMsg]);
    setState('thinking');

    try {
      const context = msgs.slice(-6).map(m => `${m.role === 'user' ? 'Farmer' : 'Kisan Mitra'}: ${m.text}`);
      const data = await serverPost<{ response: string }>('/api/gemini/chat', { message: text, context });
      const reply = data.response || 'Sorry, I could not process that. Please try again.';
      let finalReply = reply;
      if (language && language !== 'en') {
        try {
          const tx = await serverPost<{ translatedText?: string }>('/api/translate', {
            text: reply,
            sourceLanguage: 'en',
            targetLanguage: language,
          });
          if (tx.translatedText) finalReply = tx.translatedText;
        } catch {
          // Keep original reply on translation failure
        }
      }
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'bot', text: finalReply, ts: Date.now() };
      setMsgs(prev => [...prev, botMsg]);
      speak(finalReply);
    } catch (err) {
      console.error('KisanVoiceBot sendMessage failed:', err);
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'bot', text: 'I am having trouble connecting. Please try again.', ts: Date.now() };
      setMsgs(prev => [...prev, errMsg]);
      setState('idle');
    }
  }, [msgs, speak]);

  // ASR: audio blob → text
  const transcribe = useCallback(async (wavB64: string): Promise<string> => {
    try {
      const data = await serverPost<{ transcript: string }>('/api/translate', { mode: 'asr', audioBase64: wavB64, language });
      return data.transcript || '';
    } catch { return ''; }
  }, [language]);

  // Start recording
  const startRecording = async () => {
    if (state !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 } } });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC(); ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 256;
      src.connect(an); analyserRef.current = an;
      const tick = () => {
        if (!analyserRef.current) return;
        const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(arr);
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        setAudioLevel(Math.min(isFinite(avg) ? avg / 128 : 0, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        cancelAnimationFrame(rafRef.current);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null; analyserRef.current = null; setAudioLevel(0);
        if (chunksRef.current.length === 0) { setState('idle'); return; }
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        const rc = ctxRef.current; ctxRef.current = null;
        setState('thinking');
        try {
          const wavB64 = await blobToWavB64(blob, rc);
          const transcript = await transcribe(wavB64);
          if (rc && rc.state !== 'closed') await rc.close().catch(() => {});
          if (transcript) { await sendMessage(transcript); }
          else { setState('idle'); setShowKeyboard(true); }
        } catch {
          if (rc && rc.state !== 'closed') await rc.close().catch(() => {});
          setState('idle');
        }
      };
      mr.start(150);
      setState('listening');
    } catch { setState('idle'); }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  };

  const handleMic = () => {
    if (state === 'listening') stopRecording();
    else if (state === 'idle') startRecording();
    else if (state === 'speaking') { cancelTts(); setState('idle'); }
  };

  const handleSend = () => { sendMessage(textInput); setTextInput(''); };

  useEffect(() => () => { cleanup(); cancelTts(); }, [cleanup, cancelTts]);

  return (
    <div className="grid md:grid-cols-5 gap-6 h-[calc(100vh-240px)] min-h-[600px]">
      {/* Left: Avatar panel */}      <div className="md:col-span-2 flex flex-col items-center justify-center bg-surface-lowest rounded-3xl border-0 shadow-soft p-6 gap-4">
        <p className="text-xs text-muted-foreground text-center">KisanMitra AI — Organic Farming Advisor</p>

        <DoctorAvatar state={state} audioLevel={audioLevel} />

        {/* Recording waveform */}
        <AnimatePresence>
          {state === 'listening' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3">
              <Waveform active={state === 'listening'} level={audioLevel} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic button */}
        <div className="relative">
          {state === 'listening' && (
            <motion.div className="absolute inset-0 rounded-full bg-red-400"
              animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }} />
          )}
          <Button size="lg"
            className={cn('relative z-10 rounded-full w-20 h-20 shadow-2xl transition-all duration-300',
              state === 'listening' ? 'bg-red-500 hover:bg-red-600' :
              state === 'speaking' ? 'bg-blue-500 hover:bg-blue-600' :
              state === 'thinking' ? 'bg-amber-400 cursor-not-allowed' :
              'bg-emerald-500 hover:bg-emerald-600')}
            onClick={handleMic}
            disabled={state === 'thinking'}>
            {state === 'listening' ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {state === 'idle' ? 'Tap mic to speak' : state === 'listening' ? 'Tap again to stop' : state === 'thinking' ? 'Processing…' : 'Tap mic to stop'}
        </p>

        {/* Language badge */}
        <Badge variant="outline" className="text-xs">{language.toUpperCase()} · Bhashini ASR</Badge>
      </div>

      {/* Right: Chat panel */}
      <div className="md:col-span-3 flex flex-col rounded-3xl border-0 shadow-soft overflow-hidden bg-surface-lowest">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">KisanMitra AI Chat</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowKeyboard(v => !v)} title="Keyboard input">
              <Keyboard className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMsgs([{
              id: 'reset', role: 'bot', text: 'Chat cleared. How can I help you today?', ts: Date.now()
            }])} title="Clear chat">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-4">
            {msgs.map(m => (
              <div key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs font-bold text-emerald-700">A</span>
                  </div>
                )}
                <div className={cn('max-w-[80%] rounded-3xl px-5 py-3 text-sm shadow-sm',
                  m.role === 'user'
                    ? 'gradient-primary text-white rounded-tr-sm'
                    : 'bg-surface-container-low text-foreground rounded-tl-sm')}>
                  {m.text}
                </div>
              </div>
            ))}
            {state === 'thinking' && (
              <div className="flex gap-2 justify-start">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-emerald-700">A</span>
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <motion.div key={i} className="w-2 h-2 rounded-full bg-emerald-500"
                      animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={scrollRef as any} />
          </div>
        </ScrollArea>

        {/* Keyboard input */}
        <AnimatePresence>
          {showKeyboard && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="border-t px-4 py-3 flex gap-2">
              <Input value={textInput} onChange={e => setTextInput(e.target.value)}
                placeholder="Type your farming question…"
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={state !== 'idle' && state !== 'speaking'}
                className="flex-1 rounded-full px-4" />
              <Button onClick={handleSend} disabled={!textInput.trim() || (state !== 'idle' && state !== 'speaking')}
                className="gradient-primary rounded-full hover-lift">
                <Send className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
