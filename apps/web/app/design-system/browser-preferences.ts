// Optional UI preferences must not prevent a workspace opening when storage is blocked.
// Scene documents use their own adapter, which reports failures instead of swallowing them.
type StorageKind = 'localStorage' | 'sessionStorage';
export function readPreference(kind: StorageKind, key: string): string | null {
  try {
    return window[kind].getItem(key);
  } catch {
    return null;
  }
}
export function writePreference(kind: StorageKind, key: string, value: string): void {
  try {
    window[kind].setItem(key, value);
  } catch {
    /* Keep the in-memory UI preference. */
  }
}
export function removePreference(kind: StorageKind, key: string): void {
  try {
    window[kind].removeItem(key);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}
