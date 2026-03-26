// VoiceChatbot — floating voice-powered KisanMitra AI assistant
// Mic button bottom-right → opens panel → records voice → Bhashini ASR → Gemini AI → Bhashini TTS
import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, X, Keyboard, Volume2, VolumeX, Bot, Trash2, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { chatWithAI } from '@/lib/gemini';
import { translateText } from '@/lib/bhashini';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// ── WAV encoder (Float32 PCM → 16-bit mono WAV) ──────────────────
function writeStr(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
function pcmToWav(samples: Float32Array, sr: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  writeStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  writeStr(v, 8, 'WAVE');
  writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  writeStr(v, 36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
  }
  return buf;
}
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let b = '';
  for (let i = 0; i < bytes.length; i += 8192)
    b += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
  return btoa(b);
}
async function blobToWavB64(blob: Blob, ctx: AudioContext | null = null): Promise<string> {
  const SR = 16000;
  const ab = await blob.arrayBuffer();
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const dec = ctx ?? new AC();
  const owns = !ctx;
  let audio: AudioBuffer;
  try { audio = await dec.decodeAudioData(ab); }
  finally { if (owns) dec.close().catch(() => {}); }
  const frames = Math.ceil(SR * audio.duration) || 1;
  const off = new OfflineAudioContext(1, frames, SR);
  const src = off.createBufferSource();
  src.buffer = audio; src.connect(off.destination); src.start(0);
  const resampled = await off.startRendering();
  const wav = pcmToWav(resampled.getChannelData(0), SR);
  return toBase64(wav);
}

// ── Bhashini ASR (speech-to-text via Lambda proxy) ───────────────
async function transcribeVoice(wavB64: string, language: string): Promise<string> {
  try {
    const API = (import.meta as any).env?.VITE_API_URL || '';
    const res = await fetch(`${API}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: wavB64, sourceLanguage: language, mode: 'asr' }),
    });
    if (!res.ok) throw new Error('ASR failed');
    const data = await res.json();
    return data.transcribedText || data.translatedText || '';
  } catch {
    return ''; // fall back to silence — user can type instead
  }
}

// ── Message types ─────────────────────────────────────────────────
interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

const STORAGE_KEY = 'kisanmitra_voice_chat';

function loadMsgs(): Msg[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveMsgs(msgs: Msg[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
}

// ── Audio waveform visualizer ─────────────────────────────────────
function Waveform({ level }: { level: number }) {
  const BARS = 18;
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: BARS }).map((_, i) => {
        const h = 4 + level * (10 + (i % 5) * 6);
        return (
          <div
            key={i}
            className="w-1 rounded-full bg-primary transition-all duration-75"
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export function VoiceChatbot() {
  const { language } = useLanguage();

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(loadMsgs);
  const [text, setText] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => { saveMsgs(msgs); }, [msgs]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, isProcessing]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((txt: string) => {
    if (muted || !window.speechSynthesis) return;
    stopSpeech();
    const utt = new SpeechSynthesisUtterance(txt);
    utt.lang = language === 'hi' ? 'hi-IN' : language === 'pa' ? 'pa-IN' : language === 'gu' ? 'gu-IN' :
      language === 'mr' ? 'mr-IN' : language === 'ta' ? 'ta-IN' : language === 'te' ? 'te-IN' :
      language === 'kn' ? 'kn-IN' : language === 'bn' ? 'bn-IN' : 'en-IN';
    utt.rate = 0.95;
    speechRef.current = utt;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [muted, language, stopSpeech]);

  const addMsg = useCallback((msg: Msg) => {
    setMsgs(prev => [...prev, msg]);
  }, []);

  const sendText = useCallback(async (userText: string) => {
    if (!userText.trim() || isProcessing) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: userText.trim(), ts: Date.now() };
    addMsg(userMsg);
    setText('');
    setIsProcessing(true);
    try {
      // Translate to English if needed for the AI
      const engText = language !== 'en'
        ? await translateText(userText.trim(), language, 'en').catch(() => userText.trim())
        : userText.trim();

      const ctx = msgs.slice(-8).map(m => `${m.role}: ${m.text}`);
      const aiResp = await chatWithAI(engText, ctx);

      // Translate AI response back to user's language
      const localResp = language !== 'en'
        ? await translateText(aiResp, 'en', language).catch(() => aiResp)
        : aiResp;

      const botMsg: Msg = { id: `a-${Date.now()}`, role: 'assistant', text: localResp, ts: Date.now() };
      addMsg(botMsg);
      speak(localResp.substring(0, 300)); // speak first 300 chars
    } catch (e) {
      const errMsg: Msg = { id: `e-${Date.now()}`, role: 'assistant', text: 'Sorry, I had trouble responding. Please try again.', ts: Date.now() };
      addMsg(errMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, msgs, language, addMsg, speak, translateText]);

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: { ideal: 1 } }
      });
      streamRef.current = stream;

      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AC();
      ctxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        if (!analyserRef.current) return;
        const d = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(d);
        const avg = d.reduce((s, v) => s + v, 0) / d.length;
        setLevel(Math.min(avg / 128, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = async () => {
        cleanupAudio();
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        const savedCtx = ctxRef.current;
        ctxRef.current = null;
        setIsProcessing(true);
        try {
          const wavB64 = await blobToWavB64(blob, savedCtx);
          // Try Bhashini ASR first
          let transcript = await transcribeVoice(wavB64, language);
          if (!transcript) {
            // Fallback: prompt user to type
            setShowKeyboard(true);
            return;
          }
          await sendText(transcript);
        } catch {
          setShowKeyboard(true);
        } finally {
          if (savedCtx && savedCtx.state !== 'closed') savedCtx.close().catch(() => {});
          setIsProcessing(false);
        }
      };

      mr.start(150);
      setIsRecording(true);
    } catch (e) {
      console.error('Mic error:', e);
      setShowKeyboard(true);
    }
  }, [isRecording, isProcessing, language, cleanupAudio, sendText]);

  const stopRecording = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      cleanupAudio();
      stopSpeech();
    };
  }, [stopRecording, cleanupAudio, stopSpeech]);

  const clearHistory = () => {
    setMsgs([]);
    localStorage.removeItem(STORAGE_KEY);
    stopSpeech();
  };

  // ── Floating button (closed state) ──────────────────────────────
  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(true)}
          className="group relative flex items-center justify-center w-16 h-16 rounded-full gradient-primary shadow-glow hover:scale-110 active:scale-95 transition-transform duration-300"
          aria-label="Open KisanMitra Voice Assistant"
        >
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25" />
          <span className="absolute inset-0 rounded-full bg-green-400 animate-pulse opacity-20" />
          <Mic className="w-7 h-7 text-white relative z-10" />
          <span className="absolute -top-10 right-0 whitespace-nowrap bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            🌾 KisanMitra AI
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded chat panel ──────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-1.5rem)] flex flex-col shadow-elevated rounded-[2rem] overflow-hidden border-0 bg-surface-lowest">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 gradient-primary text-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sprout className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">KisanMitra AI</p>
            <p className="text-[10px] opacity-80">Voice-powered farming assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] px-2">
            {isSpeaking ? '🔊 Speaking' : isProcessing ? '🧠 Thinking' : isRecording ? '🎙 Listening' : '● Online'}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setMuted(m => !m)}>
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={clearHistory} title="Clear history">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => { setOpen(false); stopSpeech(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-72 px-3 py-2 bg-muted/30">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Bot className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium">Namaste! 🌾</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Press the mic and ask about crop diseases, farming tips, market prices — in any language!
            </p>
          </div>
        )}
        <div className="space-y-3">
          {msgs.map(m => (
            <div key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                m.role === 'user' ? 'bg-primary' : 'bg-green-600')}>
                {m.role === 'user'
                  ? <span className="text-[10px] text-white font-bold">You</span>
                  : <Bot className="w-3 h-3 text-white" />}
              </div>
              <div className={cn('max-w-[78%] px-4 py-3 rounded-3xl text-sm shadow-sm',
                m.role === 'user'
                  ? 'gradient-primary text-primary-foreground rounded-tr-md'
                  : 'bg-surface-container-low text-foreground border-0 rounded-tl-md')}>
                {m.text}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-white" />
              </div>
              <div className="bg-background border border-border/50 rounded-2xl rounded-tl-sm px-3 py-2">
                <div className="flex gap-1">
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Waveform (while recording) */}
      {isRecording && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-800/30">
          <Waveform level={level} />
          <p className="text-center text-xs text-red-600 mt-1">Listening… tap mic to stop</p>
        </div>
      )}

      {/* Text input (keyboard mode) */}
      {showKeyboard && (
        <div className="px-3 py-2 border-t border-border/50 bg-background flex gap-2">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your question..."
            className="flex-1 h-9 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { sendText(text); } }}
            disabled={isProcessing}
            autoFocus
          />
          <Button size="icon" className="h-9 w-9" onClick={() => sendText(text)} disabled={!text.trim() || isProcessing}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-t border-border/50">
        {/* Keyboard toggle */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => setShowKeyboard(s => !s)}
          title="Toggle keyboard"
        >
          <Keyboard className="w-4 h-4" />
        </Button>

        {/* Mic button */}
        <div className="relative">
          {isRecording && (
            <>
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
              <span className="absolute inset-0 rounded-full bg-red-400 animate-pulse opacity-20" />
            </>
          )}
          <button
            onClick={() => isRecording ? stopRecording() : startRecording()}
            disabled={isProcessing}
            className={cn(
              'relative z-10 flex items-center justify-center w-14 h-14 rounded-full shadow-glow transition-all duration-300 active:scale-95 disabled:opacity-50 hover-lift',
              isRecording
                ? 'bg-destructive hover:bg-destructive/90'
                : 'gradient-primary'
            )}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>
        </div>

        {/* Speak last response / stop */}
        <Button
          variant="outline"
          size="icon"
          className={cn('h-9 w-9 rounded-full', isSpeaking && 'border-green-500 text-green-600')}
          onClick={() => {
            if (isSpeaking) { stopSpeech(); return; }
            const last = [...msgs].reverse().find(m => m.role === 'assistant');
            if (last) speak(last.text.substring(0, 300));
          }}
          title={isSpeaking ? 'Stop speaking' : 'Replay response'}
          disabled={msgs.filter(m => m.role === 'assistant').length === 0 && !isSpeaking}
        >
          {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
      </div>

      <p className="text-[10px] text-center text-muted-foreground pb-2">
        Tap mic · Ask in Hindi, Punjabi, Gujarati or any language
      </p>
    </div>
  );
}
