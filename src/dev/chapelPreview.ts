import * as THREE from 'three';
import { createChapelMesh } from '../buildings/meshes/chapelMesh.ts';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8cbd5);
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 100);
camera.position.set(12.5, 8.8, 14.8);
camera.lookAt(0, 3.8, 0.25);
scene.add(new THREE.HemisphereLight(0xdcecff, 0x5f563f, 1.7));
const sun = new THREE.DirectionalLight(0xffe2b5, 3.3);
sun.position.set(-9, 14, 11);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(22, 64),
  new THREE.MeshStandardMaterial({ color: 0x718257, roughness: 1 }),
);
ground.rotation.x = -Math.PI * 0.5;
scene.add(ground);

const chapel = createChapelMesh();
chapel.rotation.y = -0.24;
scene.add(chapel);
renderer.render(scene, camera);
