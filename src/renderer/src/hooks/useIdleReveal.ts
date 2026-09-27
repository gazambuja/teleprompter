import { useEffect, useState } from 'react';

/**
 * Video-player style chrome: true while the pointer is moving, false after `timeoutMs`
 * of stillness or when it leaves the window. Resting on an element marked `data-chrome`
 * (titlebar, status bar, panel) keeps it revealed so controls don't vanish under the
 * cursor. Keyboard input deliberately doesn't reveal — Space/arrows drive the reading.
 */
export function useIdleReveal(timeoutMs = 2500): boolean {
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRevealed(false), timeoutMs);
    };
    const poke = (e: Event) => {
      setRevealed(true);
      const onChrome = !!(e.target as Element | null)?.closest?.('[data-chrome]');
      if (onChrome) {
        if (timer) clearTimeout(timer);
        timer = null;
      } else {
        arm();
      }
    };
    const leave = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      setRevealed(false);
    };
    arm();
    window.addEventListener('mousemove', poke, { passive: true });
    window.addEventListener('mousedown', poke, { passive: true });
    window.addEventListener('wheel', poke, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('mousemove', poke);
      window.removeEventListener('mousedown', poke);
      window.removeEventListener('wheel', poke);
      document.documentElement.removeEventListener('mouseleave', leave);
    };
  }, [timeoutMs]);

  return revealed;
}
