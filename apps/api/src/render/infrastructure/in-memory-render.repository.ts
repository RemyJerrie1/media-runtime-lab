import { Injectable } from '@nestjs/common';
import type { RenderEvent, RenderJob, RenderStatus } from '@media-lab/contracts';
import { RenderJobAggregate } from '../domain/render-job';
import { createMediaProcessingPlan } from '../domain/media-processing-plan';
import type {
  ArtifactReceipt,
  ClaimedWork,
  CreateWorkflow,
  WorkflowStore,
} from '../domain/workflow-store';

type WorkRow = {
  id: string;
  jobId: string;
  tenantId: string;
  attempt: number;
  state: 'pending' | 'leased' | 'complete';
  leaseUntil: number;
  workerId: string | undefined;
};

@Injectable()
export class InMemoryWorkflowStore implements WorkflowStore {
  private readonly jobs = new Map<string, RenderJob>();
  private readonly keys = new Map<string, string>();
  private readonly events = new Map<string, RenderEvent[]>();
  private readonly work = new Map<string, WorkRow>();
  async initialize() {
    return;
  }
  private jobKey(tenantId: string, id: string) {
    return `${tenantId}:${id}`;
  }
  async create({ tenantId, traceId, requestId, command, quotaTokens }: CreateWorkflow) {
    const key = `${tenantId}:${command.idempotencyKey}`;
    const existingId = this.keys.get(key);
    if (existingId) {
      return {
        job: structuredClone(this.jobs.get(this.jobKey(tenantId, existingId))!),
        created: false,
      };
    }
    const used = [...this.jobs.values()]
      .filter((job) => job.tenantId === tenantId)
      .reduce((sum, job) => sum + job.tokens, 0);
    const tokens = Math.ceil(command.narration.length * 1.4);
    if (used + tokens > quotaTokens) throw new Error('TENANT_QUOTA_EXCEEDED');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const plan = createMediaProcessingPlan(command);
    const job: RenderJob = {
      id,
      tenantId,
      projectId: command.projectId,
      sourceAssetId: command.sourceAssetId,
      status: 'accepted',
      progress: 4,
      stage: 'Probe + processing contract accepted',
      sequence: 1,
      attempt: 0,
      traceId,
      requestId,
      estimatedCostUsd: Number((command.durationSeconds * 0.0018).toFixed(3)),
      tokens,
      template: command.template,
      trimStartSeconds: command.trimStartSeconds,
      durationSeconds: command.durationSeconds,
      encoding: command.encoding,
      processing: command.processing,
      ...plan,
      artifactUrl: null,
      artifactChecksum: null,
      manifestUrl: null,
      renditions: [],
      updatedAt: now,
    };
    this.jobs.set(this.jobKey(tenantId, id), structuredClone(job));
    this.keys.set(key, id);
    this.events.set(this.jobKey(tenantId, id), [
      {
        id: crypto.randomUUID(),
        jobId: id,
        tenantId,
        sequence: 1,
        type: 'render.progress',
        data: structuredClone(job),
        createdAt: now,
      },
    ]);
    const workId = crypto.randomUUID();
    this.work.set(workId, {
      id: workId,
      jobId: id,
      tenantId,
      attempt: 0,
      state: 'pending',
      leaseUntil: 0,
      workerId: undefined,
    });
    return { job: structuredClone(job), created: true };
  }
  async findById(tenantId: string, id: string) {
    const job = this.jobs.get(this.jobKey(tenantId, id));
    return job ? structuredClone(job) : undefined;
  }
  async listEvents(tenantId: string, id: string, afterSequence: number) {
    return structuredClone(
      (this.events.get(this.jobKey(tenantId, id)) ?? []).filter(
        (event) => event.sequence > afterSequence,
      ),
    );
  }
  async claimNext(workerId: string, leaseMs: number) {
    const now = Date.now();
    const row = [...this.work.values()].find(
      (item) => item.state === 'pending' || (item.state === 'leased' && item.leaseUntil < now),
    );
    if (!row) return;
    row.state = 'leased';
    row.workerId = workerId;
    row.leaseUntil = now + leaseMs;
    row.attempt += 1;
    const job = this.jobs.get(this.jobKey(row.tenantId, row.jobId));
    if (job) {
      job.attempt = row.attempt;
    }
    return { id: row.id, jobId: row.jobId, tenantId: row.tenantId, workerId, attempt: row.attempt };
  }
  async advance(
    work: ClaimedWork,
    status: RenderStatus,
    progress: number,
    stage: string,
    artifact?: ArtifactReceipt,
  ) {
    const key = this.jobKey(work.tenantId, work.jobId);
    const current = this.jobs.get(key);
    const row = this.work.get(work.id);
    if (!current || !row || row.workerId !== work.workerId) return;
    const next = new RenderJobAggregate(current).advance(status, progress, stage, artifact);
    next.attempt = work.attempt;
    this.jobs.set(key, structuredClone(next));
    const event: RenderEvent = {
      id: crypto.randomUUID(),
      jobId: next.id,
      tenantId: next.tenantId,
      sequence: next.sequence,
      type: 'render.progress',
      data: structuredClone(next),
      createdAt: next.updatedAt,
    };
    this.events.get(key)!.push(event);
    if (status === 'ready' || status === 'failed') {
      row.state = 'complete';
      row.workerId = undefined;
      row.leaseUntil = 0;
    } else {
      row.state = 'leased';
      row.leaseUntil = Date.now() + 5000;
    }
    return structuredClone(next);
  }
  async release(work: ClaimedWork) {
    const row = this.work.get(work.id);
    if (row && row.workerId === work.workerId) {
      row.state = 'pending';
      row.workerId = undefined;
      row.leaseUntil = 0;
    }
  }
  async activeCount(tenantId: string) {
    return [...this.jobs.values()].filter(
      (job) => job.tenantId === tenantId && !['ready', 'failed'].includes(job.status),
    ).length;
  }
}
