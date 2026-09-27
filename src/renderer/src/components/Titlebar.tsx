import { Settings2, FilePlus, FolderOpen, Save, Play, Mic, MicOff, X } from 'lucide-react';
import type { Mode } from '../hooks/useTeleprompter';
import type { SttStatus } from '../hooks/useSpeechRecognition';
import { sttLabel, sttNeedsAttention } from '../lib/sttLabel';

interface Props {
  text: string;
  /** Name of the file the script came from; null for a new, never-saved script. */
  fileName: string | null;
  dirty: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onPlay: () => void;
  onSettings: () => void;
  onClose: () => void;
  onListen?: () => void;
  listening?: boolean;
  /** Dictating into the editor — shares the recognizer, so its status shows here too. */
  dictating?: boolean;
  sttStatus?: SttStatus;
  /** In display mode the bar auto-hides; true while the pointer is active (useIdleReveal). */
  revealed: boolean;
  mode: Mode;
}

export function Titlebar({
  text,
  fileName,
  dirty,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onPlay,
  onSettings,
  onClose,
  onListen,
  listening,
  dictating,
  sttStatus,
  revealed,
  mode
}: Props) {
  const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(wc / 130));
  const hideOnIdle = mode === 'display';
  const micOn = !!listening || !!dictating;
  const sttAttention = micOn && sttNeedsAttention(sttStatus);
  const sttText = micOn ? sttLabel(sttStatus) : null;
  const sttError = sttStatus?.kind === 'error';
  const visible = !hideOnIdle || revealed || sttAttention;
  const canListen = mode === 'display';
  return (
    <div className="absolute top-0 inset-x-0 z-40 h-12" data-chrome>
      <header
        className={[
          'h-12 flex items-center px-3 gap-3 border-b border-[var(--border)] bg-[var(--bg-glass)] backdrop-blur-xl',
          'transition-opacity duration-300 ease-premium',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        ].join(' ')}
        style={{
          WebkitAppRegion: 'drag'
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5 pl-1.5 pr-2">
          <span
            className={[
              'block w-1.5 h-1.5 rounded-full transition-colors duration-200',
              dictating ? 'bg-red-500 animate-led-blink' : listening ? 'bg-cyan animate-led-blink' : 'bg-amber animate-led-blink'
            ].join(' ')}
          />
          <span className="font-sans text-[11px] uppercase tracking-[0.22em] text-paper">
            Teleprompter
          </span>
          <span
            className="font-mono text-[10px] text-paper-dim max-w-[180px] truncate"
            title={fileName ?? 'New script'}
          >
            {fileName ?? 'Untitled'}
            {dirty && <span className="text-amber"> •</span>}
          </span>
          <span className="font-mono text-[10px] text-paper-muted">
            {wc} w · ~{minutes}m
          </span>
        </div>

        <div
          className="flex-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onNewFile}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium flex items-center gap-1.5"
              title="New script (Ctrl+N)"
            >
              <FilePlus size={12} />
              <span>New</span>
            </button>
            <button
              onClick={onOpenFile}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium flex items-center gap-1.5"
              title="Open file (Ctrl+O)"
            >
              <FolderOpen size={12} />
              <span>Open</span>
            </button>
            <button
              onClick={onSaveFile}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium flex items-center gap-1.5"
              title="Save (Ctrl+S) · Save as (Ctrl+Shift+S)"
            >
              <Save size={12} />
              <span>Save</span>
            </button>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {sttAttention && sttText && (
            <span
              data-testid="stt-status"
              className={[
                'font-mono text-[10px] tabular-nums mr-1 max-w-[260px] truncate',
                sttError ? 'text-red-400' : 'text-cyan/80'
              ].join(' ')}
              title={sttText}
            >
              {sttText}
            </span>
          )}
          {onListen && (
            <button
              onClick={onListen}
              disabled={!canListen}
              className={[
                'px-2 py-1 text-[10px] uppercase tracking-[0.18em] rounded-sm transition-colors duration-200 ease-premium flex items-center gap-1.5',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                listening
                  ? 'text-cyan border border-cyan/40 bg-cyan/[0.08]'
                  : 'text-paper-dim hover:text-paper border border-[var(--border-strong)] hover:border-paper-dim'
              ].join(' ')}
              title={listening ? 'Stop listening (L)' : 'Start listening (L)'}
            >
              {listening ? <Mic size={12} /> : <MicOff size={12} />}
              <span>{listening ? 'Listen' : 'Listen'}</span>
            </button>
          )}
          <button
            onClick={onSettings}
            className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium flex items-center gap-1.5"
            title="Settings"
            data-panel-toggle
          >
            <Settings2 size={12} />
          </button>
          <button
            onClick={onPlay}
            disabled={!text.trim()}
            className="px-3 py-1 text-[10px] uppercase tracking-[0.22em] font-medium text-amber border border-amber/40 hover:border-amber hover:bg-amber/[0.08] rounded-sm transition-colors duration-200 ease-premium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Start reading (Ctrl+Enter)"
          >
            <Play size={12} fill="currentColor" />
            <span>Air</span>
          </button>
          <span className="mx-1 h-4 w-px bg-[var(--border-strong)]" aria-hidden="true" />
          <button
            onClick={onClose}
            className="px-1.5 py-1 text-paper-muted hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium flex items-center"
            title="Close window"
            aria-label="Close window"
          >
            <X size={14} />
          </button>
        </div>
      </header>
    </div>
  );
}
