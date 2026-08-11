'use client';

import { useEffect, useRef, useState } from 'react';
import type { RenderJob } from '@media-lab/contracts';
import { playheadX, waveformY } from './media-animation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function RenderLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;

    const draw = (elapsedMs: number) => {
      const phase = reducedMotion ? 0 : elapsedMs / 520;
      const gradient = ctx.createLinearGradient(0, 0, 600, 320);
      gradient.addColorStop(0, '#102c3b');
      gradient.addColorStop(.55, '#281e39');
      gradient.addColorStop(1, '#523046');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 320);
      ctx.fillStyle = '#f3e9df';
      ctx.font = '600 26px system-ui';
      ctx.fillText('AI × Deterministic Media', 38, 75);
      ctx.font = '16px system-ui';
      ctx.fillStyle = '#a9bac6';
      ctx.fillText('Canvas scene · subtitle-safe composition', 38, 106);

      ctx.strokeStyle = '#f1ae79';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 38; x < 550; x += 6) {
        const y = waveformY(x, phase);
        if (x === 38) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const playhead = reducedMotion ? 294 : playheadX(elapsedMs);
      const glow = ctx.createLinearGradient(playhead - 24, 0, playhead + 24, 0);
      glow.addColorStop(0, 'rgba(91,215,232,0)');
      glow.addColorStop(.5, 'rgba(91,215,232,.28)');
      glow.addColorStop(1, 'rgba(91,215,232,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(playhead - 24, 132, 48, 130);
      ctx.strokeStyle = '#5bd7e8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playhead, 132);
      ctx.lineTo(playhead, 262);
      ctx.stroke();

      if (!reducedMotion) animationFrame = requestAnimationFrame(draw);
    };

    draw(0);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  async function create() {
    setBusy(true);
    const response = await fetch(`${API}/v1/render-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'portfolio-reel',
        template: 'landscape',
        durationSeconds: 18,
        narration: 'A deterministic media runtime governed by explicit contracts.',
        idempotencyKey: `portfolio-${Date.now()}`,
      }),
    });
    const created = await response.json() as RenderJob;
    setJob(created);
    setBusy(false);
    const events = new EventSource(`${API}/v1/render-jobs/${created.id}/events`);
    events.addEventListener('render.progress', (event) => {
      const next = JSON.parse((event as MessageEvent).data) as RenderJob;
      setJob(next);
      if (next.status === 'ready' || next.status === 'failed') events.close();
    });
  }

  return <section className="lab">
    <div className="lab-copy">
      <p className="eyebrow">EXECUTABLE PROOF</p>
      <h2>One job identity. End-to-end evidence.</h2>
      <ul>
        <li>Create a governed render command</li>
        <li>Stream authoritative progress over SSE</li>
        <li>Register artifact, token, and cost evidence</li>
      </ul>
      <button disabled={busy} onClick={create}>{busy ? 'CREATING…' : 'RUN RENDER JOB'}</button>
    </div>
    <div className="console">
      <canvas ref={canvas} width="600" height="320" aria-label="Deterministic media composition preview"/>
      <div className="job">
        <div><span>JOB STATUS</span><strong>{job?.status.toUpperCase() ?? 'NOT STARTED'}</strong></div>
        <div><span>STAGE</span><strong>{job?.stage ?? 'Awaiting command'}</strong></div>
        <div><span>COST / TOKEN</span><strong>{job ? `$${job.estimatedCostUsd} / ${job.tokens}` : '—'}</strong></div>
      </div>
      <div className="meter"><i style={{ width: `${job?.progress ?? 0}%` }}/></div>
    </div>
  </section>;
}
