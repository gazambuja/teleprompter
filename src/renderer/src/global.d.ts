import type { AppSettings } from '../../shared/settings';
import type { SttLang } from '../../shared/stt';

export interface TeleprompterApi {
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<AppSettings>;
  openTextFile: () => Promise<{ path: string; text: string } | null>;
  saveTextFile: (text: string, path?: string | null) => Promise<string | null>;
  setAlwaysOnTop: (level: 'floating' | 'normal' | 'panel') => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setBounds: (opts: { x?: number; y?: number; width?: number; height?: number }) => Promise<void>;
  setIgnoreMouse: (enabled: boolean) => Promise<void>;
  closeWindow: () => Promise<void>;
  getVersion: () => Promise<string>;
  sttModelStatus: (lang: SttLang) => Promise<{ ready: boolean; url: string | null }>;
  sttModelPrepare: (
    lang: SttLang,
    onProgress: (msg: { stage: string; pct: number }) => void
  ) => Promise<{ ok: boolean; url?: string; error?: string }>;
  sttModelCancel: () => Promise<void>;
}

declare global {
  interface Window {
    teleprompter: TeleprompterApi;
    Vosk?: any;
  }
}
