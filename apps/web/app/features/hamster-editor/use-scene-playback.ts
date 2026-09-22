'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clampTime, playbackTime } from './evaluate-scene';

export function useScenePlayback() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState('');
  const current = useRef(0);
  const anchor = useRef<{ time: number; clock: number } | null>(null);
  const frame = useRef<number | null>(null);
  const stopFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const pause = useCallback(() => {
    stopFrame();
    if (anchor.current) {
      current.current = playbackTime(anchor.current.time, anchor.current.clock, performance.now());
      setTime(current.current);
    }
    anchor.current = null;
    setPlaying(false);
  }, [stopFrame]);
  const seek = useCallback(
    (value: number) => {
      stopFrame();
      anchor.current = null;
      current.current = clampTime(value);
      setTime(current.current);
      setPlaying(false);
      setNotice('');
    },
    [stopFrame],
  );
  const play = useCallback(() => {
    if (anchor.current || document.hidden) return;
    if (current.current >= 5) {
      current.current = 0;
      setTime(0);
    }
    anchor.current = { time: current.current, clock: performance.now() };
    setNotice('');
    setPlaying(true);
    const tick = (now: number) => {
      if (!anchor.current) return;
      const next = playbackTime(anchor.current.time, anchor.current.clock, now);
      current.current = next;
      setTime(next);
      if (next >= 5) {
        anchor.current = null;
        frame.current = null;
        setPlaying(false);
      } else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && anchor.current) {
        pause();
        setNotice('切換分頁時已暫停，按播放即可繼續。');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      stopFrame();
      anchor.current = null;
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [pause, stopFrame]);
  return { time, playing, notice, play, pause, seek };
}
