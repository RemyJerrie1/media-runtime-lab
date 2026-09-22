'use client';

import { useEffect, useRef, useState } from 'react';
import type { HamsterScene } from '@media-lab/contracts';
import type { createHamsterStage } from './stage-renderer';
import styles from './hamster-editor.module.css';
import { CAPTION_FRAME, drawCaption, loadCaptionFont } from './caption-renderer';
import { evaluateScene } from './evaluate-scene';

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
  const captionRef = useRef<HTMLCanvasElement>(null);
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
    let releaseFont: (() => void) | undefined;
    setFailed(false);
    setStatus('正在準備小舞台…');
    const fail = () => {
      if (cancelled) return;
      canvas.dataset.ready = 'false';
      if (captionRef.current) captionRef.current.dataset.ready = 'false';
      setFailed(true);
      unavailable.current();
      setStatus(
        '3D 預覽暫時無法顯示或字幕字型載入失敗。場景設定仍保留，請重試或使用支援 WebGL 的瀏覽器。',
      );
    };
    const lost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    canvas.addEventListener('webglcontextlost', lost);
    void Promise.all([
      import('./stage-renderer'),
      loadCaptionFont().then((release) => {
        if (cancelled) release();
        else releaseFont = release;
      }),
    ])
      .then(([{ createHamsterStage }]) => {
        if (cancelled) return;
        const stage = createHamsterStage(canvas);
        stageRef.current = stage;
        const redraw = () => {
          try {
            stage.render(currentScene.current, currentTime.current);
            const caption = evaluateScene(currentScene.current, currentTime.current).caption;
            drawCaption(captionRef.current!, caption);
            captionRef.current!.dataset.visible = String(caption !== null);
            captionRef.current!.dataset.ready = 'true';
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
      releaseFont?.();
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
      <div className={styles.frame} aria-label="完整場景畫面">
        <canvas key={attempt} ref={canvasRef} aria-label="3D 倉鼠場景" />
        <canvas
          className={styles.captionCanvas}
          ref={captionRef}
          width={CAPTION_FRAME.width}
          height={CAPTION_FRAME.height}
          aria-label="字幕畫面"
        />
        <span className={styles.captionText}>{evaluateScene(scene, time).caption?.text ?? ''}</span>
      </div>
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
