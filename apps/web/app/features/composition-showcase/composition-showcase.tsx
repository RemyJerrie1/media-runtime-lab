'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { MEDIA_CAPABILITIES, MEDIA_RUNTIME } from '../../config/media';
import { SectionHeading } from '../../shared/ui/section-heading';
import { activeSpriteFrame, activeSubtitle, loopProgress } from './composition-model';
import styles from './composition-showcase.module.css';

export function CompositionShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);

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
        frameRef.current.textContent = `SPRITE ${String(spriteFrame + 1).padStart(2, '0')}/08`;
        previousFrame = spriteFrame;
      }

      const width = 960; const height = 540;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0c2838'); gradient.addColorStop(.5, '#171b38'); gradient.addColorStop(1, '#45213d');
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);

      context.globalAlpha = .32;
      for (let index = 0; index < 18; index += 1) {
        const phase = progress * Math.PI * 2 + index * .72;
        const x = ((index * 79 + progress * 250) % 1080) - 60;
        const y = 90 + Math.sin(phase) * 54 + (index % 4) * 72;
        context.fillStyle = index % 2 ? '#5bd7e8' : '#b993e8';
        context.beginPath(); context.arc(x, y, 7 + index % 5, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = 1;

      const actorX = 100 + progress * 650;
      const bounce = Math.sin(spriteFrame / 8 * Math.PI * 2) * 10;
      context.save(); context.translate(actorX, 315 + bounce);
      context.fillStyle = '#f1ae79'; context.beginPath(); context.roundRect(-34, -45, 68, 68, 20); context.fill();
      context.fillStyle = '#111827'; context.beginPath(); context.arc(-12, -19, 5, 0, Math.PI * 2); context.arc(12, -19, 5, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#f1ae79'; context.lineWidth = 9; context.lineCap = 'round';
      const stride = spriteFrame % 2 === 0 ? 18 : -18;
      context.beginPath(); context.moveTo(-15, 21); context.lineTo(-22 + stride, 58); context.moveTo(15, 21); context.lineTo(22 - stride, 58); context.stroke();
      context.restore();

      context.fillStyle = '#f3eee8'; context.font = '700 20px ui-monospace, monospace'; context.fillText('CANVAS 2D COMPOSITION', 48, 58);
      context.fillStyle = '#9eacba'; context.font = '14px ui-monospace, monospace'; context.fillText('deterministic frame clock · CJK cue track · sprite playback', 48, 84);
      if (!reducedMotion) animationFrame = requestAnimationFrame(render);
    };
    render(0);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return <section id="composition" className={styles.section}>
    <SectionHeading
      eyebrow="MEDIA COMPOSITION PROOF"
      title="字幕、Sprite 與 2D／3D Layer 共用一條媒體時間軸"
      description="AI 負責生成候選內容；確定性的前端預覽與後端算圖管線，負責可重播、可驗證的交付結果。"
    />
    <div className={styles.grid}>
      <div className={styles.copy}>
        <ul>{MEDIA_CAPABILITIES.map((capability) => <li key={capability}>{capability}</li>)}</ul>
      </div>
      <div ref={stageRef} className={styles.stage} style={{ '--progress': 0 } as CSSProperties}>
        <canvas ref={canvasRef} className={styles.canvas} width="960" height="540" aria-label="字幕、精靈圖與二三維媒體合成預覽" />
        <div className={styles.orb} aria-hidden="true">
          <span className={`${styles.face} ${styles.front}`}>3D</span><span className={`${styles.face} ${styles.back}`}>LAYER</span>
          <span className={`${styles.face} ${styles.left}`}>CSS</span><span className={`${styles.face} ${styles.right}`}>WEBGL</span>
          <span className={`${styles.face} ${styles.top}`}>Z+</span><span className={`${styles.face} ${styles.bottom}`}>Z−</span>
        </div>
        <p ref={subtitleRef} className={styles.subtitle} aria-live="polite">讓 AI 產生靈感，讓工程確保交付。</p>
        <div className={styles.sprite}><span ref={frameRef}>SPRITE 01/08</span><span className={styles.track}><i /></span><span className={styles.badge}>30 FPS</span></div>
      </div>
    </div>
  </section>;
}
