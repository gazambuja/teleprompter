import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { AppSettings } from '../../../shared/settings';
import type { SttStatus } from '../hooks/useSpeechRecognition';
import { sttLabel, sttNeedsAttention } from '../lib/sttLabel';
import type { MarkdownDoc } from '../lib/markdown';
import { MarkdownBody } from './MarkdownBody';

interface Props {
  text: string;
  /** Rendered instead of `text` for Markdown scripts; `spokenEnd` then indexes `markdown.plain`. */
  markdown?: MarkdownDoc | null;
  scrollerRef: React.RefObject<HTMLDivElement>;
  highlightRef: React.RefObject<HTMLDivElement>;
  spokenRef?: React.RefObject<HTMLDivElement>;
  /** Char offset in `text` up to which the reader has spoken. */
  spokenEnd?: number;
  playing: boolean;
  done: boolean;
  progress: number;
  onToggle: () => void;
  sttStatus?: SttStatus | null;
  matchRate?: number | null;
  currentSpeed?: number;
  /** Pointer recently active (see useIdleReveal) — shows the status bar and cursor. */
  chromeVisible: boolean;
  onOpenSettings: () => void;
  onOpenEditor: () => void;
  settings: AppSettings;
}

function fontStack(family: AppSettings['fontFamily']): string {
  if (family === 'newsreader') return '"Newsreader Variable", Georgia, serif';
  if (family === 'inter') return '"JetBrains Mono Variable", ui-monospace, monospace';
  return 'system-ui, sans-serif';
}

export function Teleprompter({
  text,
  markdown,
  scrollerRef,
  highlightRef,
  spokenRef,
  spokenEnd = 0,
  playing,
  done,
  progress,
  onToggle,
  sttStatus,
  matchRate,
  currentSpeed,
  chromeVisible,
  onOpenSettings,
  onOpenEditor,
  settings
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // padding to vertically center the 3 visible lines around viewport middle
  // line 2 (center line) lands at exactly viewport-center when:
  //   padding = (viewportHeight)/2 - 1.5 * lineHeight
  // expressed in vh + em so it adapts to window resize + font-size changes
  const paddingVertical = `max(0px, calc(50vh - ${1.5 * settings.lineHeight}em))`;

  const paragraphStyle = (color: string, extra: Partial<CSSProperties> = {}): CSSProperties => ({
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    fontWeight: settings.fontWeight,
    letterSpacing: `${settings.letterSpacing}em`,
    fontFamily: fontStack(settings.fontFamily),
    color,
    transform: settings.mirror ? 'scaleX(-1)' : 'none',
    paddingTop: paddingVertical,
    paddingBottom: paddingVertical,
    paddingLeft: '3rem',
    paddingRight: '3rem',
    textAlign: 'left',
    margin: 0,
    ...extra
  });

  const mutedColor = 'rgb(var(--paper) / 0.42)';

  // The spoken overlay mounts on the first matched word — align it with the base
  // scroller right away instead of waiting for the next scroll frame.
  const spokenMounted = spokenEnd > 0;
  useLayoutEffect(() => {
    if (spokenMounted && spokenRef?.current && scrollerRef.current) {
      spokenRef.current.scrollTop = scrollerRef.current.scrollTop;
    }
  }, [spokenMounted, spokenRef, scrollerRef]);

  const sttAttention = sttNeedsAttention(sttStatus);
  const sttText =
    sttStatus?.kind === 'listening' && matchRate != null
      ? `Listening · ${sttStatus.lang.toUpperCase()} · ${Math.round(matchRate * 100)}% match`
      : sttLabel(sttStatus);
  const showStatusBar = chromeVisible || done || sttAttention;
  // While listening, pauses are the reader's silences and resume by voice — a centre
  // prompt would flash over the text at every breath.
  const showPrompt = done || (!playing && !sttStatus);

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: 'transparent', cursor: chromeVisible ? 'default' : 'none' }}
    >
      {/* Top + bottom fades */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none z-20"
        style={{
          height: '38%',
          background: `linear-gradient(to bottom, ${settings.bgColor} 0%, transparent 100%)`
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-20"
        style={{
          height: '38%',
          background: `linear-gradient(to top, ${settings.bgColor} 0%, transparent 100%)`
        }}
      />

      {/* Studio focus marks (left and right of the centre band) */}
      <div className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col gap-1.5">
        <div className="w-5 h-px bg-amber/40" />
        <div className="w-3 h-px bg-amber/30" />
        <div className="w-1.5 h-px bg-amber/20" />
      </div>
      <div className="absolute inset-y-0 right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col gap-1.5 items-end">
        <div className="w-5 h-px bg-amber/40" />
        <div className="w-3 h-px bg-amber/30" />
        <div className="w-1.5 h-px bg-amber/20" />
      </div>

      {/* Subtle horizontal focus line */}
      <div
        className="absolute inset-x-10 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
        aria-hidden="true"
      >
        <div className="h-px bg-amber/[0.10]" />
      </div>

      {/* Base scroller (muted text) */}
      <div ref={scrollerRef} className="absolute inset-0 overflow-y-auto no-scrollbar">
        {markdown ? (
          <div style={paragraphStyle(mutedColor)}>
            <MarkdownBody doc={markdown} layer="base" spokenEnd={spokenEnd} fontWeight={settings.fontWeight} />
          </div>
        ) : (
          <p style={paragraphStyle(mutedColor)}>{text}</p>
        )}
      </div>

      {/* Spoken overlay (cyan, only previously said words) */}
      {spokenEnd > 0 && spokenRef && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
          <div ref={spokenRef} className="absolute inset-0 overflow-y-auto no-scrollbar">
            {/* Full text with the unspoken rest hidden: identical wrapping and scroll height
                to the base layer, so scrollTop sync never clamps. */}
            {markdown ? (
              <div style={paragraphStyle('rgb(var(--spoken))')}>
                <MarkdownBody doc={markdown} layer="spoken" spokenEnd={spokenEnd} fontWeight={settings.fontWeight} />
              </div>
            ) : (
              <p style={paragraphStyle('rgb(var(--spoken))')}>
                <span data-spoken>{text.slice(0, spokenEnd)}</span>
                <span style={{ visibility: 'hidden' }}>{text.slice(spokenEnd)}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Highlight overlay (clipped to centre band via mask) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none z-[5]"
        style={{
          WebkitMaskImage:
            'radial-gradient(ellipse 78% 30% at 50% 50%, black 0%, black 55%, transparent 95%)',
          maskImage:
            'radial-gradient(ellipse 78% 30% at 50% 50%, black 0%, black 55%, transparent 95%)'
        }}
      >
        <div ref={highlightRef} className="absolute inset-0 overflow-y-auto no-scrollbar">
          {/* Spoken words are see-through here so the cyan layer shows inside the focus band:
              cyan = already said, amber = up next. */}
          {markdown ? (
            <div style={paragraphStyle(settings.highlightColor)}>
              <MarkdownBody doc={markdown} layer="highlight" spokenEnd={spokenEnd} fontWeight={settings.fontWeight} />
            </div>
          ) : (
            <p style={paragraphStyle(settings.highlightColor)}>
              {spokenEnd > 0 && <span style={{ color: 'transparent' }}>{text.slice(0, spokenEnd)}</span>}
              {text.slice(spokenEnd)}
            </p>
          )}
        </div>
      </div>

      {/* Right-edge progress rail */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 h-[60%] w-[2px] z-20 pointer-events-none">
        <div className="absolute inset-0 bg-paper/[0.06] rounded-full" />
        <div
          className="absolute top-0 left-0 right-0 bg-amber rounded-full transition-[height] duration-100 ease-premium"
          style={{
            height: `${Math.round(progress * 100)}%`,
            boxShadow: '0 0 8px rgb(var(--accent) / 0.6)'
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber"
          style={{
            top: `calc(${Math.round(progress * 100)}% - 4px)`,
            boxShadow: '0 0 12px rgb(var(--accent) / 0.8)'
          }}
        />
      </div>

      {/* Standby / end-of-script prompt — below the focus band so it never covers the
          line being read; inert while hidden. */}
      <div
        className={[
          'absolute inset-x-0 bottom-12 z-30 flex items-center justify-center pointer-events-none',
          'transition-opacity duration-300 ease-premium',
          showPrompt ? 'opacity-100' : 'opacity-0'
        ].join(' ')}
        aria-hidden={!showPrompt}
      >
        <button
          onClick={onToggle}
          tabIndex={showPrompt ? 0 : -1}
          className={[
            showPrompt ? 'pointer-events-auto' : 'pointer-events-none',
            'group inline-flex items-center gap-3 px-5 py-2.5 rounded-full',
            'bg-[var(--bg-glass)] backdrop-blur-xl',
            'border transition-colors duration-200 ease-premium',
            done
              ? 'border-amber/60 text-amber hover:bg-amber/[0.08]'
              : 'border-amber/30 text-amber/90 hover:border-amber/50 hover:bg-amber/[0.08]'
          ].join(' ')}
        >
          {done ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 6 A3 3 0 1 0 9 6 A3 3 0 1 0 3 6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6 5 L6 7 L7.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="uppercase tracking-[0.22em] text-[10px] font-medium">Replay</span>
              <span className="opacity-40">·</span>
              <span className="uppercase tracking-[0.18em] text-[10px] font-mono">End of script</span>
            </>
          ) : (
            <>
              <span className="block w-1.5 h-1.5 rounded-full bg-amber animate-led-blink" />
              <span className="uppercase tracking-[0.22em] text-[10px] font-medium">
                {progress > 0 ? 'Resume' : 'Start'}
              </span>
              <kbd className="font-mono text-[9px] tracking-normal px-1 py-0.5 border border-amber/30 rounded-sm">
                Space
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Bottom status bar */}
      <div
        className={[
          'absolute inset-x-0 bottom-0 z-30 px-4 py-2.5 flex items-center justify-between',
          'transition-opacity duration-300 ease-premium',
          showStatusBar ? 'opacity-100' : 'opacity-0 pointer-events-none'
        ].join(' ')}
        data-chrome
        aria-hidden={!showStatusBar}
      >
        <div className="flex items-center gap-3 font-mono text-[10px] text-paper-muted">
          <span className="flex items-center gap-1.5">
            <span
              className={[
                'w-1.5 h-1.5 rounded-full transition-colors duration-200 ease-premium',
                playing ? 'bg-amber animate-led-blink' : 'bg-paper-muted'
              ].join(' ')}
            />
            <span className="uppercase tracking-[0.18em]">
              {done ? 'End' : playing ? 'On Air' : 'Standby'}
            </span>
          </span>
          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
          <span className="tabular-nums">{Math.round(currentSpeed ?? settings.speed)} px/s</span>
          {sttText && (
            <span
              data-testid="stt-readout"
              className={[
                'flex items-center gap-1.5 uppercase tracking-[0.14em]',
                sttStatus?.kind === 'error' ? 'text-red-400' : 'text-cyan'
              ].join(' ')}
            >
              <span
                className={[
                  'w-1.5 h-1.5 rounded-full',
                  sttStatus?.kind === 'error' ? 'bg-red-400' : 'bg-cyan',
                  sttStatus?.kind === 'listening' ? 'animate-led-blink' : ''
                ].join(' ')}
              />
              {sttText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenEditor}
            className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium"
          >
            Edit
          </button>
          <button
            onClick={onOpenSettings}
            data-panel-toggle
            className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-paper-dim hover:text-paper rounded-sm hover:bg-[var(--border)] transition-colors duration-200 ease-premium"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
