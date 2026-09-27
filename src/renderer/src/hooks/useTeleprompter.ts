import { useCallback, useEffect, useRef, useState } from 'react';

export type Mode = 'editor' | 'countdown' | 'display';

export function useTeleprompter(speed: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const spokenRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const positionRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = el.scrollTop;
    }
    if (spokenRef.current) {
      spokenRef.current.scrollTop = el.scrollTop;
    }
    // Manual scroll (hotkeys, wheel): adopt the new position so play() resumes
    // from here. The rAF loop writes fractional positions that the browser
    // rounds, so ignore sub-pixel differences to avoid stalling slow speeds.
    if (Math.abs(el.scrollTop - positionRef.current) > 1) {
      positionRef.current = el.scrollTop;
    }
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? el.scrollTop / max : 0;
    setProgress(p);
    if (p < 1) setDone(false);
  }, []);

  const loop = useCallback((now: number) => {
    if (!playingRef.current) return;
    const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;
    const el = scrollerRef.current;
    if (!el) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const next = Math.min(max, positionRef.current + speedRef.current * dt);
    positionRef.current = next;
    el.scrollTop = next;
    if (highlightRef.current) highlightRef.current.scrollTop = next;
    if (spokenRef.current) spokenRef.current.scrollTop = next;
    const p = next / max;
    setProgress(p);
    if (next >= max) {
      setDone(true);
      setPlaying(false);
      playingRef.current = false;
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const play = useCallback(() => {
    if (playingRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (positionRef.current >= max && max > 0) {
      positionRef.current = 0;
      el.scrollTop = 0;
      if (highlightRef.current) highlightRef.current.scrollTop = 0;
      if (spokenRef.current) spokenRef.current.scrollTop = 0;
      setProgress(0);
      setDone(false);
    }
    playingRef.current = true;
    setPlaying(true);
    setDone(false);
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    playingRef.current ? pause() : play();
  }, [pause, play]);

  const reset = useCallback(() => {
    pause();
    positionRef.current = 0;
    const el = scrollerRef.current;
    if (el) {
      el.scrollTop = 0;
      if (highlightRef.current) highlightRef.current.scrollTop = 0;
      if (spokenRef.current) spokenRef.current.scrollTop = 0;
    }
    setProgress(0);
    setDone(false);
  }, [pause]);

  // The scroller only exists in display mode, which mounts after this hook, so
  // listen in the capture phase at the document (scroll doesn't bubble) rather
  // than binding to scrollerRef.current once.
  useEffect(() => {
    const onScroll = (e: Event) => {
      if (e.target === scrollerRef.current) handleScroll();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [handleScroll]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    scrollerRef,
    highlightRef,
    spokenRef,
    playing,
    progress,
    done,
    play,
    pause,
    toggle,
    reset
  } as const;
}
