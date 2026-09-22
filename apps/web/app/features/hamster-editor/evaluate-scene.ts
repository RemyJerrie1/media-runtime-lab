import type { HamsterScene } from '@media-lab/contracts';

export function clampTime(seconds: number): number {
  return Number.isFinite(seconds) ? Math.min(5, Math.max(0, seconds)) : 0;
}

// Absolute time and distance only: seeking and different frame rates produce the same pose.
export function evaluateScene(document: HamsterScene, timeSeconds: number) {
  const time = clampTime(timeSeconds);
  const u = time / document.animation.durationSeconds;
  const progress = u * u * (3 - 2 * u); // smoothstep; zero speed at both endpoints
  const start = document.transform;
  const end = document.animation.end;
  const dx = end.x - start.x,
    dz = end.z - start.z;
  const distance = Math.hypot(dx, dz);
  const turn = ((end.heading - start.heading + 540) % 360) - 180;
  const heading = start.heading + turn * progress;
  const rotationY = (heading * Math.PI) / 180;
  const phase = ((distance * progress) / (0.45 * start.scale)) * Math.PI * 2;
  const envelope = u === 0 || u === 1 ? 0 : Math.sin(Math.PI * u) * Math.min(1, distance / 0.3);
  const swing = Math.sin(phase) * envelope;
  // Feet move along the travel direction in the hamster's local coordinates.
  const localX =
    distance === 0 ? 0 : (dx * Math.cos(rotationY) - dz * Math.sin(rotationY)) / distance;
  const localZ =
    distance === 0 ? 0 : (dx * Math.sin(rotationY) + dz * Math.cos(rotationY)) / distance;
  const foot = (side: number) => ({
    x: side * 0.4 + side * swing * 0.09 * localX,
    y: 0.13 + Math.max(0, side * swing) * 0.1,
    z: 0.26 + side * swing * 0.09 * localZ,
  });
  return {
    time,
    root: {
      x: start.x + dx * progress,
      y: 0.06,
      z: start.z + dz * progress,
      rotationY,
      scale: start.scale,
    },
    bodyLift: Math.abs(Math.sin(phase)) * envelope * 0.035,
    leftFoot: foot(-1),
    rightFoot: foot(1),
    armSwing: swing * 0.08,
  };
}

export function playbackTime(startTime: number, startedAtMs: number, nowMs: number): number {
  return clampTime(startTime + Math.max(0, nowMs - startedAtMs) / 1000);
}
