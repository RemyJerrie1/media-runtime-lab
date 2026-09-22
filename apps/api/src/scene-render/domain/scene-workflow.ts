import { createHash, randomUUID } from 'node:crypto';
import {
  SCENE_RENDERER_VERSION,
  sceneReceiptSchema,
  type CreateSceneRender,
  type SceneReceipt,
  type SceneRenderJob,
} from '@media-lab/contracts';

export const SCENE_STORE = Symbol('SCENE_STORE');
export const SCENE_PROCESSOR = Symbol('SCENE_PROCESSOR');
export type SceneLease = { job: SceneRenderJob; owner: string; tenant: string; retryLimit: number };
export type SceneUpdate = {
  status: 'rendering' | 'encoding' | 'ready' | 'failed';
  frames: number;
  error?: string;
  receipt?: SceneReceipt;
};
export interface SceneStore {
  initialize(): Promise<void>;
  create(tenant: string, command: CreateSceneRender): Promise<SceneRenderJob>;
  get(tenant: string, id: string): Promise<SceneRenderJob | undefined>;
  claim(owner: string, leaseMs: number): Promise<SceneLease | undefined>;
  renew(work: SceneLease, leaseMs: number): Promise<boolean>;
  update(work: SceneLease, update: SceneUpdate): Promise<boolean>;
  retry(tenant: string, id: string, expectedAttempt: number): Promise<SceneRenderJob | undefined>;
  cancel(tenant: string, id: string): Promise<SceneRenderJob | undefined>;
}
export interface SceneProcessor {
  render(
    job: SceneRenderJob,
    signal: AbortSignal,
    progress: (frames: number, encoding: boolean) => Promise<void>,
  ): Promise<SceneReceipt>;
  discard(receipt: SceneReceipt): Promise<void>;
}
export function sceneFingerprint(command: CreateSceneRender) {
  // Zod parsed input fixes object key order; no transport/idempotency fields in content identity.
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: command.version,
        kind: command.kind,
        rendererVersion: SCENE_RENDERER_VERSION,
        scene: command.scene,
      }),
    )
    .digest('hex');
}
export function newSceneJob(command: CreateSceneRender): SceneRenderJob {
  return {
    version: 1,
    kind: 'hamster-scene',
    id: randomUUID(),
    scene: structuredClone(command.scene),
    sceneFingerprint: sceneFingerprint(command),
    rendererVersion: SCENE_RENDERER_VERSION,
    status: 'accepted',
    completedFrames: 0,
    attempt: 0,
    sequence: 1,
    error: null,
    receipt: null,
    updatedAt: new Date().toISOString(),
  };
}
export function advanceScene(job: SceneRenderJob, update: SceneUpdate): SceneRenderJob {
  if (!['rendering', 'encoding'].includes(job.status)) throw new Error('SCENE_INVALID_TRANSITION');
  if (
    update.frames < job.completedFrames ||
    update.frames > 120 ||
    !Number.isInteger(update.frames)
  )
    throw new Error('SCENE_INVALID_PROGRESS');
  if (job.status === 'encoding' && update.status === 'rendering')
    throw new Error('SCENE_INVALID_TRANSITION');
  if (update.status === 'encoding' && update.frames !== 120)
    throw new Error('SCENE_INCOMPLETE_FRAMES');
  let receipt = null;
  if (update.status === 'ready') {
    if (job.status !== 'encoding' || update.frames !== 120)
      throw new Error('SCENE_INCOMPLETE_FRAMES');
    receipt = sceneReceiptSchema.parse(update.receipt);
    if (
      receipt.sceneFingerprint !== job.sceneFingerprint ||
      receipt.rendererVersion !== job.rendererVersion
    )
      throw new Error('SCENE_RECEIPT_MISMATCH');
  }
  return {
    ...job,
    status: update.status,
    completedFrames: update.frames,
    error: update.error ?? null,
    receipt,
    sequence: job.sequence + 1,
    updatedAt: new Date().toISOString(),
  };
}
