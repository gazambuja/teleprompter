import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Titlebar } from './components/Titlebar';
import { ControlsPanel } from './components/ControlsPanel';
import { Teleprompter } from './components/Teleprompter';
import { Editor } from './components/Editor';
import { Countdown } from './components/Countdown';
import { useSettings } from './hooks/useSettings';
import { useTeleprompter, type Mode } from './hooks/useTeleprompter';
import { useHotkeys, type HotkeyMap } from './hooks/useHotkeys';
import { useIdleReveal } from './hooks/useIdleReveal';
import { useSpeechRecognition, type SttStatus } from './hooks/useSpeechRecognition';
import { tokenize, matchRecognition } from './lib/scriptMatcher';
import { isMarkdownPath, looksLikeMarkdown, parseMarkdown } from './lib/markdown';
import { detectLanguage } from './lib/detectLanguage';
import { insertDictation } from './lib/dictation';
import { SAMPLE_TEXT } from './constants';
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/settings';
import type { SttLang } from '../../shared/stt';
import { getTheme, hexToChannels } from '../../shared/themes';

export default function App() {
  const { settings, update } = useSettings();
  const [text, setText] = useState<string>(SAMPLE_TEXT);
  const [mode, setMode] = useState<Mode>('editor');
  const [showControls, setShowControls] = useState(false);
  // Titlebar/status bar auto-hide while reading; an open panel keeps them up.
  const pointerActive = useIdleReveal();
  const chromeRevealed = pointerActive || showControls;
  const [listening, setListening] = useState(false);
  // Dictation: the editor's mic, writing recognized speech into the script at the caret.
  const [dictating, setDictating] = useState(false);
  const [dictationPartial, setDictationPartial] = useState('');
  // Fixed when dictation starts: auto-detect re-runs on every dictated phrase and a
  // language flip would reload the model mid-sentence.
  const [dictationLang, setDictationLang] = useState<SttLang>('es');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // The file the script came from (null = new, unsaved) and the text last read/written
  // there, so Save writes in place and New/Open can warn before discarding edits.
  const [filePath, setFilePath] = useState<string | null>(null);
  const [savedText, setSavedText] = useState<string>(SAMPLE_TEXT);
  const dirty = text !== savedText;

  // .md files (or unsaved scripts that look like Markdown) render formatted; STT then
  // follows the text with the syntax stripped, which is what is actually read aloud.
  const markdown = useMemo(
    () => ((filePath ? isMarkdownPath(filePath) : looksLikeMarkdown(text)) ? parseMarkdown(text) : null),
    [text, filePath]
  );
  const spokenText = markdown ? markdown.plain : text;

  // Tokenize script for STT alignment
  const tokens = useMemo(() => tokenize(spokenText), [spokenText]);
  const [spokenIndex, setSpokenIndex] = useState(0);
  const lastMatchAtRef = useRef<number>(Date.now());

  // Reset spokenIndex when text changes
  useEffect(() => {
    setSpokenIndex(0);
  }, [text]);

  // Adaptive speed based on spoken vs scroll position
  const baseSpeed = settings.speed;
  const [adaptiveSpeed, setAdaptiveSpeed] = useState(baseSpeed);

  const teleprompter = useTeleprompter(adaptiveSpeed);

  // Reset to baseSpeed when user manually changes the slider
  useEffect(() => {
    setAdaptiveSpeed(settings.speed);
  }, [settings.speed]);

  const confirmDiscard = useCallback(
    () => !dirty || !text.trim() || window.confirm('Discard unsaved changes to the current script?'),
    [dirty, text]
  );

  const handleOpenFile = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
    if (!api || !confirmDiscard()) return;
    const file = await api.openTextFile();
    if (!file) return;
    setDictating(false);
    setText(file.text);
    setSavedText(file.text);
    setFilePath(file.path);
    setMode('editor');
  }, [confirmDiscard]);

  const handleNewFile = useCallback(() => {
    if (!confirmDiscard()) return;
    setText('');
    setSavedText('');
    setFilePath(null);
    setMode('editor');
    setShowControls(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [confirmDiscard]);

  const handleSaveFile = useCallback(async (saveAs = false) => {
    const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
    if (!api) return;
    const path = await api.saveTextFile(text, saveAs ? null : filePath);
    if (!path) return;
    setFilePath(path);
    setSavedText(text);
  }, [text, filePath]);

  // The panel is transient: a click anywhere outside it, or the window losing focus
  // (click on another app), closes it. The toggle buttons are excluded or their mousedown
  // would close it and their click reopen it.
  useEffect(() => {
    if (!showControls) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('[data-panel], [data-panel-toggle]')) return;
      setShowControls(false);
    };
    const onBlur = () => {
      // Native pickers (<input type=color>) are separate windows: focus moves there,
      // but the user is still working in the panel.
      if (document.activeElement?.closest('[data-panel]')) return;
      setShowControls(false);
    };
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [showControls]);

  const enterDisplay = useCallback(() => {
    if (!text.trim()) return;
    setShowControls(false); // the panel would cover a third of the script
    setDictating(false);
    if (settings.countdown > 0) {
      setMode('countdown');
    } else {
      setMode('display');
      teleprompter.reset();
    }
  }, [text, settings.countdown, teleprompter]);

  const exitToEditor = useCallback(() => {
    teleprompter.pause();
    setListening(false);
    setMode('editor');
  }, [teleprompter]);

  // Speech recognition — match recognized text against script
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const spokenIndexRef = useRef(spokenIndex);
  spokenIndexRef.current = spokenIndex;

  // Vosk partials repeat the whole utterance so far, so every partial is matched from
  // where the utterance started (not from spokenIndex) — otherwise already-consumed words
  // get re-matched against the words that follow them.
  const utteranceAnchorRef = useRef(0);
  const matchStatsRef = useRef({ matched: 0, total: 0 });
  const [matchRate, setMatchRate] = useState<number | null>(null);
  // Refs so the recognizer callback and the silence timer never go stale —
  // `teleprompter` is a new object every frame while scrolling.
  const playingRef = useRef(false);
  playingRef.current = teleprompter.playing;
  const doneRef = useRef(false);
  doneRef.current = teleprompter.done;
  const playRef = useRef(teleprompter.play);
  playRef.current = teleprompter.play;
  const pauseRef = useRef(teleprompter.pause);
  pauseRef.current = teleprompter.pause;

  // Dictation: partials are previewed, each final result is written in at the caret.
  const dictationPartialRef = useRef('');
  const setPartial = (t: string) => {
    dictationPartialRef.current = t;
    setDictationPartial(t);
  };
  const insertDictated = useCallback((recognizedText: string) => {
    const ta = editorRef.current;
    if (!ta || !recognizedText.trim()) return;
    const { value, caret } = insertDictation(ta.value, ta.selectionStart, ta.selectionEnd, recognizedText);
    setText(value);
    requestAnimationFrame(() => {
      ta.setSelectionRange(caret, caret);
      // Keep the caret in view as the script grows.
      if (document.activeElement !== ta) ta.focus();
    });
  }, []);

  const onDictation = useCallback((recognizedText: string, isPartial: boolean) => {
    setPartial(isPartial ? recognizedText : '');
    if (!isPartial) insertDictated(recognizedText);
  }, [insertDictated]);

  // Vosk only commits a phrase after a pause; stopping mid-sentence keeps what was heard.
  const stopDictation = useCallback(() => {
    insertDictated(dictationPartialRef.current);
    setPartial('');
    setDictating(false);
  }, [insertDictated]);

  const onRecognition = useCallback((recognizedText: string, isPartial: boolean) => {
    const anchor = Math.min(utteranceAnchorRef.current, spokenIndexRef.current);
    const result = recognizedText.trim()
      ? matchRecognition(recognizedText, tokensRef.current, anchor)
      : { newSpokenIndex: anchor, matched: 0, unmatched: 0 };
    const next = Math.max(spokenIndexRef.current, result.newSpokenIndex);
    if (next > spokenIndexRef.current) {
      spokenIndexRef.current = next;
      setSpokenIndex(next);
      lastMatchAtRef.current = Date.now();
      // Speaking drives the scroll: resume after a silence pause, or start on the first words.
      if (!playingRef.current && !doneRef.current) playRef.current();
    }
    if (!isPartial) {
      utteranceAnchorRef.current = next;
      const words = result.matched + result.unmatched;
      if (words > 0) {
        const st = matchStatsRef.current;
        st.matched += result.matched;
        st.total += words;
        setMatchRate(st.matched / st.total);
      }
    }
  }, []);

  const detectedLang = useMemo(() => detectLanguage(spokenText), [spokenText]);
  const sttLang = settings.sttLanguage === 'auto' ? detectedLang : settings.sttLanguage;

  // One recognizer serves both uses: following the script while reading, and dictating it
  // in the editor. They never overlap, since each is tied to its own mode.
  const dictationActive = dictating && mode === 'editor';
  const sttStatus: SttStatus = useSpeechRecognition({
    enabled: (listening && mode === 'display') || dictationActive,
    lang: dictationActive ? dictationLang : sttLang,
    onResult: dictationActive ? onDictation : onRecognition
  });
  const sttListening = sttStatus.kind === 'listening';

  // Adaptive speed: keep the line being spoken on the focus line. The spoken overlay lays
  // out the same text as the base layer, so the spoken span's last line box tells us
  // which line the voice is on. Speed is proportional to the error in lines:
  // voice 2 lines ahead → 2x, scroll 1 line ahead of the voice → hold still.
  useEffect(() => {
    if (!sttListening || mode !== 'display' || spokenIndex === 0) {
      if (adaptiveSpeed !== baseSpeed) setAdaptiveSpeed(baseSpeed);
      return;
    }
    const scroller = teleprompter.scrollerRef.current;
    const spokenP = teleprompter.spokenRef.current?.firstElementChild as HTMLElement | null;
    const spokenEls = spokenP?.querySelectorAll('[data-spoken]');
    const rects = spokenEls?.[spokenEls.length - 1]?.getClientRects();
    if (!scroller || !spokenP || !rects?.length) return;
    const cs = getComputedStyle(spokenP);
    const lineH = parseFloat(cs.lineHeight) || 1;
    const lastTop = rects[rects.length - 1].top - spokenP.getBoundingClientRect().top - parseFloat(cs.paddingTop);
    const spokenLine = Math.max(0, Math.round(lastTop / lineH));
    // At scrollTop 0 the first line sits one line above the focus line.
    const target = (spokenLine - 1) * lineH;
    const errLines = (target - scroller.scrollTop) / lineH;
    const factor = Math.max(0, Math.min(2, 1 + errLines));
    const next = baseSpeed * factor;
    if (Math.abs(next - adaptiveSpeed) > 0.5) setAdaptiveSpeed(next);
  }, [sttListening, mode, teleprompter.progress, spokenIndex, baseSpeed, adaptiveSpeed]);

  // Auto-pause after >3s without a match. The clock starts once the mic is live,
  // not while the model is still loading.
  useEffect(() => {
    if (!sttListening) return;
    lastMatchAtRef.current = Date.now();
    utteranceAnchorRef.current = spokenIndexRef.current;
    const t = setInterval(() => {
      if (playingRef.current && Date.now() - lastMatchAtRef.current > 3000) pauseRef.current();
    }, 250);
    return () => clearInterval(t);
  }, [sttListening]);

  // New script → start alignment from the top.
  useEffect(() => {
    utteranceAnchorRef.current = 0;
    matchStatsRef.current = { matched: 0, total: 0 };
    setMatchRate(null);
  }, [text]);

  // Update base speed when settings.speed changes
  useEffect(() => {
    setAdaptiveSpeed(settings.speed);
  }, [settings.speed]);

  const toggleDictate = useCallback(() => {
    if (mode !== 'editor') return;
    if (dictating) return stopDictation();
    setPartial('');
    setDictationLang(sttLang);
    setDictating(true);
  }, [mode, dictating, sttLang, stopDictation]);

  const toggleListen = useCallback(() => {
    if (mode !== 'display') return;
    setListening((v) => !v);
  }, [mode]);

  const spokenEnd = spokenIndex > 0 ? tokens[Math.min(spokenIndex, tokens.length) - 1].end : 0;

  const hotkeyMap = useMemo<HotkeyMap>(
    () => ({
      space: () => {
        if (mode === 'display') teleprompter.toggle();
        else if (mode === 'editor') enterDisplay();
      },
      up: () => update({ speed: Math.min(400, settings.speed + 5) }),
      down: () => update({ speed: Math.max(10, settings.speed - 5) }),
      left: () => {
        if (mode === 'display') {
          if (teleprompter.scrollerRef.current) {
            teleprompter.scrollerRef.current.scrollTop = Math.max(
              0,
              teleprompter.scrollerRef.current.scrollTop - 60
            );
          }
        }
      },
      right: () => {
        if (mode === 'display') {
          if (teleprompter.scrollerRef.current) {
            const el = teleprompter.scrollerRef.current;
            const max = el.scrollHeight - el.clientHeight;
            el.scrollTop = Math.min(max, el.scrollTop + 60);
          }
        }
      },
      r: () => {
        if (mode === 'display') teleprompter.reset();
      },
      escape: () => {
        if (showControls) setShowControls(false);
        else if (dictating) stopDictation();
        else if (mode === 'display') exitToEditor();
        else if (mode === 'countdown') setMode('editor');
        else setShowControls(false);
      },
      h: () => setShowControls((v) => !v),
      // Start from the editor while the textarea has focus (Space types a space there).
      'ctrl+enter': () => {
        if (mode === 'editor') enterDisplay();
      },
      'cmd+enter': () => {
        if (mode === 'editor') enterDisplay();
      },
      l: () => {
        if (mode === 'display') toggleListen();
      },
      'ctrl+d': () => toggleDictate(),
      'cmd+d': () => toggleDictate(),
      'ctrl+n': () => handleNewFile(),
      'cmd+n': () => handleNewFile(),
      'ctrl+o': () => handleOpenFile(),
      'cmd+o': () => handleOpenFile(),
      'ctrl+s': () => handleSaveFile(),
      'cmd+s': () => handleSaveFile(),
      'ctrl+shift+s': () => handleSaveFile(true),
      'cmd+shift+s': () => handleSaveFile(true)
    }),
    [mode, teleprompter, enterDisplay, exitToEditor, settings.speed, update, showControls, dictating, stopDictation, toggleListen, toggleDictate, handleNewFile, handleOpenFile, handleSaveFile]
  );

  useHotkeys(hotkeyMap, true);

  useEffect(() => {
    // Every UI color derives from these channels (tailwind.config.js, index.css).
    const root = document.documentElement.style;
    root.setProperty('--paper', hexToChannels(settings.textColor));
    root.setProperty('--ink', hexToChannels(settings.bgColor));
    root.setProperty('--accent', hexToChannels(settings.highlightColor));
    root.setProperty('--spoken', hexToChannels(getTheme(settings.theme).spokenColor));
    const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
    api?.setOpacity(settings.opacity).catch(() => {});
  }, [settings.textColor, settings.bgColor, settings.highlightColor, settings.theme, settings.opacity]);

  const hexToRgba = (hex: string, alpha: number): string => {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgRgba = hexToRgba(settings.bgColor, settings.bgOpacity / 100);

  useEffect(() => {
    (window as any).__app = {
      setMode: (m: Mode) => setMode(m),
      play: () => teleprompter.play(),
      reset: () => teleprompter.reset(),
      pause: () => teleprompter.pause(),
      setText: (t: string) => setText(t),
      update: (p: Partial<AppSettings>, opts?: { transient?: boolean }) => update(p, opts),
      setSpokenIndex: (n: number) => setSpokenIndex(n),
      setListening: (v: boolean) => setListening(v),
      setDictating: (v: boolean) => setDictating(v),
      // Feed recognizer output directly (bypasses mic + Vosk) for matcher/scroll probes.
      recognize: (t: string, partial = false) => onRecognition(t, partial),
      state: {
        mode,
        settings,
        text,
        listening,
        dictating,
        dictationPartial,
        filePath,
        markdown: markdown != null,
        dirty,
        stt: sttStatus,
        sttLang,
        spokenIndex,
        tokens: tokens.length,
        adaptiveSpeed,
        playing: teleprompter.playing,
        progress: teleprompter.progress,
        matchRate
      }
    };
  }, [mode, settings, text, teleprompter, update, listening, dictating, dictationPartial, filePath, dirty, sttStatus, sttLang, spokenIndex, tokens.length, adaptiveSpeed, matchRate, onRecognition]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: bgRgba }}
    >
      <Titlebar
        text={text}
        fileName={filePath ? filePath.split(/[\\/]/).pop()! : null}
        dirty={dirty}
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onSaveFile={() => handleSaveFile()}
        onPlay={enterDisplay}
        onSettings={() => setShowControls((v) => !v)}
        onClose={() => {
          const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
          api?.closeWindow();
        }}
        onListen={toggleListen}
        listening={listening}
        dictating={dictationActive}
        sttStatus={sttStatus}
        revealed={chromeRevealed}
        mode={mode}
      />

      {mode === 'editor' && (
        <Editor
          textareaRef={editorRef}
          text={text}
          onChange={setText}
          settings={settings}
          onPlay={enterDisplay}
          onOpenFile={handleOpenFile}
          dictating={dictating}
          dictationPartial={dictationPartial}
          sttStatus={dictating ? sttStatus : null}
          onToggleDictate={toggleDictate}
        />
      )}

      {mode === 'countdown' && (
        <Countdown
          count={settings.countdown}
          onDone={() => {
            setMode('display');
            teleprompter.reset();
          }}
          onCancel={() => setMode('editor')}
        />
      )}

      {mode === 'display' && (
        <Teleprompter
          text={text}
          markdown={markdown}
          scrollerRef={teleprompter.scrollerRef}
          highlightRef={teleprompter.highlightRef}
          spokenRef={teleprompter.spokenRef}
          spokenEnd={spokenEnd}
          playing={teleprompter.playing}
          done={teleprompter.done}
          progress={teleprompter.progress}
          onToggle={teleprompter.toggle}
          sttStatus={listening ? sttStatus : null}
          matchRate={matchRate}
          currentSpeed={adaptiveSpeed}
          chromeVisible={chromeRevealed}
          onOpenSettings={() => setShowControls(true)}
          onOpenEditor={exitToEditor}
          settings={settings}
        />
      )}

      <ControlsPanel
        settings={settings}
        detectedLang={detectedLang}
        update={(p) => update(p)}
        open={showControls}
        onClose={() => setShowControls(false)}
        onOpenFile={handleOpenFile}
        onSaveFile={() => handleSaveFile()}
        onReset={() => {
          update(DEFAULT_SETTINGS);
          const api = typeof window !== 'undefined' ? window.teleprompter : undefined;
          api?.setIgnoreMouse(false);
        }}
      />
    </div>
  );
}
