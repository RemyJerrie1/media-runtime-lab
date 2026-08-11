'use client';

import { useEffect, useRef } from 'react';
import { frameNumber, playheadX, timelineSecond } from './media-animation';

const clips = [
  { start: 0, end: 5.4, label: 'INTRO', color: '#5bd7e8' },
  { start: 5.4, end: 12.2, label: 'EVIDENCE', color: '#b993e8' },
  { start: 12.2, end: 18, label: 'DELIVERY', color: '#79d29d' },
];
const cues = [
  { start: 1.1, end: 4.6, label: 'CJK 01' },
  { start: 6.2, end: 10.4, label: 'CJK 02' },
  { start: 12.8, end: 16.9, label: 'CJK 03' },
];
const envelope = [8,14,22,11,28,18,9,25,31,15,7,20,27,13,24,34,17,10,23,29,12,19,32,16,8,26,21,11,30,18,9,24,28,14,20,10,27,16,7,22,31,15,11,25,19,8,29,17];

export function MediaTimeline() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    const draw = (elapsedMs: number) => {
      const gradient = ctx.createLinearGradient(0, 0, 600, 320);
      gradient.addColorStop(0, '#102c3b'); gradient.addColorStop(.55, '#281e39'); gradient.addColorStop(1, '#523046');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 600, 320);
      ctx.fillStyle = '#f3e9df'; ctx.font = '600 26px system-ui'; ctx.fillText('Deterministic Composition Timeline', 38, 48);
      const currentSecond = reducedMotion ? 9 : timelineSecond(elapsedMs);
      const currentFrame = reducedMotion ? 270 : frameNumber(elapsedMs);
      ctx.font = '13px ui-monospace, monospace'; ctx.fillStyle = '#a9bac6';
      ctx.fillText(`18.0s · 30fps · FRAME ${String(currentFrame).padStart(3, '0')} · ${currentSecond.toFixed(1)}s`, 38, 75);
      const left = 76; const width = 474;
      ctx.strokeStyle = 'rgba(169,186,198,.34)'; ctx.lineWidth = 1; ctx.font = '10px ui-monospace, monospace';
      for (let second = 0; second <= 18; second += 3) {
        const x = left + (second / 18) * width;
        ctx.beginPath(); ctx.moveTo(x, 94); ctx.lineTo(x, 288); ctx.stroke();
        ctx.fillStyle = '#a9bac6'; ctx.fillText(`${second}s`, x - 8, 88);
      }
      ctx.fillStyle = '#9eacba'; ctx.fillText('SCENE', 20, 126); ctx.fillText('SUB', 31, 181); ctx.fillText('AUDIO', 18, 236);
      for (const clip of clips) {
        const x = left + (clip.start / 18) * width; const clipWidth = ((clip.end - clip.start) / 18) * width - 3;
        ctx.fillStyle = `${clip.color}33`; ctx.strokeStyle = clip.color; ctx.beginPath(); ctx.roundRect(x, 105, clipWidth, 32, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f3eee8'; ctx.fillText(clip.label, x + 8, 125);
      }
      for (const cue of cues) {
        const x = left + (cue.start / 18) * width; const cueWidth = ((cue.end - cue.start) / 18) * width;
        ctx.fillStyle = 'rgba(241,174,121,.18)'; ctx.strokeStyle = '#f1ae79'; ctx.fillRect(x, 158, cueWidth, 28); ctx.strokeRect(x, 158, cueWidth, 28);
        ctx.fillStyle = '#f3eee8'; ctx.fillText(cue.label, x + 7, 177);
      }
      ctx.fillStyle = 'rgba(91,215,232,.72)';
      envelope.forEach((level, index) => ctx.fillRect(left + (index / envelope.length) * width, 222 - level / 2, 5, level));
      const playhead = reducedMotion ? 294 : playheadX(elapsedMs);
      const glow = ctx.createLinearGradient(playhead - 24, 0, playhead + 24, 0);
      glow.addColorStop(0, 'rgba(91,215,232,0)'); glow.addColorStop(.5, 'rgba(91,215,232,.28)'); glow.addColorStop(1, 'rgba(91,215,232,0)');
      ctx.fillStyle = glow; ctx.fillRect(playhead - 24, 94, 48, 194); ctx.strokeStyle = '#5bd7e8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(playhead, 94); ctx.lineTo(playhead, 288); ctx.stroke();
      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    };
    draw(0);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return <canvas ref={canvas} width="600" height="320" aria-label="Deterministic media composition timeline" />;
}
