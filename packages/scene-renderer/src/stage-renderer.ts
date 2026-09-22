import * as THREE from 'three';
import type { HamsterScene } from '@media-lab/contracts';
import { evaluateScene } from './evaluate-scene.js';

// Shared procedural scene, independent of React and persistence; render only on change.
export function createHamsterStage(
  canvas: HTMLCanvasElement,
  fixedSize?: { width: number; height: number },
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(fixedSize ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.6, 4.6, 2.5875, -2.5875, 0.1, 40);
  camera.position.set(4, 3.7, 8);
  camera.lookAt(0, 1.15, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e3, 0x66533f, 2.3));
  const key = new THREE.DirectionalLight(0xfff5e5, 3.2);
  key.position.set(-3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe5eeff, 1.6);
  rim.position.set(4, 3, -3);
  scene.add(rim);
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const material = (color: number, roughness = 0.8) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness });
    materials.add(value);
    return value;
  };
  const fur = material(0xc99050),
    cream = material(0xffe8c5),
    pink = material(0xde9b91);
  const dark = material(0x251b19, 0.28),
    white = material(0xffffff),
    whisker = material(0x735746);
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  geometries.add(sphere);
  function part(
    parent: THREE.Object3D,
    name: string,
    mat: THREE.Material,
    pos: number[],
    scale: number[],
  ) {
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.name = name;
    mesh.position.set(pos[0]!, pos[1]!, pos[2]!);
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const platformGeometry = new THREE.CylinderGeometry(3.25, 3.35, 0.12, 96);
  geometries.add(platformGeometry);
  const platform = new THREE.Mesh(platformGeometry, material(0xf3e9dc));
  platform.receiveShadow = true;
  scene.add(platform);
  const hamster = new THREE.Group();
  hamster.name = 'hamster';
  scene.add(hamster);
  const upper = new THREE.Group();
  hamster.add(upper);
  part(upper, 'body', fur, [0, 0.95, 0], [0.78, 0.85, 0.6]);
  part(upper, 'belly', cream, [0, 0.91, 0.43], [0.59, 0.66, 0.22]);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 1.75, 0.15);
  upper.add(head);
  part(head, 'face', fur, [0, 0, 0], [0.77, 0.66, 0.59]);
  for (const side of [-1, 1]) {
    part(head, `ear-${side}`, fur, [side * 0.55, 0.5, -0.04], [0.25, 0.29, 0.15]);
    part(head, `inner-ear-${side}`, pink, [side * 0.55, 0.51, 0.09], [0.16, 0.19, 0.045]);
    part(head, `cheek-${side}`, cream, [side * 0.37, -0.21, 0.4], [0.39, 0.31, 0.26]);
    part(head, `eye-${side}`, dark, [side * 0.31, 0.1, 0.54], [0.09, 0.11, 0.065]);
    part(
      head,
      `eye-glint-${side}`,
      white,
      [side * 0.31 - 0.024, 0.14, 0.595],
      [0.026, 0.032, 0.016],
    );
    const arm = part(upper, `arm-${side}`, fur, [side * 0.65, 1, 0.37], [0.2, 0.36, 0.22]);
    arm.rotation.z = side * 0.35;
    part(upper, `hand-${side}`, pink, [side * 0.55, 0.75, 0.56], [0.15, 0.13, 0.12]);
    part(hamster, `foot-${side}`, pink, [side * 0.4, 0.13, 0.26], [0.25, 0.13, 0.32]);
    for (const offset of [-1, 1]) {
      const line = part(
        head,
        `whisker-${side}-${offset}`,
        whisker,
        [side * 0.64, -0.17 + offset * 0.07, 0.57],
        [0.19, 0.012, 0.012],
      );
      line.rotation.z = side * offset * 0.16;
    }
    const mouth = part(
      head,
      `mouth-${side}`,
      dark,
      [side * 0.065, -0.27, 0.653],
      [0.08, 0.014, 0.014],
    );
    mouth.rotation.z = side * 0.4;
  }
  part(head, 'nose', pink, [0, -0.14, 0.67], [0.105, 0.073, 0.055]);
  part(upper, 'tail', cream, [0, 0.48, -0.64], [0.17, 0.16, 0.18]);
  let disposed = false;
  return {
    render(document: HamsterScene, timeSeconds = 0) {
      if (disposed) return;
      if (renderer.getContext().isContextLost()) throw new Error('SCENE_WEBGL_LOST');
      const width = fixedSize?.width ?? Math.max(canvas.clientWidth, 1);
      if (canvas.width !== Math.floor(width * renderer.getPixelRatio()))
        renderer.setSize(width, fixedSize?.height ?? (width * 9) / 16, false);
      scene.background = new THREE.Color(document.background);
      const evaluated = evaluateScene(document, timeSeconds);
      const pose = evaluated.root;
      upper.position.y = evaluated.bodyLift;
      for (const side of [-1, 1]) {
        const foot = side === -1 ? evaluated.leftFoot : evaluated.rightFoot;
        hamster.getObjectByName('foot-' + side)!.position.set(foot.x, foot.y, foot.z);
        upper.getObjectByName('arm-' + side)!.rotation.x = side * evaluated.armSwing;
        upper.getObjectByName('hand-' + side)!.position.z = 0.56 + side * evaluated.armSwing;
      }
      hamster.position.set(pose.x, pose.y, pose.z);
      hamster.rotation.y = pose.rotationY;
      hamster.scale.setScalar(pose.scale);
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
    },
  };
}
