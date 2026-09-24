import { expect, test } from 'vitest';
import { mediaProbeSchema, vmafReportSchema } from './media-probe';

test('rejects malformed external probe fields before using them as measurements', () => {
  for (const value of [
    null,
    {},
    { format: { duration: 'NaN' } },
    { format: { duration: '-1' } },
    { format: { duration: '1' }, streams: [{ codec_type: 'video', width: '640' }] },
  ])
    expect(mediaProbeSchema.safeParse(value).success).toBe(false);
  expect(
    mediaProbeSchema.parse({ format: { duration: '1.2' }, streams: [{ codec_type: 'audio' }] })
      .format.duration,
  ).toBe('1.2');
  for (const mean of ['99', -1, 101, Infinity])
    expect(vmafReportSchema.safeParse({ pooled_metrics: { vmaf: { mean } } }).success).toBe(false);
});
