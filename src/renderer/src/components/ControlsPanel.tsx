import { Settings2, X } from 'lucide-react';
import { Slider } from './ui/Slider';
import { Section } from './ui/Section';
import type { AppSettings } from '../../../shared/settings';
import { STT_LANG_NAMES, type SttLang, type SttLangSetting } from '../../../shared/stt';
import { THEMES, themeSettings, isThemeIntact } from '../../../shared/themes';

const LANG_OPTIONS: { value: SttLangSetting; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' }
];

const FONT_OPTIONS: { value: AppSettings['fontFamily']; label: string }[] = [
  { value: 'newsreader', label: 'Serif' },
  { value: 'system', label: 'Sans' },
  { value: 'inter', label: 'Mono' }
];

interface Props {
  settings: AppSettings;
  detectedLang: SttLang;
  update: (partial: Partial<AppSettings>) => void;
  open: boolean;
  onClose: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onReset: () => void;
}

function speedToWPM(px: number, fontSize: number, lineHeight: number): number {
  const linePx = fontSize * lineHeight;
  if (linePx <= 0) return 0;
  const linesPerSec = px / linePx;
  return Math.round(linesPerSec * 60);
}

export function ControlsPanel({
  settings,
  detectedLang,
  update,
  open,
  onClose,
  onOpenFile,
  onSaveFile,
  onReset
}: Props) {
  const wpm = speedToWPM(settings.speed, settings.fontSize, settings.lineHeight);

  return (
    <aside
      aria-hidden={!open}
      data-chrome
      data-panel
      className={[
        // Below the titlebar (h-12) so the two never overlap; narrower on small windows.
        'fixed top-12 right-0 bottom-0 w-[min(340px,100vw)] z-30',
        'bg-[var(--bg-panel)] backdrop-blur-xl',
        'border-l border-[var(--border)] shadow-panel',
        'flex flex-col',
        'transition-transform ease-premium duration-300',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      ].join(' ')}
    >
      <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-amber" />
          <span className="font-sans text-[11px] uppercase tracking-[0.22em] text-paper">
            Studio
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-paper-muted hover:text-paper transition-colors duration-200 ease-premium"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <Section title="Timing">
          <Slider
            label="Scroll speed"
            value={settings.speed}
            min={10}
            max={400}
            step={1}
            onChange={(v) => update({ speed: v })}
            display={() => `${settings.speed} px/s · ${wpm} wpm`}
          />
        </Section>

        <Section title="Voice">
          <div>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-paper-muted mb-2">
              Listen language
            </span>
            <div className="grid grid-cols-3 gap-1">
              {LANG_OPTIONS.map(({ value, label }) => {
                const active = (settings.sttLanguage ?? 'auto') === value;
                return (
                  <button
                    key={value}
                    onClick={() => update({ sttLanguage: value })}
                    className={[
                      'px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm',
                      'border transition-colors duration-200 ease-premium',
                      active
                        ? 'border-cyan text-cyan bg-cyan/[0.08]'
                        : 'border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim'
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-paper-muted leading-tight">
              {(settings.sttLanguage ?? 'auto') === 'auto'
                ? `Detected from script: ${STT_LANG_NAMES[detectedLang]}.`
                : 'Fixed, regardless of the script.'}{' '}
              Each model (~40 MB) downloads on first use.
            </p>
          </div>
        </Section>

        <Section title="Scale">
          <Slider
            label="Font size"
            unit="px"
            value={settings.fontSize}
            min={20}
            max={120}
            step={1}
            onChange={(v) => update({ fontSize: v })}
          />
          <Slider
            label="Weight"
            value={settings.fontWeight}
            min={300}
            max={700}
            step={100}
            display={(v) => v.toString()}
            onChange={(v) => update({ fontWeight: v })}
          />
          <Slider
            label="Line height"
            value={settings.lineHeight}
            min={1}
            max={2}
            step={0.05}
            display={(v) => v.toFixed(2)}
            onChange={(v) => update({ lineHeight: v })}
          />
          <Slider
            label="Tracking"
            value={settings.letterSpacing}
            min={-0.02}
            max={0.08}
            step={0.005}
            display={(v) => `${(v * 1000).toFixed(0)}‰`}
            onChange={(v) => update({ letterSpacing: v })}
          />
        </Section>

        <Section
          title="Theme"
          hint={THEMES.some((t) => t.id === settings.theme && isThemeIntact(t, settings)) ? undefined : 'Custom'}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {THEMES.map((t) => {
              const active = settings.theme === t.id && isThemeIntact(t, settings);
              return (
                <button
                  key={t.id}
                  onClick={() => update(themeSettings(t))}
                  title={t.name}
                  aria-pressed={active}
                  className={[
                    'group flex flex-col items-center gap-1 p-1 rounded-sm border',
                    'transition-colors duration-200 ease-premium',
                    active ? 'border-amber' : 'border-transparent hover:border-[var(--border-strong)]'
                  ].join(' ')}
                >
                  <span
                    className="w-full h-9 rounded-[3px] flex flex-col justify-center gap-[3px] px-1.5"
                    style={{ background: t.bgColor, boxShadow: 'inset 0 0 0 1px rgb(var(--paper) / 0.12)' }}
                  >
                    <span className="block h-[2px] w-3/4 rounded-full opacity-50" style={{ background: t.textColor }} />
                    <span className="block h-[3px] w-full rounded-full" style={{ background: t.highlightColor }} />
                    <span className="block h-[2px] w-2/3 rounded-full" style={{ background: t.spokenColor }} />
                  </span>
                  <span
                    className={[
                      'text-[9px] uppercase tracking-[0.12em] truncate max-w-full',
                      active ? 'text-amber' : 'text-paper-dim group-hover:text-paper'
                    ].join(' ')}
                  >
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-paper-muted mb-2">
              Font
            </span>
            <div className="grid grid-cols-3 gap-1">
              {FONT_OPTIONS.map(({ value, label }) => {
                const active = settings.fontFamily === value;
                return (
                  <button
                    key={value}
                    onClick={() => update({ fontFamily: value })}
                    className={[
                      'px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm',
                      'border transition-colors duration-200 ease-premium',
                      active
                        ? 'border-amber text-amber bg-amber/[0.08]'
                        : 'border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim'
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Surface">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-paper-muted">
              Text
            </span>
            <input
              type="color"
              value={settings.textColor}
              onChange={(e) => update({ textColor: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-paper-muted">
              Highlight
            </span>
            <input
              type="color"
              value={settings.highlightColor}
              onChange={(e) => update({ highlightColor: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-paper-muted">
              Backdrop
            </span>
            <input
              type="color"
              value={settings.bgColor}
              onChange={(e) => update({ bgColor: e.target.value })}
            />
          </div>
          <Slider
            label="Opacity"
            unit="%"
            value={Math.round(settings.opacity * 100)}
            min={20}
            max={100}
            step={1}
            onChange={(v) => update({ opacity: v / 100 })}
            display={(v) => `${v}%`}
          />
          <Slider
            label="Backdrop"
            unit="%"
            value={settings.bgOpacity}
            min={0}
            max={100}
            step={1}
            onChange={(v) => update({ bgOpacity: v })}
            display={(v) => `${v}%`}
          />
        </Section>

        <Section title="Window">
          <div>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-paper-muted mb-2">
              Always on top
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(['floating', 'normal', 'panel'] as const).map((level) => {
                const active = settings.alwaysOnTop === level;
                return (
                  <button
                    key={level}
                    onClick={() => {
                      update({ alwaysOnTop: level });
                      const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
                      api?.setAlwaysOnTop(level);
                    }}
                    className={[
                      'px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm',
                      'border transition-colors duration-200 ease-premium',
                      active
                        ? 'border-amber text-amber bg-amber/[0.08]'
                        : 'border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim'
                    ].join(' ')}
                  >
                    {level === 'floating' ? 'Above' : level === 'panel' ? 'Panel' : 'Normal'}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-paper-muted mb-2">
              Mirror
            </span>
            <button
              onClick={() => update({ mirror: !settings.mirror })}
              className={[
                'w-full px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm border transition-colors duration-200 ease-premium',
                settings.mirror
                  ? 'border-amber text-amber bg-amber/[0.08]'
                  : 'border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim'
              ].join(' ')}
            >
              {settings.mirror ? 'On (Reflected)' : 'Off'}
            </button>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-paper-muted mb-2">
              Mouse passthrough
            </span>
            <button
              onClick={async () => {
                const next = !settings.clickThrough;
                update({ clickThrough: next });
                const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
                await api?.setIgnoreMouse(next);
              }}
              className={[
                'w-full px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm border transition-colors duration-200 ease-premium',
                settings.clickThrough
                  ? 'border-amber text-amber bg-amber/[0.08]'
                  : 'border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim'
              ].join(' ')}
            >
              {settings.clickThrough ? 'Release to take back' : 'Click-through window'}
            </button>
            <p className="mt-1.5 font-mono text-[10px] text-paper-muted leading-tight">
              {settings.clickThrough
                ? 'Clicks behind the window. Use Alt+Space to show.'
                : 'Toggle so you can click slides behind the teleprompter.'}
            </p>
          </div>
        </Section>

        <Section title="File">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={onOpenFile}
              className="px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm border border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim transition-colors duration-200 ease-premium"
            >
              Open file
            </button>
            <button
              onClick={onSaveFile}
              className="px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm border border-[var(--border-strong)] text-paper-dim hover:text-paper hover:border-paper-dim transition-colors duration-200 ease-premium"
            >
              Save file
            </button>
          </div>
          <button
            onClick={onReset}
            className="w-full px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] rounded-sm border border-[var(--border-strong)] text-paper-muted hover:text-paper-dim hover:border-paper-dim transition-colors duration-200 ease-premium"
          >
            Reset to defaults
          </button>
        </Section>
      </div>

      <footer className="px-5 py-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between font-mono text-[10px] text-paper-muted">
          <span>v0.1.1 · electron</span>
          <span className="flex items-center gap-1.5">
            <span
              className={[
                'w-1.5 h-1.5 rounded-full',
                settings.opacity > 0.5 ? 'bg-amber animate-led-blink' : 'bg-paper-muted'
              ].join(' ')}
            />
            <span className="uppercase tracking-[0.2em]">
              {settings.opacity > 0.5 ? 'On Air' : 'Idle'}
            </span>
          </span>
        </div>
      </footer>
    </aside>
  );
}
