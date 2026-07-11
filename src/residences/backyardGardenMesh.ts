import * as THREE from 'three';
import type { BackyardGardenKind } from '../generated/gameBalance.ts';
import { addMesh, timberMaterial } from '../buildings/buildingMaterials.ts';

const SOIL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4a3b2d,
  roughness: 0.92,
  metalness: 0,
});

const LEAF_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4f7a3d,
  roughness: 0.82,
  metalness: 0,
});

const FRUIT_MATERIALS = new Map<number, THREE.MeshStandardMaterial>();
const FLOWER_MATERIALS = new Map<number, THREE.MeshStandardMaterial>();
const VEGETABLE_MATERIALS = [
  new THREE.MeshStandardMaterial({ color: 0x5f8f45, roughness: 0.86 }),
  new THREE.MeshStandardMaterial({ color: 0x4d7a38, roughness: 0.86 }),
] as const;
const HERB_BED_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x6a9a52, roughness: 0.84 });
const HERB_STALK_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x88b86a, roughness: 0.8 });

const FLOWER_COLORS = [0xd45c7a, 0xe8b84a, 0x9a6fd1, 0xf08a4a] as const;

function fruitMaterial(color: number): THREE.MeshStandardMaterial {
  let material = FRUIT_MATERIALS.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    FRUIT_MATERIALS.set(color, material);
  }
  return material;
}

function flowerMaterial(color: number): THREE.MeshStandardMaterial {
  let material = FLOWER_MATERIALS.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
    FLOWER_MATERIALS.set(color, material);
  }
  return material;
}

function addSoilBed(group: THREE.Group, width: number, depth: number): void {
  addMesh(
    group,
    new THREE.BoxGeometry(width, 0.08, depth),
    SOIL_MATERIAL,
    new THREE.Vector3(0, 0.04, 0),
  );
}

function addOrchardTrees(group: THREE.Group, fruitColor: number, count: number): void {
  const fruit = fruitMaterial(fruitColor);
  for (let index = 0; index < count; index++) {
    const x = -1.4 + index * 1.4;
    const trunk = timberMaterial('mid');
    addMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 1.1, 6), trunk, new THREE.Vector3(x, 0.55, 0));
    addMesh(
      group,
      new THREE.SphereGeometry(0.55, 8, 6),
      LEAF_MATERIAL,
      new THREE.Vector3(x, 1.35, 0),
    );
    addMesh(
      group,
      new THREE.SphereGeometry(0.1, 6, 5),
      fruit,
      new THREE.Vector3(x + 0.18, 1.28, 0.16),
    );
  }
}

function addVegetableRows(group: THREE.Group): void {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      addMesh(
        group,
        new THREE.BoxGeometry(0.42, 0.18, 0.42),
        VEGETABLE_MATERIALS[row % 2] ?? VEGETABLE_MATERIALS[0],
        new THREE.Vector3(-1.35 + col * 0.9, 0.12, -0.9 + row * 0.9),
      );
    }
  }
}

function addFlowerPatches(group: THREE.Group): void {
  for (let index = 0; index < 8; index++) {
    const color = FLOWER_COLORS[index % FLOWER_COLORS.length] ?? 0xd45c7a;
    addMesh(
      group,
      new THREE.SphereGeometry(0.14, 6, 5),
      flowerMaterial(color),
      new THREE.Vector3(-1.5 + (index % 4) * 1, 0.16, -0.9 + Math.floor(index / 4) * 1.1),
    );
  }
}

function addHerbPlots(group: THREE.Group): void {
  for (let index = 0; index < 6; index++) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.5, 0.22, 0.5),
      HERB_BED_MATERIAL,
      new THREE.Vector3(-1.2 + (index % 3) * 1.2, 0.14, -0.55 + Math.floor(index / 3) * 1.1),
    );
    addMesh(
      group,
      new THREE.BoxGeometry(0.08, 0.28, 0.08),
      HERB_STALK_MATERIAL,
      new THREE.Vector3(-1.2 + (index % 3) * 1.2, 0.34, -0.55 + Math.floor(index / 3) * 1.1),
    );
  }
}

export function createBackyardGardenMesh(kind: BackyardGardenKind): THREE.Group {
  const group = new THREE.Group();
  group.name = `BackyardGarden:${kind}`;

  switch (kind) {
    case 'apple_orchard':
      addSoilBed(group, 3.8, 2.4);
      addOrchardTrees(group, 0xc44a3a, 3);
      break;
    case 'cherry_orchard':
      addSoilBed(group, 3.8, 2.4);
      addOrchardTrees(group, 0x8f2438, 3);
      break;
    case 'vegetable_garden':
      addSoilBed(group, 3.6, 2.8);
      addVegetableRows(group);
      break;
    case 'flower_garden':
      addSoilBed(group, 3.4, 2.2);
      addFlowerPatches(group);
      break;
    case 'herb_garden':
      addSoilBed(group, 3.2, 2.2);
      addHerbPlots(group);
      break;
    default: {
      const unreachable: never = kind;
      throw new Error(`Unknown backyard garden kind: ${unreachable}`);
    }
  }

  return group;
}
