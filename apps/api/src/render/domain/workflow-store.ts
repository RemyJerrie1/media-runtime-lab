import type { CreateRenderJob, RenderEvent, RenderJob, RenderStatus } from '@media-lab/contracts';

export type ArtifactReceipt = Pick<
  RenderJob,
  'artifactUrl' | 'artifactChecksum' | 'manifestUrl' | 'renditions' | 'evidence'
>;

export const WORKFLOW_STORE = Symbol('WORKFLOW_STORE');
export type CreateWorkflow = {
  tenantId: string;
  traceId: string;
  requestId: string;
  command: CreateRenderJob;
  quotaTokens: number;
};
export type ClaimedWork = {
  id: string;
  jobId: string;
  tenantId: string;
  workerId: string;
  attempt: number;
};

export interface WorkflowStore {
  initialize(): Promise<void>;
  create(input: CreateWorkflow): Promise<{ job: RenderJob; created: boolean }>;
  findById(tenantId: string, id: string): Promise<RenderJob | undefined>;
  listEvents(tenantId: string, id: string, afterSequence: number): Promise<RenderEvent[]>;
  claimNext(workerId: string, leaseMs: number): Promise<ClaimedWork | undefined>;
  advance(
    work: ClaimedWork,
    status: RenderStatus,
    progress: number,
    stage: string,
    artifact?: ArtifactReceipt,
  ): Promise<RenderJob | undefined>;
  release(work: ClaimedWork, error?: string): Promise<void>;
  activeCount(tenantId: string): Promise<number>;
}
