import type { AppSettings } from './settings';

export type ThemeId =
  | 'studio'
  | 'paper'
  | 'phosphor'
  | 'midnight'
  | 'on-air'
  | 'solarized'
  | 'contrast';

export interface Theme {
  id: ThemeId;
  name: string;
  textColor: string;
  highlightColor: string; // focus line + UI accent
  bgColor: string;        // backdrop + UI surfaces
  spokenColor: string;    // words already said (speech follow) + listening status
  fontFamily: AppSettings['fontFamily'];
}

// The whole UI derives from these colors (see applyThemeVars), so a preset reskins the
// chrome as well as the script.
export const THEMES: Theme[] = [
  { id: 'studio', name: 'Studio', textColor: '#f5f1ea', highlightColor: '#e4b860', bgColor: '#0a0b0d', spokenColor: '#7dd3c0', fontFamily: 'newsreader' },
  { id: 'paper', name: 'Paper', textColor: '#1f1b16', highlightColor: '#b8431f', bgColor: '#f3ede1', spokenColor: '#2e7a68', fontFamily: 'newsreader' },
  { id: 'phosphor', name: 'Phosphor', textColor: '#c2f7cf', highlightColor: '#3dff8b', bgColor: '#03120a', spokenColor: '#7fdcff', fontFamily: 'inter' },
  { id: 'midnight', name: 'Midnight', textColor: '#dfe6ff', highlightColor: '#82a8ff', bgColor: '#0a0f1f', spokenColor: '#9be8c9', fontFamily: 'system' },
  { id: 'on-air', name: 'On Air', textColor: '#f8ece6', highlightColor: '#ff5a3c', bgColor: '#150807', spokenColor: '#ffc27a', fontFamily: 'system' },
  { id: 'solarized', name: 'Solarized', textColor: '#eee8d5', highlightColor: '#d6a21e', bgColor: '#002b36', spokenColor: '#2aa198', fontFamily: 'newsreader' },
  { id: 'contrast', name: 'Contrast', textColor: '#ffffff', highlightColor: '#ffe600', bgColor: '#000000', spokenColor: '#00e5ff', fontFamily: 'system' }
];

export function getTheme(id: ThemeId | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Settings a preset writes. The user can still tweak each color afterwards. */
export function themeSettings(t: Theme): Partial<AppSettings> {
  return {
    theme: t.id,
    textColor: t.textColor,
    highlightColor: t.highlightColor,
    bgColor: t.bgColor,
    fontFamily: t.fontFamily
  };
}

/** True while the settings still match the preset exactly (no custom color edits). */
export function isThemeIntact(t: Theme, s: AppSettings): boolean {
  return (
    s.textColor.toLowerCase() === t.textColor &&
    s.highlightColor.toLowerCase() === t.highlightColor &&
    s.bgColor.toLowerCase() === t.bgColor
  );
}

/** '#rrggbb' → 'r g b', the channel form Tailwind's `rgb(var(--x) / <alpha>)` needs. */
export function hexToChannels(hex: string): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0).join(' ');
}
