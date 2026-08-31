export function playheadX(elapsedMs: number, width = 512) {
  return 38 + ((elapsedMs / 3200) % 1) * width;
}

export function timelineSecond(elapsedMs: number, durationSeconds = 18) {
  return Number((((elapsedMs / 3200) % 1) * durationSeconds).toFixed(1));
}

export function frameNumber(elapsedMs: number, fps = 30, durationSeconds = 18) {
  return Math.min(
    Math.floor(timelineSecond(elapsedMs, durationSeconds) * fps),
    durationSeconds * fps - 1,
  );
}
