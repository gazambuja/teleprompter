import { useEffect, type RefObject } from 'react';
import { FolderOpen, Mic, PenLine, Square } from 'lucide-react';
import type { AppSettings } from '../../../shared/settings';
import type { SttStatus } from '../hooks/useSpeechRecognition';
import { sttLabel } from '../lib/sttLabel';

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement>;
  text: string;
  onChange: (text: string) => void;
  settings: AppSettings;
  onPlay: () => void;
  onOpenFile: () => void;
  dictating: boolean;
  /** What the recognizer is hearing right now, before it commits the phrase. */
  dictationPartial: string;
  sttStatus: SttStatus | null;
  onToggleDictate: () => void;
}

export function Editor({
  textareaRef: ref,
  text,
  onChange,
  settings,
  onPlay,
  onOpenFile,
  dictating,
  dictationPartial,
  sttStatus,
  onToggleDictate
}: Props) {
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);

  const empty = !text && !dictating;
  const live = sttStatus?.kind === 'listening';
  const sttError = sttStatus?.kind === 'error';
  const statusText = live ? null : sttLabel(sttStatus);

  return (
    <div className="absolute inset-0 pt-12 flex flex-col">
      <div className="relative flex-1 overflow-y-auto no-scrollbar">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={empty ? '' : dictating ? 'Start speaking…' : 'Paste or type your script here. Press Ctrl+Enter to begin reading.'}
          spellCheck={false}
          className="w-full h-full block resize-none outline-none px-12 py-16 leading-relaxed"
          style={{
            fontSize: settings.fontSize * 0.6,
            lineHeight: settings.lineHeight,
            fontWeight: settings.fontWeight,
            letterSpacing: `${settings.letterSpacing}em`,
            color: settings.textColor,
            caretColor: settings.highlightColor,
            fontFamily:
              settings.fontFamily === 'newsreader'
                ? '"Newsreader Variable", Georgia, serif'
                : settings.fontFamily === 'inter'
                ? '"JetBrains Mono Variable", monospace'
                : 'system-ui, sans-serif',
            background: 'transparent'
          }}
        />
        {empty && (
          // Clicks outside the three choices fall through to the textarea, so typing
          // right away still works.
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-5">
              <span className="text-[10px] uppercase tracking-[0.22em] text-paper-muted">New script</span>
              <div className="flex gap-3 pointer-events-auto">
                <EmptyChoice icon={<FolderOpen size={18} />} label="Open file" hint="Ctrl O" onClick={onOpenFile} />
                <EmptyChoice icon={<PenLine size={18} />} label="Write" hint="Type" onClick={() => ref.current?.focus()} />
                <EmptyChoice icon={<Mic size={18} />} label="Dictate" hint="Ctrl D" onClick={onToggleDictate} accent />
              </div>
            </div>
          </div>
        )}
      </div>
      {dictating && (
        <div
          data-testid="dictation-bar"
          className="px-12 py-2 border-t border-[var(--border)] flex items-center gap-3 font-mono text-[11px]"
        >
          <span
            className={[
              'block w-2 h-2 rounded-full shrink-0',
              live ? 'bg-red-500 animate-led-blink' : sttError ? 'bg-red-400' : 'bg-paper-muted'
            ].join(' ')}
          />
          <span className={['truncate', sttError ? 'text-red-400' : live ? 'text-paper-dim' : 'text-cyan/80'].join(' ')}>
            {statusText ?? (dictationPartial ? dictationPartial : 'Listening — speak and your words land at the cursor')}
          </span>
        </div>
      )}
      <div className="px-12 py-4 border-t border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-4 font-mono text-[10px] text-paper-muted">
          <span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
          <span>{text.length} chars</span>
          <span>~{Math.max(1, Math.round((text.trim() ? text.trim().split(/\s+/).length : 0) / 130))} min @ 130 wpm</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDictate}
            className={[
              'px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] font-medium rounded-sm transition-colors duration-200 ease-premium flex items-center gap-2 border',
              dictating
                ? 'text-red-400 border-red-400/50 bg-red-500/[0.08] hover:border-red-400'
                : 'text-paper-dim border-[var(--border-strong)] hover:text-paper hover:border-paper-dim'
            ].join(' ')}
            title={dictating ? 'Stop dictating (Ctrl+D)' : 'Dictate the script with your voice (Ctrl+D)'}
          >
            {dictating ? <Square size={10} fill="currentColor" /> : <Mic size={12} />}
            <span>{dictating ? 'Stop' : 'Dictate'}</span>
          </button>
          <button
            onClick={onPlay}
            disabled={!text.trim()}
            className="px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] font-medium text-amber border border-amber/40 hover:border-amber hover:bg-amber/[0.08] rounded-sm transition-colors duration-200 ease-premium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>Start reading</span>
            <kbd className="font-mono text-[9px] tracking-normal px-1 py-0.5 border border-amber/30 rounded-sm">Ctrl ↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyChoice({
  icon,
  label,
  hint,
  onClick,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-32 py-5 flex flex-col items-center gap-2.5 rounded-sm border bg-[var(--bg-glass)] backdrop-blur-xl transition-colors duration-200 ease-premium',
        accent
          ? 'text-amber border-amber/40 hover:border-amber hover:bg-amber/[0.08]'
          : 'text-paper-dim border-[var(--border-strong)] hover:text-paper hover:border-paper-dim'
      ].join(' ')}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-[0.22em] font-medium">{label}</span>
      <span className="font-mono text-[9px] text-paper-muted">{hint}</span>
    </button>
  );
}
