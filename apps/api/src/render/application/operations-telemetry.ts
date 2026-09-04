import { Injectable, Logger } from '@nestjs/common';
import type { OperationsSnapshot, RenderJob } from '@media-lab/contracts';

@Injectable()
export class OperationsTelemetry {
  private readonly logger = new Logger('WorkflowTelemetry');
  private readonly startedAt = new Date().toISOString();
  private commands = 0;
  private duplicates = 0;
  private completed = 0;
  private failed = 0;
  private replayed = 0;
  private latestJob: RenderJob | null = null;
  command(job: RenderJob, created: boolean) {
    this.latestJob = job;
    this.commands += 1;
    if (!created) this.duplicates += 1;
    this.log('render.command', job, { created });
  }
  transition(job: RenderJob) {
    this.latestJob = job;
    if (job.status === 'ready') this.completed += 1;
    if (job.status === 'failed') this.failed += 1;
    this.log('render.transition', job);
  }
  replay(count: number, job: RenderJob) {
    this.latestJob = job;
    this.replayed += count;
    if (count) this.log('render.replay', job, { count });
  }
  snapshot(active: number): OperationsSnapshot {
    return {
      service: 'media-runtime-api',
      windowStartedAt: this.startedAt,
      commands: this.commands,
      duplicatesPrevented: this.duplicates,
      completed: this.completed,
      failed: this.failed,
      active,
      replayedEvents: this.replayed,
      latestEvidence: this.latestJob
        ? {
            traceId: this.latestJob.traceId,
            requestId: this.latestJob.requestId,
            jobId: this.latestJob.id,
            sequence: this.latestJob.sequence,
            status: this.latestJob.status,
            artifactChecksum: this.latestJob.artifactChecksum,
            manifestUrl: this.latestJob.manifestUrl,
            renditionCount: this.latestJob.renditions.length,
            estimatedCostUsd: this.latestJob.estimatedCostUsd,
            tokens: this.latestJob.tokens,
          }
        : null,
      targets: {
        renderSuccessRate: 0.999,
        recoverySeconds: 2,
        duplicateExecutionRate: 0,
        costAttributionCoverage: 1,
        traceCompleteness: 1,
      },
    };
  }
  private log(event: string, job: RenderJob, extra: Record<string, unknown> = {}) {
    this.logger.log(
      JSON.stringify({
        event,
        traceId: job.traceId,
        requestId: job.requestId,
        tenantId: job.tenantId,
        jobId: job.id,
        projectId: job.projectId,
        status: job.status,
        sequence: job.sequence,
        attempt: job.attempt,
        ...extra,
      }),
    );
  }
}
