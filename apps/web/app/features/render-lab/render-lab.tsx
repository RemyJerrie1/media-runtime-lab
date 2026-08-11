'use client';

import { Button } from '../../design-system/button';
import { MetricCard } from '../../design-system/metric-card';
import { useRenderJob } from '../../shared/hooks/use-render-job';
import { MediaTimeline } from './media-timeline';

export function RenderLab() {
  const { job, busy, error, run } = useRenderJob();
  return <section className="lab">
    <div className="lab-copy">
      <p className="eyebrow">EXECUTABLE PROOF</p>
      <h2>One job identity. End-to-end evidence.</h2>
      <ul>
        <li>Create a governed render command</li>
        <li>Stream authoritative progress over SSE</li>
        <li>Register artifact, token, and cost evidence</li>
      </ul>
      <Button disabled={busy} onClick={run}>{busy ? 'CREATING…' : 'RUN RENDER JOB'}</Button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <div className="console">
      <MediaTimeline />
      <div className="job">
        <MetricCard label="JOB STATUS" value={job?.status.toUpperCase() ?? 'NOT STARTED'} />
        <MetricCard label="STAGE" value={job?.stage ?? 'Awaiting command'} />
        <MetricCard label="COST / TOKEN" value={job ? `$${job.estimatedCostUsd} / ${job.tokens}` : '—'} />
      </div>
      <div className="meter"><i style={{ width: `${job?.progress ?? 0}%` }} /></div>
    </div>
  </section>;
}
