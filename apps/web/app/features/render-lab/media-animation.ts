export function waveformY(x: number, phase: number, center = 210, amplitude = 24) {
  return center + Math.sin(x / 24 + phase) * amplitude + Math.sin(x / 51 - phase * 0.7) * amplitude * 0.35;
}

export function playheadX(elapsedMs: number, width = 512) {
  return 38 + ((elapsedMs / 3200) % 1) * width;
}
