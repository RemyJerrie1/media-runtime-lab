import { describe, expect, it } from 'vitest';
import { defaultScene, parseScene, serializeScene } from './scene-model';
import { evaluateScene, playbackTime } from './evaluate-scene';

function moving() {
  const scene = defaultScene();
  scene.transform = { x: -1, z: -0.5, heading: 170, scale: 1 };
  scene.animation.end = { x: 1, z: 0.5, heading: -170 };
  return scene;
}
describe('absolute hamster animation', () => {
  it('matches fixed endpoint and midpoint poses, turning through the shortest angle', () => {
    const scene = moving();
    expect(evaluateScene(scene, 0).root).toEqual({
      x: -1,
      y: 0.06,
      z: -0.5,
      rotationY: (170 * Math.PI) / 180,
      scale: 1,
    });
    expect(evaluateScene(scene, 2.5).root).toEqual({
      x: 0,
      y: 0.06,
      z: 0,
      rotationY: Math.PI,
      scale: 1,
    });
    expect(evaluateScene(scene, 5).root).toEqual({
      x: 1,
      y: 0.06,
      z: 0.5,
      rotationY: (190 * Math.PI) / 180,
      scale: 1,
    });
    expect(evaluateScene(scene, 5).bodyLift).toBe(0);
    expect(evaluateScene(scene, 5).leftFoot.y).toBe(0.13);
  });
  it('has no history or frame-rate dependence across forward/backward seeks and reload', () => {
    const scene = moving();
    const untouched = structuredClone(scene);
    const times = [0, 1, 2.5, 4, 5];
    const poses = times.map((time) => evaluateScene(scene, time));
    for (const time of [5, 2.5, 1, 0, 4, 1]) evaluateScene(scene, time);
    expect(times.map((time) => evaluateScene(parseScene(serializeScene(scene)), time))).toEqual(
      poses,
    );
    expect(scene).toEqual(untouched);
    for (const fps of [24, 30, 60, 144]) {
      let pose;
      for (let frame = 0; frame <= fps * 5; frame++) pose = evaluateScene(scene, frame / fps);
      expect(pose).toEqual(poses[4]);
    }
  });
  it('keeps static scenes motionless, including a turn without translation', () => {
    const scene = defaultScene();
    for (const time of [0, 1, 2.5, 4, 5]) {
      const pose = evaluateScene(scene, time);
      expect(pose.root).toEqual(evaluateScene(scene, 0).root);
      expect(pose.bodyLift).toBe(0);
      expect(pose.armSwing).toBe(0);
      expect(pose.leftFoot).toEqual({ x: -0.4, y: 0.13, z: 0.26 });
    }
    scene.animation.end.heading = 90;
    expect(evaluateScene(scene, 2.5).root.rotationY).toBe(Math.PI / 4);
    expect(evaluateScene(scene, 2.5).leftFoot.y).toBe(0.13);
  });
  it('keeps feet above the stage, has continuous gait and settles at endpoints', () => {
    const scene = moving();
    let previous = evaluateScene(scene, 0);
    let lifted = false;
    for (let frame = 1; frame <= 500; frame++) {
      const pose = evaluateScene(scene, frame / 100);
      expect(pose.leftFoot.y).toBeGreaterThanOrEqual(0.13);
      expect(pose.rightFoot.y).toBeGreaterThanOrEqual(0.13);
      expect(Math.abs(pose.leftFoot.y - previous.leftFoot.y)).toBeLessThan(0.025);
      expect(Math.abs(pose.root.x - previous.root.x)).toBeLessThan(0.01);
      lifted ||= pose.leftFoot.y > 0.15;
      previous = pose;
    }
    expect(lifted).toBe(true);
  });
  it('clamps times and advances the playback clock by elapsed time rather than frames', () => {
    expect(evaluateScene(moving(), -10)).toEqual(evaluateScene(moving(), 0));
    expect(evaluateScene(moving(), 99)).toEqual(evaluateScene(moving(), 5));
    expect(evaluateScene(moving(), NaN)).toEqual(evaluateScene(moving(), 0));
    expect(playbackTime(1, 1000, 3500)).toBe(3.5);
    expect(playbackTime(1, 1000, 100000)).toBe(5);
    expect(playbackTime(2, 1000, 900)).toBe(2);
  });
});
