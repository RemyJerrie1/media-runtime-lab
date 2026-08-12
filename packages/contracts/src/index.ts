import { z } from 'zod';

export const renderStatusSchema = z.enum(['accepted','composing','encoding','packaging','ready','failed']);
export type RenderStatus = z.infer<typeof renderStatusSchema>;

export const createRenderJobSchema = z.object({
  projectId: z.string().min(3),
  template: z.enum(['story','square','landscape']),
  durationSeconds: z.number().int().min(3).max(120),
  narration: z.string().min(3).max(600),
  idempotencyKey: z.string().min(8).max(120),
});
export type CreateRenderJob = z.infer<typeof createRenderJobSchema>;

export const renderJobSchema = z.object({
  id: z.string(), tenantId: z.string(), projectId: z.string(), status: renderStatusSchema,
  progress: z.number().min(0).max(100), stage: z.string(), sequence: z.number().int().nonnegative(),
  attempt: z.number().int().nonnegative(), traceId: z.string(),
  estimatedCostUsd: z.number().nonnegative(), tokens: z.number().int().nonnegative(),
  artifactUrl: z.string().nullable(), artifactChecksum: z.string().nullable(), updatedAt: z.string(),
});
export type RenderJob = z.infer<typeof renderJobSchema>;

export const renderEventSchema = z.object({
  id: z.string(), jobId: z.string(), tenantId: z.string(), sequence: z.number().int().positive(),
  type: z.literal('render.progress'), data: renderJobSchema, createdAt: z.string(),
});
export type RenderEvent = z.infer<typeof renderEventSchema>;

export const operationsSnapshotSchema = z.object({
  service: z.literal('media-runtime-api'), windowStartedAt: z.string(), commands: z.number().int(),
  duplicatesPrevented: z.number().int(), completed: z.number().int(), failed: z.number().int(),
  active: z.number().int(), replayedEvents: z.number().int(),
  targets: z.object({ renderSuccessRate:z.number(), recoverySeconds:z.number(), duplicateExecutionRate:z.number(), costAttributionCoverage:z.number(), traceCompleteness:z.number() }),
});
export type OperationsSnapshot = z.infer<typeof operationsSnapshotSchema>;

export const apiErrorSchema = z.object({ code:z.string(), message:z.string(), traceId:z.string() });