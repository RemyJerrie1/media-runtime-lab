export type SubtitleCue = { start: number; end: number; text: string };

export const SUBTITLE_CUES: readonly SubtitleCue[] = [
  { start: 0, end: 3.6, text: '讓 AI 產生靈感，讓工程確保交付。' },
  { start: 3.6, end: 7.2, text: '字幕、動畫與聲音，共用同一條時間軸。' },
  { start: 7.2, end: 10.8, text: '可預覽、可重播，也能確定性算圖。' },
] as const;

export function loopProgress(elapsedMs: number, loopMs = 10_800) {
  return (elapsedMs % loopMs) / loopMs;
}

export function activeSubtitle(elapsedMs: number): SubtitleCue {
  const second = loopProgress(elapsedMs) * 10.8;
  return SUBTITLE_CUES.find((cue) => second >= cue.start && second < cue.end) ?? SUBTITLE_CUES[0]!;
}

export function activeSpriteFrame(elapsedMs: number, frameCount = 8) {
  return Math.floor((elapsedMs / 140) % frameCount);
}
