import { z } from 'zod';

export const renderStatusSchema = z.enum(['accepted','composing','encoding','packaging','ready','failed']);
export type RenderStatus = z.infer<typeof renderStatusSchema>;

export const createRenderJobSchema = z.object({
  projectId: z.string().min(3),
  template: z.enum(['story','square','landscape']),
  durationSeconds: z.number().int().min(3).max(120),
  narration: z.string().min(3).max(600),
  idempotencyKey: z.string().min(8),
});
export type CreateRenderJob = z.infer<typeof createRenderJobSchema>;

export const renderJobSchema = z.object({
  id: z.string(), projectId: z.string(), status: renderStatusSchema,
  progress: z.number().min(0).max(100), stage: z.string(),
  estimatedCostUsd: z.number().nonnegative(), tokens: z.number().int().nonnegative(),
  artifactUrl: z.string().nullable(), updatedAt: z.string(),
});
export type RenderJob = z.infer<typeof renderJobSchema>;

export const apiErrorSchema = z.object({ code:z.string(), message:z.string(), traceId:z.string() });
