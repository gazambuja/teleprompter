import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { AppSettings } from '../shared/settings';
import type { SttLang } from '../shared/stt';

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.settingsSet, settings),
  openTextFile: (): Promise<{ path: string; text: string } | null> =>
    ipcRenderer.invoke(IPC.fileOpenText),
  saveTextFile: (text: string, path?: string | null): Promise<string | null> =>
    ipcRenderer.invoke(IPC.fileSaveText, text, path),
  setAlwaysOnTop: (level: 'floating' | 'normal' | 'panel'): Promise<void> =>
    ipcRenderer.invoke(IPC.windowSetAlwaysOnTop, level),
  setOpacity: (opacity: number): Promise<void> =>
    ipcRenderer.invoke(IPC.windowSetOpacity, opacity),
  setBounds: (opts: { x?: number; y?: number; width?: number; height?: number }): Promise<void> =>
    ipcRenderer.invoke(IPC.windowSetBounds, opts),
  setIgnoreMouse: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.windowSetIgnoreMouse, enabled),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.appGetVersion),
  sttModelStatus: (lang: SttLang): Promise<{ ready: boolean; url: string | null }> =>
    ipcRenderer.invoke(IPC.sttModelStatus, lang),
  sttModelPrepare: (
    lang: SttLang,
    onProgress: (msg: { stage: string; pct: number }) => void
  ): Promise<{ ok: boolean; url?: string; error?: string }> => {
    const channel = IPC.sttModelPrepare + ':progress';
    const listener = (_e: unknown, msg: { lang: SttLang; stage: string; pct: number }) => {
      if (msg.lang === lang) onProgress(msg);
    };
    ipcRenderer.on(channel, listener);
    const cleanup = () => ipcRenderer.removeListener(channel, listener);
    return ipcRenderer.invoke(IPC.sttModelPrepare, lang).then((res) => {
      cleanup();
      return res;
    }, (err) => {
      cleanup();
      throw err;
    });
  },
  sttModelCancel: (): Promise<void> => ipcRenderer.invoke(IPC.sttModelCancel)
};

contextBridge.exposeInMainWorld('teleprompter', api);

export type TeleprompterApi = typeof api;
