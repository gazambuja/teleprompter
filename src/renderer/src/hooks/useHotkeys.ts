import { useEffect } from 'react';

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone/i.test(navigator.platform);

function normalize(e: KeyboardEvent): string[] {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push(IS_MAC ? 'cmd' : 'ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  let key = e.key.toLowerCase();
  if (key === ' ') key = 'space';
  if (key === 'arrowup') key = 'up';
  if (key === 'arrowdown') key = 'down';
  if (key === 'arrowleft') key = 'left';
  if (key === 'arrowright') key = 'right';
  parts.push(key);
  return parts;
}

export function useHotkeys(handlers: HotkeyMap, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // In text fields only Escape and modifier combos (e.g. Ctrl+Enter) are shortcuts.
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        if (e.key !== 'Escape' && !e.ctrlKey && !e.metaKey) return;
      }
      const parts = normalize(e);
      const combo = parts.join('+');
      const fn = handlers[combo];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, active]);
}
