import { useEffect, useRef, useState } from 'react';
// @ts-ignore - vosk-browser is a UMD script with no types
import voskScriptUrl from 'vosk-browser/dist/vosk.js?url';
import type { SttLang } from '../../../shared/stt';

export type SttStatus =
  | { kind: 'idle' }
  | { kind: 'preparing'; lang: SttLang; stage: string; pct: number } // download / extract / pack (main)
  | { kind: 'loading'; lang: SttLang } // Vosk worker fetching + unpacking the model
  | { kind: 'listening'; lang: SttLang }
  | { kind: 'error'; message: string; micBlocked?: boolean };

export interface UseSpeechRecognitionOptions {
  enabled: boolean;
  lang: SttLang;
  onResult: (text: string, isPartial: boolean) => void;
}

// Pipeline counters for probes/DevTools: `window.__stt` (audio chunks in, Vosk events out).
const stats = { chunks: 0, partials: 0, results: 0, lastPartial: '', lastResult: '' };
(window as any).__stt = stats;

// Module-level so the model survives listen toggles, StrictMode remounts and mode switches.
let voskScript: Promise<void> | null = null;
// One live model at a time: each is a worker holding the unpacked model in memory.
let loaded: { lang: SttLang; promise: Promise<any> } | null = null;

function loadVoskScript(): Promise<void> {
  if (window.Vosk) return Promise.resolve();
  voskScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = voskScriptUrl;
    script.onload = () => (window.Vosk ? resolve() : reject(new Error('Vosk script loaded without window.Vosk')));
    script.onerror = () => reject(new Error('Failed to load Vosk script'));
    document.head.appendChild(script);
  }).catch((e) => {
    voskScript = null;
    throw e;
  });
  return voskScript;
}

const MODEL_LOAD_TIMEOUT_MS = 120_000;

// Vosk.createModel() only listens for 'load' — a worker failure leaves it pending
// forever. Listen for the worker's error paths too, and give up after a timeout.
function createModel(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const model = new window.Vosk.Model(url);
    const fail = (msg: string) => {
      clearTimeout(timer);
      model.terminate();
      reject(new Error(msg));
    };
    const timer = setTimeout(() => fail('Model load timed out'), MODEL_LOAD_TIMEOUT_MS);
    model.on('load', (m: any) => {
      clearTimeout(timer);
      m.result ? resolve(model) : fail('Model failed to load');
    });
    model.on('error', (m: any) => fail(`Model load failed: ${m.error ?? 'unknown error'}`));
    model.worker?.addEventListener('error', (e: ErrorEvent) => fail(`Vosk worker error: ${e.message}`));
  });
}

function loadModel(lang: SttLang, onStatus: (s: SttStatus) => void): Promise<any> {
  if (loaded?.lang === lang) return loaded.promise;
  const previous = loaded?.promise;
  const promise = (async () => {
    previous?.then((m) => m.terminate()).catch(() => {});
    await loadVoskScript();
    const api = window.teleprompter;
    let { url } = await api.sttModelStatus(lang);
    if (!url) {
      onStatus({ kind: 'preparing', lang, stage: 'downloading', pct: 0 });
      const res = await api.sttModelPrepare(lang, (p) => onStatus({ kind: 'preparing', lang, stage: p.stage, pct: p.pct }));
      if (!res.ok || !res.url) throw new Error(res.error || 'Model download failed');
      url = res.url;
    }
    onStatus({ kind: 'loading', lang });
    const t0 = performance.now();
    const model = await createModel(url);
    console.info(`[stt] ${lang} model ready in ${Math.round(performance.now() - t0)}ms`);
    return model;
  })().catch((e) => {
    if (loaded?.promise === promise) loaded = null; // allow retry on next toggle
    throw e;
  });
  loaded = { lang, promise };
  return promise;
}

export function useSpeechRecognition({ enabled, lang, onResult }: UseSpeechRecognitionOptions): SttStatus {
  const [status, setStatus] = useState<SttStatus>({ kind: 'idle' });
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!enabled) {
      setStatus({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let recognizer: any = null;
    const set = (s: SttStatus) => {
      if (!cancelled) setStatus(s);
    };

    (async () => {
      let model: any;
      try {
        model = await loadModel(lang, set);
      } catch (e: any) {
        console.error('[stt] model load failed', e);
        set({ kind: 'error', message: e?.message || String(e) });
        return;
      }
      if (cancelled) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
        });
      } catch (e: any) {
        console.error('[stt] getUserMedia failed', e);
        const blocked = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
        set({ kind: 'error', message: blocked ? 'Mic blocked' : `Mic error: ${e?.message || e}`, micBlocked: blocked });
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Chromium resamples the mic stream into a 16 kHz context — Vosk's native rate.
      ctx = new AudioContext({ sampleRate: 16000 });
      recognizer = new model.KaldiRecognizer(ctx.sampleRate);
      recognizer.on('result', (m: any) => {
        const text = m?.result?.text ?? '';
        stats.results++;
        stats.lastResult = text;
        if (text) console.debug('[stt] result:', text);
        onResultRef.current(text, false);
      });
      recognizer.on('partialresult', (m: any) => {
        const partial = m?.result?.partial ?? '';
        stats.partials++;
        stats.lastPartial = partial;
        onResultRef.current(partial, true);
      });

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        stats.chunks++;
        try {
          recognizer?.acceptWaveform(e.inputBuffer);
        } catch (err) {
          console.warn('[stt] acceptWaveform failed', err);
        }
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      await ctx.resume().catch(() => {});
      console.info('[stt] listening', { sampleRate: ctx.sampleRate, mic: stream.getAudioTracks()[0]?.label });
      set({ kind: 'listening', lang });
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      try {
        recognizer?.remove();
      } catch {}
    };
  }, [enabled, lang]);

  return status;
}
