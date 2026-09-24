import { z } from 'zod';

// ffprobe JSON is external input even when the subprocess is local.
export const mediaProbeSchema = z.object({
  format: z.object({
    duration: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) > 0),
    bit_rate: z.string().optional(),
    format_name: z.string().optional(),
  }),
  streams: z
    .array(
      z.object({
        codec_type: z.string(),
        codec_name: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        avg_frame_rate: z.string().optional(),
        duration: z.string().optional(),
        nb_read_frames: z.string().optional(),
        sample_rate: z.string().optional(),
        channels: z.number().int().positive().optional(),
      }),
    )
    .default([]),
});

export const vmafReportSchema = z.object({
  pooled_metrics: z.object({ vmaf: z.object({ mean: z.number().finite().min(0).max(100) }) }),
});
