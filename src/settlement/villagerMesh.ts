import * as THREE from 'three';
import { addMesh } from '../buildings/buildingMaterials.ts';
import { mulberry32, pick } from '../utils/random.ts';

const TUNIC_COLORS = [0x6b4e38, 0x4a5c44, 0x5c4636, 0x3d4a62, 0x7a5e46, 0x556b48] as const;
const SKIN_COLORS = [0xd4a574, 0xc9956a, 0xe0b080, 0xbf8860] as const;

export function createVillagerMesh(seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'Villager';

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: pick(SKIN_COLORS, rng),
    roughness: 0.88,
    metalness: 0,
  });
  const tunicMaterial = new THREE.MeshStandardMaterial({
    color: pick(TUNIC_COLORS, rng),
    roughness: 0.92,
    metalness: 0,
  });
  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3028,
    roughness: 0.95,
    metalness: 0,
  });

  addMesh(
    group,
    new THREE.CapsuleGeometry(0.22, 0.72, 4, 8),
    tunicMaterial,
    new THREE.Vector3(0, 0.62, 0),
  );
  addMesh(
    group,
    new THREE.CapsuleGeometry(0.16, 0.34, 4, 8),
    pantsMaterial,
    new THREE.Vector3(0, 0.22, 0),
  );
  addMesh(
    group,
    new THREE.SphereGeometry(0.19, 10, 10),
    skinMaterial,
    new THREE.Vector3(0, 1.18, 0),
  );

  group.userData.appearanceSeed = seed;
  return group;
}
