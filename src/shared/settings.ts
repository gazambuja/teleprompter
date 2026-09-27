import type { SttLangSetting } from './stt';
import type { ThemeId } from './themes';

export interface AppSettings {
  speed: number;        // pixels per second
  width: number;        // pixels (window width)
  height: number;       // pixels (window height)
  x?: number;           // window x position (px)
  y?: number;           // window y position (px)
  fontSize: number;     // px
  fontFamily: 'newsreader' | 'inter' | 'system';
  theme: ThemeId;      // preset the colors came from (also picks the spoken-word color)
  textColor: string;    // hex
  highlightColor: string; // hex (center line)
  bgColor: string;      // hex (with alpha for transparency)
  opacity: number;      // 0..1 (window opacity, distinct from bg alpha)
  alwaysOnTop?: 'floating' | 'normal' | 'panel'; // unset → first-launch prompt
  showControls: boolean;
  scrollMode: 'pixel' | 'line';
  mirror: boolean;      // mirror text horizontally (real teleprompters)
  fontWeight: number;   // 300..700
  lineHeight: number;   // 1..2 (multiplier)
  letterSpacing: number; // em (-0.02..0.08)
  countdown: number;    // seconds before auto-start (0 = off)
  focusLineStyle: 'line' | 'guide' | 'none';
  clickThrough: boolean;
  bgOpacity: number;    // 0..100 — background transparency
  sttLanguage: SttLangSetting; // speech model; 'auto' = detect from the script
}

export const DEFAULT_SETTINGS: AppSettings = {
  speed: 60,
  width: 760,
  height: 200,
  fontSize: 48,
  fontFamily: 'newsreader',
  theme: 'studio',
  textColor: '#f5f1ea',
  highlightColor: '#e4b860',
  bgColor: '#0a0b0d',
  opacity: 1,
  showControls: true,
  scrollMode: 'pixel',
  mirror: false,
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
  countdown: 3,
  focusLineStyle: 'guide',
  clickThrough: false,
  bgOpacity: 65,
  sttLanguage: 'auto'
};

export type WindowPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
