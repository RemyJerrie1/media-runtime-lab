export const MEDIA_RUNTIME = {
  durationSeconds: 18,
  framesPerSecond: 30,
  spriteFrameCount: 8,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
} as const;

export const MEDIA_CAPABILITIES = [
  'CJK Subtitle Cues',
  'Sprite Sheet Playback',
  'Canvas 2D Composition',
  'CSS 3D Layer',
] as const;
