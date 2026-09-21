import { describe, expect, it } from 'vitest';
import { parseRenderJobEvent, playbackPath } from './render-jobs';

describe('render job compatibility', () => {
  it('uses the committed delivery identity when switching preview quality', () => {
    const receipt = {
      artifactUrl: '/artifacts/committed-output.mp4',
      renditions: [
        {
          id: '720p',
          width: 1280,
          height: 720,
          bitrateKbps: 2500,
          playlistUrl: '/streams/committed-output/720p.m3u8',
          checksum: 'sha256:test',
          vmaf: null,
          qualityMetricStatus: 'not-requested' as const,
        },
      ],
    };
    expect(playbackPath(receipt, '720p')).toBe('/streams/committed-output/720p.mp4');
    expect(playbackPath(receipt, 'missing-quality')).toBe(receipt.artifactUrl);
    expect(playbackPath({ artifactUrl: receipt.artifactUrl, renditions: [] }, '720p')).toBe(
      receipt.artifactUrl,
    );
  });
  it('normalizes task events created before adaptive streaming fields existed', () => {
    const legacy = parseRenderJobEvent(
      JSON.stringify({
        id: 'legacy-job',
        traceId: 'legacy-trace',
        status: 'ready',
      }),
    );

    expect(legacy.requestId).toBe('legacy-trace');
    expect(legacy.manifestUrl).toBeNull();
    expect(legacy.renditions).toEqual([]);
  });
});
