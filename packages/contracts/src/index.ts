import { z } from 'zod';

export const renderStatusSchema = z.enum(['accepted','composing','encoding','packaging','ready','failed']);
export type RenderStatus = z.infer<typeof renderStatusSchema>;

export const ffmpegEncodingSchema = z.object({
  codec: z.literal('libx264'),
  preset: z.enum(['fast','medium','slow']),
  rateControl: z.enum(['crf','bitrate']),
  crf: z.number().int().min(0).max(51),
  bitrateKbps: z.number().int().min(200).max(50000),
  gop: z.number().int().min(1).max(600),
  fps: z.number().int().min(12).max(120),
});
export type FfmpegEncoding = z.infer<typeof ffmpegEncodingSchema>;

export const mediaProcessingSchema = z.object({
  frameRateMode: z.enum(['cfr','vfr']),
  audioSampleRate: z.union([z.literal(44100),z.literal(48000)]),
  audioSync: z.enum(['passthrough','async-resample']),
  subtitleMode: z.enum(['none','burn-in','webvtt']),
  watermarkMode: z.enum(['none','visible','dynamic']),
  adInsertion: z.enum(['none','csai','ssai']),
  fastStart: z.boolean(),
});
export type MediaProcessing = z.infer<typeof mediaProcessingSchema>;

export const createRenderJobSchema = z.object({
  projectId: z.string().min(3),
  template: z.enum(['story','square','landscape']),
  trimStartSeconds: z.number().min(0).max(3600),
  durationSeconds: z.number().int().min(3).max(120),
  encoding: ffmpegEncodingSchema,
  processing: mediaProcessingSchema,
  narration: z.string().min(3).max(600),
  idempotencyKey: z.string().min(8).max(120),
});
export type CreateRenderJob = z.infer<typeof createRenderJobSchema>;

export const renderJobSchema = z.object({
  id: z.string(), tenantId: z.string(), projectId: z.string(), status: renderStatusSchema,
  progress: z.number().min(0).max(100), stage: z.string(), sequence: z.number().int().nonnegative(),
  attempt: z.number().int().nonnegative(), traceId: z.string(),
  estimatedCostUsd: z.number().nonnegative(), tokens: z.number().int().nonnegative(),
  template: z.enum(['story','square','landscape']), trimStartSeconds: z.number().nonnegative(), durationSeconds: z.number().int().positive(),
  encoding: ffmpegEncodingSchema, processing: mediaProcessingSchema,
  ffprobeArgs: z.array(z.string()), ffmpegArgs: z.array(z.string()),
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
