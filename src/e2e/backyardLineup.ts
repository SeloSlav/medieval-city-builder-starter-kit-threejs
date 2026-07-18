import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { windStrength } from '@seedthree/core/wind.js';
import {
  animateBackyardGardenMesh,
  createBackyardGardenMesh,
  disposeBackyardGardenMesh,
} from '../residences/backyardGardenMesh.ts';
import { loadBackyardPlantCatalog } from '../vegetation/seedthree/backyardPlantAssets.ts';

declare global {
  interface Window {
    __BACKYARD_LINEUP_READY__?: boolean;
  }
}

const root = document.querySelector<HTMLElement>('#lineup-root');
const labels = document.querySelector<HTMLElement>('#labels');
if (!root || !labels) throw new Error('Backyard lineup host is missing.');

const renderer = new WebGPURenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
await renderer.init();
root.prepend(renderer.domElement);

const plants = await loadBackyardPlantCatalog(renderer.getMaxAnisotropy());
windStrength.value = 0.85;

const specs = [
  { kind: 'apple_orchard', label: 'Apple orchard' },
  { kind: 'cherry_orchard', label: 'Cherry orchard' },
  { kind: 'flower_garden', label: 'Flower garden' },
] as const;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa6b29a);
scene.add(new THREE.HemisphereLight(0xdbe5df, 0x4c3b2b, 2.3));
const sun = new THREE.DirectionalLight(0xfff0cf, 3.4);
sun.position.set(-9, 16, 11);
scene.add(sun);

const gardens = specs.map((spec, index) => {
  const garden = createBackyardGardenMesh(spec.kind, {
    width: 6.2,
    depth: 5.4,
    seed: 4271 + index * 97,
    plants,
  });
  garden.position.x = (index - 1) * 7.2;
  scene.add(garden);

  const cell = document.createElement('div');
  cell.className = 'cell';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = spec.label;
  cell.append(label);
  labels.append(cell);
  return garden;
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(29, 14),
  new THREE.MeshStandardMaterial({ color: 0x65794a, roughness: 1 }),
);
ground.rotation.x = -Math.PI * 0.5;
ground.position.y = -0.04;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 7.2, 16.5);
camera.lookAt(0, 1.8, 0);

let running = true;
function render(): void {
  if (!running) return;
  const elapsedSeconds = performance.now() * 0.001;
  for (const garden of gardens) animateBackyardGardenMesh(garden, elapsedSeconds);
  const width = root!.clientWidth;
  const height = root!.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setClearColor(0x1a1e16, 1);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

render();
await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
window.__BACKYARD_LINEUP_READY__ = true;
document.body.dataset.ready = 'true';

window.addEventListener('beforeunload', () => {
  running = false;
  for (const garden of gardens) disposeBackyardGardenMesh(garden);
  renderer.dispose();
});
