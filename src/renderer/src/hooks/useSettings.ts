import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../shared/settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards flush(): before getSettings() resolves, `settings` is DEFAULT_SETTINGS and
  // flushing it (StrictMode unmount, early reload) would clobber settings.json.
  const loadedRef = useRef(false);

  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
    if (!api) return; // no IPC, defaults already in place
    api
      .getSettings()
      .then((s) => {
        loadedRef.current = true;
        setSettings(s);
      })
      .catch((err) => {
        console.warn('Failed to load settings', err);
      });
  }, []);

  const update = useCallback(
    (partial: Partial<AppSettings>, opts?: { transient?: boolean }) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
        if (!api || opts?.transient) return next;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveTimer.current = null;
          api.setSettings(next).catch(console.warn);
        }, 120);
        return next;
      });
    },
    []
  );

  const flush = useCallback(() => {
    const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
    if (!api || !loadedRef.current || !saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    setSettings((prev) => {
      api.setSettings(prev).catch(console.warn);
      return prev;
    });
  }, []);

  useEffect(() => {
    const handler = () => flush();
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      flush();
    };
  }, [flush]);

  return { settings, update } as const;
}
