'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MediaAsset, MediaProcessing } from '@media-lab/contracts';
import { MEDIA_RUNTIME } from '../../config/media';
import { SectionHeading } from '../../shared/ui/section-heading';
import { activeSpriteFrame, activeSubtitle, loopProgress } from './composition-model';
import styles from './composition-showcase.module.css';
import { useRenderJob } from '../../shared/hooks/use-render-job';
import { artifactUrl, getDemoMedia } from '../../shared/api/render-jobs';

export function CompositionShowcase() {
  const { job, busy, error, run } = useRenderJob();
  const [source, setSource] = useState<MediaAsset | null>(null);
  const [watermarkMode, setWatermarkMode] = useState<MediaProcessing['watermarkMode']>('visible');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    getDemoMedia()
      .then(setSource)
      .catch(() => setSource(null));
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let previousCue = '';
    let previousFrame = -1;

    const render = (elapsedMs: number) => {
      const clock = reducedMotion ? 5_400 : elapsedMs;
      const progress = loopProgress(clock);
      const spriteFrame = activeSpriteFrame(clock, MEDIA_RUNTIME.spriteFrameCount);
      const cue = activeSubtitle(clock);
      stageRef.current?.style.setProperty('--progress', String(progress));
      if (cue.text !== previousCue && subtitleRef.current) {
        subtitleRef.current.textContent = cue.text;
        previousCue = cue.text;
      }
      if (spriteFrame !== previousFrame && frameRef.current) {
        frameRef.current.textContent = `精靈圖 ${String(spriteFrame + 1).padStart(2, '0')}/08`;
        previousFrame = spriteFrame;
      }

      const width = 960;
      const height = 540;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0c2838');
      gradient.addColorStop(0.5, '#171b38');
      gradient.addColorStop(1, '#45213d');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.32;
      for (let index = 0; index < 18; index += 1) {
        const phase = progress * Math.PI * 2 + index * 0.72;
        const x = ((index * 79 + progress * 250) % 1080) - 60;
        const y = 90 + Math.sin(phase) * 54 + (index % 4) * 72;
        context.fillStyle = index % 2 ? '#5bd7e8' : '#b993e8';
        context.beginPath();
        context.arc(x, y, 7 + (index % 5), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      const actorX = 100 + progress * 650;
      const bounce = Math.sin((spriteFrame / 8) * Math.PI * 2) * 10;
      context.save();
      context.translate(actorX, 315 + bounce);
      context.fillStyle = '#f1ae79';
      context.beginPath();
      context.roundRect(-34, -45, 68, 68, 20);
      context.fill();
      context.fillStyle = '#111827';
      context.beginPath();
      context.arc(-12, -19, 5, 0, Math.PI * 2);
      context.arc(12, -19, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#f1ae79';
      context.lineWidth = 9;
      context.lineCap = 'round';
      const stride = spriteFrame % 2 === 0 ? 18 : -18;
      context.beginPath();
      context.moveTo(-15, 21);
      context.lineTo(-22 + stride, 58);
      context.moveTo(15, 21);
      context.lineTo(22 - stride, 58);
      context.stroke();
      context.restore();

      context.fillStyle = '#f3eee8';
      context.font = '700 20px ui-monospace, monospace';
      context.fillText('Canvas 二維媒體合成', 48, 58);
      context.fillStyle = '#9eacba';
      context.font = '16px ui-monospace, monospace';
      context.fillText('確定性影格時鐘 · 中文提示軌 · 精靈圖播放', 48, 84);
      if (!reducedMotion) animationFrame = requestAnimationFrame(render);
    };
    render(0);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <section id="composition" className={styles.section}>
      <SectionHeading
        eyebrow="媒體合成"
        title="字幕、Sprite 與 2D／3D Layer 共用一條媒體時間軸"
        description="AI 負責生成候選內容；確定性的前端預覽與後端算圖管線，負責可重播、可驗證的交付結果。"
      />
      <div className={styles.grid}>
        <div className={styles.copy} data-tour="composition-content">
          <h3>產生可驗證的合成影片</h3>
          <p>右側是即時草稿；送出後由本機 FFmpeg 將浮水印燒入影片。</p>
          <label className={styles.control} data-tour="composition-options">
            浮水印模式
            <select
              value={watermarkMode}
              onChange={(event) =>
                setWatermarkMode(event.target.value as MediaProcessing['watermarkMode'])
              }
            >
              <option value="none">不加浮水印</option>
              <option value="visible">固定浮水印</option>
              <option value="dynamic">動態時間浮水印</option>
            </select>
          </label>
          <button
            type="button"
            data-tour="composition-submit"
            disabled={!source || busy}
            onClick={() =>
              source &&
              run({
                sourceAssetId: source.id,
                template: 'landscape',
                trimStartSeconds: 0,
                durationSeconds: 3,
                encoding: {
                  codec: 'libx264',
                  preset: 'fast',
                  rateControl: 'crf',
                  crf: 23,
                  bitrateKbps: 4000,
                  gop: 60,
                  fps: 30,
                },
                processing: {
                  frameRateMode: 'cfr',
                  audioSampleRate: 48000,
                  audioSync: 'async-resample',
                  subtitleMode: 'none',
                  watermarkMode,
                  adInsertion: 'none',
                  fastStart: true,
                },
              })
            }
          >
            {busy ? '正在送出…' : '產生後端合成影片'}
          </button>
          {error ? <p role="alert">{error}</p> : null}
          {job ? (
            <p aria-live="polite">
              後端狀態：{job.status}（{job.progress}%）
            </p>
          ) : null}
        </div>
        <div ref={stageRef} className={styles.stage} style={{ '--progress': 0 } as CSSProperties}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            width="960"
            height="540"
            aria-label="字幕、精靈圖與二三維媒體合成預覽"
          />
          <div className={styles.orb} aria-hidden="true">
            <span className={`${styles.face} ${styles.front}`}>3D</span>
            <span className={`${styles.face} ${styles.back}`}>LAYER</span>
            <span className={`${styles.face} ${styles.left}`}>CSS</span>
            <span className={`${styles.face} ${styles.right}`}>WEBGL</span>
            <span className={`${styles.face} ${styles.top}`}>Z+</span>
            <span className={`${styles.face} ${styles.bottom}`}>Z−</span>
          </div>
          <p ref={subtitleRef} className={styles.subtitle} aria-live="polite">
            讓人工智慧產生靈感，讓工程確保交付。
          </p>
          <div className={styles.sprite}>
            <span ref={frameRef}>精靈圖 01/08</span>
            <span className={styles.track}>
              <i />
            </span>
            <span className={styles.badge}>每秒 30 影格</span>
          </div>
        </div>
      </div>
      {job?.status === 'ready' && job.artifactUrl ? (
        <div className={styles.artifact} data-tour="composition-result">
          <div>
            <strong>FFmpeg 實際成品</strong>
            <span>已完成、可播放、可下載</span>
          </div>
          <video controls autoPlay muted loop playsInline src={artifactUrl(job.artifactUrl)} />
        </div>
      ) : null}
    </section>
  );
}
