import type { SttStatus } from '../hooks/useSpeechRecognition';
import { STT_LANG_NAMES } from '../../../shared/stt';

const STAGES: Record<string, string> = {
  downloading: 'Downloading',
  extracting: 'Extracting',
  packaging: 'Packing'
};

/** Short human label for the STT pipeline state, or null when there's nothing to say. */
export function sttLabel(s: SttStatus | null | undefined): string | null {
  if (!s) return null;
  switch (s.kind) {
    case 'idle':
      return null;
    case 'preparing': {
      const stage = STAGES[s.stage];
      const model = `${STT_LANG_NAMES[s.lang]} model`;
      if (!stage) return `Loading ${model}…`;
      return s.stage === 'downloading'
        ? `${stage} ${model}… ${Math.round(s.pct * 100)}%`
        : `${stage} ${model}…`;
    }
    case 'loading':
      return `Loading ${STT_LANG_NAMES[s.lang]} model…`;
    case 'listening':
      return `Listening · ${s.lang.toUpperCase()}`;
    case 'error':
      return s.message;
  }
}

/** States the user must see without hovering: progress and failures. */
export function sttNeedsAttention(s: SttStatus | null | undefined): boolean {
  return !!s && (s.kind === 'preparing' || s.kind === 'loading' || s.kind === 'error');
}
