import { describe, expect, it } from 'vitest';
import { parseRenderJobEvent } from './render-jobs';

describe('render job compatibility', () => {
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
