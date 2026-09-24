export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

export class ApiTimeoutError extends Error {
  constructor() {
    super('請求逾時，尚未確認伺服器結果。請檢查連線後重試原操作。');
    this.name = 'ApiTimeoutError';
  }
}

// The deadline covers headers AND body consumption. Never automatically retry a POST.
export async function requestJson(url: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const external = init.signal;
  const cancel = () => controller.abort(external?.reason);
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort(controller.signal.reason);
  controller.signal.addEventListener('abort', onAbort, { once: true });
  external?.addEventListener('abort', cancel, { once: true });
  if (external?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new ApiTimeoutError()), timeoutMs);
  try {
    return await Promise.race([
      aborted,
      (async () => {
        controller.signal.throwIfAborted();
        const response = await fetch(url, { ...init, signal: controller.signal });
        const data: unknown = response.ok
          ? await response.json()
          : await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, data };
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
