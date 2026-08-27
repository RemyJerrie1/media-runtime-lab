export const MEDIA_RUNTIME = {
  durationSeconds: 18,
  framesPerSecond: 30,
  spriteFrameCount: 8,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
} as const;

export const MEDIA_CAPABILITIES = [
  '中日韓字幕提示軌',
  '精靈圖播放',
  'Canvas 二維合成',
  'CSS 三維圖層',
] as const;
