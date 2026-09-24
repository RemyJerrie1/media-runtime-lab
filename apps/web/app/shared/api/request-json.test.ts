import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTimeoutError, requestJson } from './request-json';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('bounded API requests', () => {
  it.each(['headers', 'body'])('aborts stalled %s without retrying POST', async (part) => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const fetcher = vi.fn((_url, init) => {
      signal = init.signal;
      return part === 'headers'
        ? new Promise(() => {})
        : Promise.resolve({
            ok: true,
            status: 200,
            json: () => new Promise(() => {}),
          });
    });
    vi.stubGlobal('fetch', fetcher);
    const result = requestJson('/api', { method: 'POST', body: '{"idempotencyKey":"same"}' }, 50);
    const rejected = expect(result).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    expect(signal.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('propagates caller cancellation and removes its listener', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const result = requestJson('/api', { signal: controller.signal });
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not send an already cancelled request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(requestJson('/api', { signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('cleans the deadline after success and preserves non-JSON HTTP errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ id: 'same' }))
        .mockResolvedValueOnce(new Response('unavailable', { status: 503 })),
    );
    expect(await requestJson('/api')).toEqual({ ok: true, status: 200, data: { id: 'same' } });
    expect(await requestJson('/api')).toEqual({ ok: false, status: 503, data: null });
    expect(vi.getTimerCount()).toBe(0);
  });
});
