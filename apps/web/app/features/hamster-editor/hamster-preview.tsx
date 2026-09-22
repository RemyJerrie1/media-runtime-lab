'use client';

import { useEffect, useRef, useState } from 'react';
import type { HamsterScene } from '@media-lab/contracts';
import type { createHamsterStage } from './stage-renderer';
import styles from './hamster-editor.module.css';

export function HamsterPreview({
  scene,
  time,
  onUnavailable,
}: {
  scene: HamsterScene;
  time: number;
  onUnavailable: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<ReturnType<typeof createHamsterStage> | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const currentScene = useRef(scene);
  currentScene.current = scene;
  const currentTime = useRef(time);
  currentTime.current = time;
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('正在準備小舞台…');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current!;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    setFailed(false);
    setStatus('正在準備小舞台…');
    const fail = () => {
      if (cancelled) return;
      canvas.dataset.ready = 'false';
      setFailed(true);
      unavailable.current();
      setStatus('3D 預覽暫時無法顯示。場景設定仍保留，請重試或使用支援 WebGL 的瀏覽器。');
    };
    const lost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    canvas.addEventListener('webglcontextlost', lost);
    void import('./stage-renderer')
      .then(({ createHamsterStage }) => {
        if (cancelled) return;
        const stage = createHamsterStage(canvas);
        stageRef.current = stage;
        const redraw = () => {
          try {
            stage.render(currentScene.current, currentTime.current);
            if (!canvas.getContext('webgl2')?.isContextLost()) {
              canvas.dataset.ready = 'true';
              setStatus('舞台已就緒');
            }
          } catch {
            fail();
          }
        };
        drawRef.current = redraw;
        redraw();
        observer = new ResizeObserver(redraw);
        observer.observe(canvas);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      observer?.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      stageRef.current?.dispose();
      stageRef.current = null;
      drawRef.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    drawRef.current?.();
  }, [scene, time]);
  return (
    <div className={styles.preview}>
      <canvas key={attempt} ref={canvasRef} aria-label="3D 倉鼠場景" />
      <div className={styles.previewStatus} role="status">
        {status}
      </div>
      {failed && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          重新載入預覽
        </button>
      )}
    </div>
  );
}
