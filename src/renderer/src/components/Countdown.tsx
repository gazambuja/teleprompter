import { useEffect, useState } from 'react';

interface Props {
  count: number;
  onDone: () => void;
  onCancel: () => void;
}

export function Countdown({ count, onDone, onCancel }: Props) {
  const [n, setN] = useState(count);

  useEffect(() => {
    if (n <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setN((v) => v - 1), 800);
    return () => clearTimeout(t);
  }, [n, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div
          key={n}
          className="font-serif text-[10rem] leading-none text-amber tabular-nums"
          style={{
            fontFamily: '"Newsreader Variable", Georgia, serif',
            fontWeight: 300,
            textShadow: '0 0 80px rgb(var(--accent) / 0.4)',
            animation: 'fadein 280ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {n}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-muted">
          Stand by · press Esc to cancel
        </p>
      </div>
    </div>
  );
}
