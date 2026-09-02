import { Inject, Injectable } from '@nestjs/common';
import type { CreateRenderJob, RenderEvent, RenderJob, RenderStatus } from '@media-lab/contracts';
import { Observable } from 'rxjs';
import { WORKFLOW_STORE, type ArtifactReceipt, type WorkflowStore } from '../domain/workflow-store';
import { OperationsTelemetry } from './operations-telemetry';
import { FfmpegMediaProcessor } from '../infrastructure/ffmpeg-media-processor';

/**
 * The render state machine, as data rather than control flow.
 *
 * Each entry answers "given this status, what is the next one" — so the transition table is
 * reviewable in one screen and a new stage is one entry, not a new branch. `stage` renders
 * the operator-facing label from the job itself, which keeps the encoding parameters the user
 * chose visible in the progress stream instead of a generic "processing".
 *
 * The state machine remains provider-independent; FFmpeg execution lives behind an adapter.
 */
const STEPS: Record<
  Exclude<RenderStatus, 'ready' | 'failed'>,
  { status: RenderStatus; progress: number; stage: (job: RenderJob) => string; delay: number }
> = {
  accepted: {
    status: 'composing',
    progress: 26,
    stage: (job) =>
      `Trim ${job.trimStartSeconds}s → ${job.trimStartSeconds + job.durationSeconds}s + deterministic composition`,
    delay: 180,
  },
  composing: {
    status: 'encoding',
    progress: 58,
    stage: (job) =>
      `FFmpeg ${job.encoding.fps}fps · CRF ${job.encoding.crf} · GOP ${job.encoding.gop}`,
    delay: 240,
  },
  encoding: {
    status: 'packaging',
    progress: 84,
    stage: () => 'Artifact checksum + encoding receipt',
    delay: 220,
  },
  packaging: { status: 'ready', progress: 100, stage: () => 'Delivery-ready artifact', delay: 180 },
};

@Injectable()
export class RenderOrchestrator {
  constructor(
    @Inject(WORKFLOW_STORE) private readonly store: WorkflowStore,
    @Inject(OperationsTelemetry) private readonly telemetry: OperationsTelemetry,
    @Inject(FfmpegMediaProcessor) private readonly processor: FfmpegMediaProcessor,
  ) {}
  async create(tenantId: string, command: CreateRenderJob, traceId: string, quotaTokens: number) {
    const result = await this.store.create({ tenantId, command, traceId, quotaTokens });
    this.telemetry.command(result.job, result.created);
    return result.job;
  }
  get(tenantId: string, id: string) {
    return this.store.findById(tenantId, id);
  }
  async processNext(workerId: string, withDelay = true) {
    const work = await this.store.claimNext(workerId, 5000);
    if (!work) return false;
    try {
      let current = await this.store.findById(work.tenantId, work.jobId);
      let artifact: ArtifactReceipt | undefined;
      if (!current || current.status === 'ready' || current.status === 'failed') return false;
      while (current.status !== 'ready' && current.status !== 'failed') {
        const step = STEPS[current.status];
        if (withDelay) await new Promise((resolve) => setTimeout(resolve, step.delay));
        if (current.status === 'encoding') artifact = await this.processor.render(current);
        if (current.status === 'packaging' && !artifact)
          artifact = await this.processor.render(current);
        const next = await this.store.advance(
          work,
          step.status,
          step.progress,
          step.stage(current),
          step.status === 'ready' ? artifact : undefined,
        );
        if (!next) throw new Error('WORK_LEASE_LOST');
        this.telemetry.transition(next);
        current = next;
      }
      return true;
    } catch (error) {
      await this.store.release(work, error instanceof Error ? error.message : 'worker failure');
      return false;
    }
  }
  events(tenantId: string, id: string, afterSequence = 0): Observable<RenderEvent> {
    return new Observable((subscriber) => {
      let cursor = afterSequence;
      let cancelled = false;
      let timer: NodeJS.Timeout | undefined;
      const poll = async () => {
        if (cancelled) return;
        try {
          const events = await this.store.listEvents(tenantId, id, cursor);
          for (const event of events) {
            cursor = Math.max(cursor, event.sequence);
            subscriber.next(event);
            if (event.data.status === 'ready' || event.data.status === 'failed') {
              subscriber.complete();
              return;
            }
          }
          const current = await this.store.findById(tenantId, id);
          if (!current) {
            subscriber.error(new Error('JOB_NOT_FOUND'));
            return;
          }
          this.telemetry.replay(events.length, current);
          timer = setTimeout(poll, 250);
        } catch (error) {
          subscriber.error(error);
        }
      };
      void poll();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    });
  }
  async operations(tenantId: string) {
    return this.telemetry.snapshot(await this.store.activeCount(tenantId));
  }
}
