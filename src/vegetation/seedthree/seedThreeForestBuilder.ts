import * as THREE from 'three';
import { buildTree, forestBarkMaterial } from '@seedthree/core/tree.js';
import { forestCardMaterial } from '@seedthree/core/branch-cards.js';
import { Rng } from '@seedthree/core/rng.js';
import type { Terrain } from '../../terrain/Terrain.ts';
import type { ForestTreePlacement } from '../../props/forestPlacements.ts';
import {
  GORSKI_KOTAR_PRESETS,
  resolveSeedThreePreset,
  seedThreeScaleForPreset,
  type SeedThreePresetKey,
} from './gorskiKotarSpecies.ts';
import { GORSKI_KOTAR_SPECIES } from './gorskiKotarPresets.ts';
import { loadSeedThreeSpeciesAssets, type SeedThreeSpeciesAssets } from './seedThreeAssets.ts';
import type { SeedThreeForestController } from './seedThreeForestTypes.ts';

type TreeSlot = {
  layoutIndex: number;
  matrix: THREE.Matrix4;
  pos: THREE.Vector3;
  visibleMatrix: THREE.Matrix4;
};

type SpeciesBucket = {
  preset: SeedThreePresetKey;
  slots: TreeSlot[];
  lod2Set: {
    branches: THREE.InstancedMesh | null;
    cards: Array<THREE.InstancedMesh & { userData: Record<string, unknown> }>;
  };
};

export type SeedThreeForestInstances = {
  group: THREE.Group;
  placements: ForestTreePlacement[];
  buckets: SpeciesBucket[];
  slotByLayoutIndex: Array<{ bucketIndex: number; slotIndex: number } | null>;
  hiddenMatrix: THREE.Matrix4;
};

const FOREST_LOD_OPTS = {
  mobileTarget: true,
  meshQuality: 0.78,
  lod1Dist: 48,
  lod2Dist: 96,
  lod1Density: 0.88,
  lod2Density: 0.72,
  lod1Pct: 42,
  lod2Pct: 14,
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const COMPOSE_POS = new THREE.Vector3();
const COMPOSE_QUAT = new THREE.Quaternion();
const COMPOSE_SCALE = new THREE.Vector3();
const COMPOSE_MATRIX = new THREE.Matrix4();

function composeTreeMatrix(
  x: number,
  y: number,
  z: number,
  rotY: number,
  scale: number,
): THREE.Matrix4 {
  COMPOSE_QUAT.setFromAxisAngle(Y_AXIS, rotY);
  COMPOSE_POS.set(x, y, z);
  COMPOSE_SCALE.setScalar(scale);
  return COMPOSE_MATRIX.compose(COMPOSE_POS, COMPOSE_QUAT, COMPOSE_SCALE).clone();
}

function findLodLevel(tree: THREE.LOD, lodName: string): THREE.Object3D | undefined {
  const levels = tree.levels as Array<{ distance: number; object: THREE.Object3D }>;
  return levels.find((level) => level.object.userData.lodName === lodName)?.object;
}

function createSpeciesBucket(
  presetKey: SeedThreePresetKey,
  slots: TreeSlot[],
  prototype: THREE.LOD,
  rng: Rng,
): SpeciesBucket {
  const groupCount = slots.length;
  const lod2 = findLodLevel(prototype, 'LOD2');
  const lod2Set: SpeciesBucket['lod2Set'] = { branches: null, cards: [] };
  if (!lod2) {
    return { preset: presetKey, slots, lod2Set };
  }

  for (const child of lod2.children) {
    const instancedChild = child as THREE.InstancedMesh;
    if (child.type === 'Mesh' && !instancedChild.isInstancedMesh) {
      const mesh = child as THREE.Mesh;
      const geo = mesh.geometry.clone();
      geo.userData.forestClone = true;
      geo.setAttribute('aWindVec', new THREE.InstancedBufferAttribute(new Float32Array(groupCount * 3), 3));
      geo.setAttribute('aAnchorPos', new THREE.InstancedBufferAttribute(new Float32Array(groupCount * 3), 3));
      const im = new THREE.InstancedMesh(geo, forestBarkMaterial(mesh.material as THREE.Material), groupCount);
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      lod2Set.branches = im;
    } else if ((child as THREE.Group).isGroup) {
      for (const cardsMesh of (child as THREE.Group).children) {
        const instanced = cardsMesh as THREE.InstancedMesh;
        if (!instanced.isInstancedMesh) continue;
        const cardsPerTree = instanced.count;
        const total = cardsPerTree * groupCount;
        const geo = instanced.geometry.clone();
        geo.userData.forestClone = true;
        const thickness = new Float32Array(total);
        for (let t = 0; t < total; t++) thickness[t] = 0.4 + 0.6 * rng.next();
        geo.setAttribute('aThickness', new THREE.InstancedBufferAttribute(thickness, 1));
        geo.setAttribute('aTreeOrigin', new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3));
        geo.setAttribute('aWindVec', new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3));
        geo.setAttribute('aAnchorPos', new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3));

        const rebuilt = new Set(['aThickness', 'aTreeOrigin', 'aWindVec', 'aAnchorPos']);
        for (const [name, attr] of Object.entries(instanced.geometry.attributes)) {
          const instancedAttr = attr as THREE.InstancedBufferAttribute;
          if (!instancedAttr.isInstancedBufferAttribute || rebuilt.has(name)) continue;
          const arr = new Float32Array(total * instancedAttr.itemSize);
          for (let slot = 0; slot < groupCount; slot++) {
            arr.set(
              instancedAttr.array.subarray(0, cardsPerTree * instancedAttr.itemSize),
              slot * cardsPerTree * instancedAttr.itemSize,
            );
          }
          geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, instancedAttr.itemSize));
        }

        const fmat = instanced.userData.shareMaterial
          ? instanced.material
          : forestCardMaterial(instanced.material as THREE.Material);
        const im = new THREE.InstancedMesh(geo, fmat as THREE.Material, total) as THREE.InstancedMesh & {
          userData: Record<string, unknown>;
        };
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.userData.src = instanced;
        im.userData.k = cardsPerTree;

        const snap = new Float32Array(cardsPerTree * 16);
        const cardMatrix = new THREE.Matrix4();
        for (let j = 0; j < cardsPerTree; j++) {
          instanced.getMatrixAt(j, cardMatrix);
          snap.set(cardMatrix.elements, j * 16);
        }
        im.userData.srcMatrices = snap;
        im.userData.weights = (instanced.userData.windWeights as Float32Array | undefined)?.slice() ?? null;
        lod2Set.cards.push(im);
      }
    }
  }

  writeBucketMatrices(lod2Set, slots);
  return { preset: presetKey, slots, lod2Set };
}

function writeBucketMatrices(lod2Set: SpeciesBucket['lod2Set'], slots: TreeSlot[]): void {
  if (lod2Set.branches) {
    const windVec = lod2Set.branches.geometry.attributes.aWindVec as THREE.InstancedBufferAttribute;
    const anchorPos = lod2Set.branches.geometry.attributes.aAnchorPos as THREE.InstancedBufferAttribute;
    slots.forEach((slot, slotIndex) => {
      lod2Set.branches!.setMatrixAt(slotIndex, slot.visibleMatrix);
      windVec.setXYZ(slotIndex, 0, 1, 0);
      anchorPos.setXYZ(slotIndex, slot.pos.x, slot.pos.y, slot.pos.z);
    });
    lod2Set.branches.instanceMatrix.needsUpdate = true;
    windVec.needsUpdate = true;
    anchorPos.needsUpdate = true;
  }

  const slotMatrix = new THREE.Matrix4();
  const cardMatrix = new THREE.Matrix4();
  const outMatrix = new THREE.Matrix4();
  for (const im of lod2Set.cards) {
    const k = im.userData.k as number;
    const srcMatrices = im.userData.srcMatrices as Float32Array;
    const weights = im.userData.weights as Float32Array | null;
    const treeOrigin = im.geometry.attributes.aTreeOrigin as THREE.InstancedBufferAttribute;
    const windVec = im.geometry.attributes.aWindVec as THREE.InstancedBufferAttribute;
    const anchorPos = im.geometry.attributes.aAnchorPos as THREE.InstancedBufferAttribute;
    let writeIndex = 0;
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex];
      slotMatrix.copy(slot.visibleMatrix);
      for (let cardIndex = 0; cardIndex < k; cardIndex++) {
        cardMatrix.fromArray(srcMatrices, cardIndex * 16);
        outMatrix.multiplyMatrices(slotMatrix, cardMatrix);
        im.setMatrixAt(writeIndex, outMatrix);
        treeOrigin.setXYZ(writeIndex, slot.pos.x, slot.pos.y, slot.pos.z);
        const weight = weights?.[cardIndex] ?? 0.5;
        windVec.setXYZ(writeIndex, 0, weight, 0);
        anchorPos.setXYZ(writeIndex, slot.pos.x, slot.pos.y, slot.pos.z);
        writeIndex++;
      }
    }
    im.instanceMatrix.needsUpdate = true;
    treeOrigin.needsUpdate = true;
    windVec.needsUpdate = true;
    anchorPos.needsUpdate = true;
  }
}

export async function createSeedThreeForest(
  placements: ForestTreePlacement[],
  terrain: Terrain,
  maxAnisotropy: number,
  treeSeed: number,
): Promise<SeedThreeForestInstances> {
  const rng = new Rng(`gorski-kotar:${treeSeed}`);
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const group = new THREE.Group();
  group.name = 'SeedThree Gorski Kotar forest';

  const assetsByPreset = new Map<SeedThreePresetKey, SeedThreeSpeciesAssets>();
  const prototypeByPreset = new Map<SeedThreePresetKey, THREE.LOD>();

  for (const presetKey of GORSKI_KOTAR_PRESETS) {
    const species = GORSKI_KOTAR_SPECIES[presetKey];
    if (!species) continue;
    const assets = await loadSeedThreeSpeciesAssets(species, maxAnisotropy);
    assetsByPreset.set(presetKey, assets);
    const { group: prototype } = buildTree(species, `prototype:${presetKey}`, assets, FOREST_LOD_OPTS);
    prototypeByPreset.set(presetKey, prototype as THREE.LOD);
  }

  const placementsByPreset = new Map<SeedThreePresetKey, TreeSlot[]>();
  const slotByLayoutIndex: Array<{ bucketIndex: number; slotIndex: number } | null> = Array.from(
    { length: placements.length },
    () => null,
  );

  placements.forEach((placement, layoutIndex) => {
    const preset = resolveSeedThreePreset(placement.species);
    const scale = seedThreeScaleForPreset(preset, placement.scale);
    const rootY = terrain.getHeightAt(placement.x, placement.z);
    const rotY = rng.range(0, Math.PI * 2);
    const matrix = composeTreeMatrix(placement.x, rootY - 0.15 * scale, placement.z, rotY, scale);
    const slot: TreeSlot = {
      layoutIndex,
      matrix,
      pos: new THREE.Vector3(placement.x, rootY, placement.z),
      visibleMatrix: matrix.clone(),
    };
    const bucket = placementsByPreset.get(preset) ?? [];
    bucket.push(slot);
    placementsByPreset.set(preset, bucket);
  });

  const buckets: SpeciesBucket[] = [];

  for (const presetKey of GORSKI_KOTAR_PRESETS) {
    const slots = placementsByPreset.get(presetKey);
    if (!slots?.length) continue;
    const prototype = prototypeByPreset.get(presetKey);
    if (!prototype) continue;

    const bucketIndex = buckets.length;
    slots.forEach((slot, slotIndex) => {
      slotByLayoutIndex[slot.layoutIndex] = { bucketIndex, slotIndex };
    });

    buckets.push(createSpeciesBucket(presetKey, slots, prototype, new Rng(`bucket:${presetKey}:${treeSeed}`)));
  }

  for (const bucket of buckets) {
    if (bucket.lod2Set.branches) group.add(bucket.lod2Set.branches);
    for (const cardMesh of bucket.lod2Set.cards) group.add(cardMesh);
  }

  return {
    group,
    placements,
    buckets,
    slotByLayoutIndex,
    hiddenMatrix,
  };
}

export function setSeedThreeTreeVisible(
  forest: SeedThreeForestInstances,
  layoutIndex: number,
  visible: boolean,
): void {
  const mapping = forest.slotByLayoutIndex[layoutIndex];
  if (!mapping) return;
  const bucket = forest.buckets[mapping.bucketIndex];
  if (!bucket) return;
  const slot = bucket.slots[mapping.slotIndex];
  if (!slot) return;
  slot.visibleMatrix = visible ? slot.matrix : forest.hiddenMatrix;
}

export function commitSeedThreeForestMatrices(forest: SeedThreeForestInstances): void {
  for (const bucket of forest.buckets) {
    writeBucketMatrices(bucket.lod2Set, bucket.slots);
  }
}

export function setSeedThreeForestShadows(forest: SeedThreeForestInstances, enabled: boolean): void {
  forest.group.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = enabled;
  });
}

export function disposeSeedThreeForest(forest: SeedThreeForestInstances): void {
  forest.group.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh) return;
    if (mesh.geometry.userData.forestClone) mesh.geometry.dispose();
    mesh.dispose();
  });
}

export function createSeedThreeForestController(forest: SeedThreeForestInstances): SeedThreeForestController {
  return {
    hideTree: (layoutIndex) => setSeedThreeTreeVisible(forest, layoutIndex, false),
    showTree: (layoutIndex) => setSeedThreeTreeVisible(forest, layoutIndex, true),
    commit: () => commitSeedThreeForestMatrices(forest),
    setShadows: (enabled) => setSeedThreeForestShadows(forest, enabled),
    dispose: () => disposeSeedThreeForest(forest),
  };
}
