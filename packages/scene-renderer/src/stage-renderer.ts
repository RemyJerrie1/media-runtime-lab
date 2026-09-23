import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { HamsterScene } from '@media-lab/contracts';
import { createLegacyHamsterStage } from './legacy-stage-renderer.js';
import { evaluateScene } from './evaluate-scene.js';

// Preview and capture share the asset, lighting and absolute-time pose.
export function createHamsterStage(
  canvas: HTMLCanvasElement,
  fixedSize?: { width: number; height: number },
  rendererVersion = 'hamster-3',
) {
  if (rendererVersion === 'hamster-1' || rendererVersion === 'hamster-2')
    return { ...createLegacyHamsterStage(canvas, fixedSize), ready: Promise.resolve() };
  if (rendererVersion !== 'hamster-3') throw new Error('UNKNOWN_SCENE_RENDERER');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(fixedSize ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.6, 4.6, 2.5875, -2.5875, 0.1, 40);
  camera.position.set(4, 3.7, 8);
  camera.lookAt(0, 1.15, 0);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.45;
  const key = new THREE.DirectionalLight(0xfff1df, 2);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(key, new THREE.HemisphereLight(0xfff8ea, 0x8c8173, 0.6));
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.25, 3.35, 0.12, 96),
    new THREE.MeshStandardMaterial({ color: 0xf3e9dc, roughness: 1 }),
  );
  platform.receiveShadow = true;
  scene.add(platform);
  const hamster = new THREE.Group();
  scene.add(hamster);
  const controller = new AbortController();
  let disposed = false;
  let loaded = false;
  const feet: { mesh: THREE.Mesh; rest: THREE.Vector3; side: number }[] = [];
  const release = (root: THREE.Object3D) => {
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
    });
    materials.forEach((material) => material.dispose());
  };
  const ready = (async () => {
    const response = await fetch('/models/hamster-3.glb', { signal: controller.signal });
    if (!response.ok) throw new Error('SCENE_MODEL_UNAVAILABLE');
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    if (disposed) {
      release(gltf.scene);
      return;
    }
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const groom = object.name.includes('groom');
      object.castShadow = !groom;
      object.receiveShadow = !groom;
      if (object.name.startsWith('Eye')) {
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = 0.4;
        }
      }
      if (object.name.startsWith('Hind_foot') || object.name.startsWith('Toe')) {
        object.geometry.computeBoundingBox();
        const center = object.geometry
          .boundingBox!.getCenter(new THREE.Vector3())
          .applyMatrix4(object.matrixWorld);
        feet.push({ mesh: object, rest: object.position.clone(), side: center.x < 0 ? -1 : 1 });
      }
    });
    hamster.add(gltf.scene);
    loaded = true;
  })();
  return {
    ready,
    render(document: HamsterScene, timeSeconds = 0) {
      if (disposed) return;
      if (!loaded) throw new Error('SCENE_MODEL_NOT_READY');
      if (renderer.getContext().isContextLost()) throw new Error('SCENE_WEBGL_LOST');
      const width = fixedSize?.width ?? Math.max(canvas.clientWidth, 1);
      if (canvas.width !== Math.floor(width * renderer.getPixelRatio()))
        renderer.setSize(width, fixedSize?.height ?? (width * 9) / 16, false);
      scene.background = new THREE.Color(document.background);
      const evaluated = evaluateScene(document, timeSeconds);
      const pose = evaluated.root;
      hamster.position.set(pose.x, pose.y + evaluated.bodyLift, pose.z);
      hamster.rotation.y = pose.rotationY;
      hamster.scale.setScalar(pose.scale);
      for (const { mesh, rest, side } of feet) {
        const foot = side < 0 ? evaluated.leftFoot : evaluated.rightFoot;
        // The exported GLB has already converted the sculpt to glTF's Y-up coordinates.
        mesh.position
          .copy(rest)
          .add(
            new THREE.Vector3(
              foot.x - side * 0.4,
              foot.y - 0.13 - evaluated.bodyLift,
              foot.z - 0.26,
            ),
          );
      }
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      release(scene);
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
    },
  };
}
