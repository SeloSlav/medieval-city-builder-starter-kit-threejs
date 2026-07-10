import * as THREE from 'three';
import type { MossyRockTextureSet } from '../utils/propTextureLoad.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import { createRockShadowGeometry } from '../props/ForestProps.ts';
import { TREE_SHADOW_CAST_LAYER } from '../scene/SceneLayers.ts';
import type { QuarryLayout, QuarrySite } from './QuarryLayout.ts';
import type { RockObstacle } from '../utils/pathGeometry.ts';

const TAU = Math.PI * 2;

export type QuarrySystem = {
  layout: QuarryLayout;
  group: THREE.Group;
  rockPlacements: ReadonlyArray<RockObstacle>;
  isBlockedAt: (x: number, z: number) => boolean;
  isGrassBlockedAt: (x: number, z: number) => boolean;
  dispose: () => void;
};

export function createQuarrySystem(
  terrain: Terrain,
  layout: QuarryLayout,
  rockTextures: MossyRockTextureSet,
): QuarrySystem {
  const group = new THREE.Group();
  group.name = 'Rock quarries';

  const rockMaterial = createQuarryRockMaterial(rockTextures);
  const shadowMaterials = createPropShadowMaterials();
  const rng = mulberry32(0x71a2e0d ^ 0x5151);
  const placements = createQuarryRockPlacements(layout, rng);
  const rocksGroup = createQuarryRockMeshes(terrain, placements, rockMaterial, shadowMaterials, rng);
  group.add(rocksGroup);

  const dispose = () => {
    rockMaterial.dispose();
    rockMaterial.map?.dispose();
    rockMaterial.normalMap?.dispose();
    rockMaterial.roughnessMap?.dispose();
    shadowMaterials.shadowCast.dispose();
    shadowMaterials.shadowDepth.dispose();
  };

  return {
    layout,
    group,
    rockPlacements: placements,
    isBlockedAt: (x, z) => layout.isBlockedForProps(x, z),
    isGrassBlockedAt: (x, z) => layout.isBlockedForGrass(x, z),
    dispose,
  };
}

type StonePlacement = RockObstacle;

function createQuarryRockPlacements(layout: QuarryLayout, rng: () => number): StonePlacement[] {
  const placements: StonePlacement[] = [];
  for (const site of layout.sites) {
    createSiteRockPlacements(site, placements, rng);
  }
  return placements;
}

function createSiteRockPlacements(site: QuarrySite, placements: StonePlacement[], rng: () => number): void {
  const targetCount =
    site.kind === 'large'
      ? 42 + Math.floor(rng() * 18)
      : 16 + Math.floor(rng() * 10);
  const startCount = placements.length;
  let attempts = 0;

  while (placements.length < startCount + targetCount && attempts < targetCount * 28) {
    attempts++;
    const angle = rng() * TAU;
    const radialT = Math.pow(rng(), site.kind === 'large' ? 0.72 : 0.82);
    const localX = Math.cos(angle) * site.radiusX * radialT * (0.82 + rng() * 0.36);
    const localZ = Math.sin(angle) * site.radiusZ * radialT * (0.82 + rng() * 0.36);
    const cos = Math.cos(site.rotation);
    const sin = Math.sin(site.rotation);
    const x = site.x + localX * cos - localZ * sin;
    const z = site.z + localX * sin + localZ * cos;

    const edgeBias = radialT;
    const rimChance = site.kind === 'large' ? edgeBias > 0.72 : edgeBias > 0.58;
    if (!rimChance && rng() < 0.42) continue;

    const scale =
      site.kind === 'large'
        ? THREE.MathUtils.lerp(0.55, 2.6, Math.pow(rng(), 1.35))
        : THREE.MathUtils.lerp(0.42, 1.8, Math.pow(rng(), 1.42));
    if (!hasMinimumRockDistance(placements, x, z, 1.8 + scale * 0.95)) continue;

    placements.push({ x, z, scale });
  }
}

function createQuarryRockMeshes(
  terrain: Terrain,
  placements: StonePlacement[],
  material: THREE.Material,
  shadowMaterials: { shadowCast: THREE.MeshStandardMaterial; shadowDepth: THREE.MeshDepthMaterial },
  rng: () => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Quarry boulder piles';
  if (placements.length === 0) return group;

  const variants = [createBoulderGeometry(2.1), createBoulderGeometry(8.4), createBoulderGeometry(15.7)];
  const shadowGeometry = createRockShadowGeometry();
  const buckets = variants.map(() => [] as StonePlacement[]);
  placements.forEach((placement, index) => buckets[index % buckets.length].push(placement));

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();

  buckets.forEach((bucket, variantIndex) => {
    if (bucket.length === 0) return;
    const mesh = new THREE.InstancedMesh(variants[variantIndex], material, bucket.length);
    mesh.name = `Quarry boulders ${variantIndex + 1}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const shadowMesh = new THREE.InstancedMesh(shadowGeometry, shadowMaterials.shadowCast, bucket.length);
    shadowMesh.name = `Quarry boulder shadows ${variantIndex + 1}`;
    shadowMesh.layers.set(TREE_SHADOW_CAST_LAYER);
    shadowMesh.castShadow = true;
    shadowMesh.receiveShadow = false;
    shadowMesh.customDepthMaterial = shadowMaterials.shadowDepth;

    bucket.forEach((rock, rockIndex) => {
      const y = terrain.getHeightAt(rock.x, rock.z);
      position.set(rock.x, y + rock.scale * 0.16, rock.z);
      quaternion.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.24, rng() * TAU, (rng() - 0.5) * 0.24));
      scaleVector.set(
        rock.scale * (0.96 + rng() * 0.62),
        rock.scale * (0.42 + rng() * 0.28),
        rock.scale * (0.86 + rng() * 0.52),
      );
      matrix.compose(position, quaternion, scaleVector);
      mesh.setMatrixAt(rockIndex, matrix);
      shadowMesh.setMatrixAt(rockIndex, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
    group.add(mesh, shadowMesh);
  });

  return group;
}

function createQuarryRockMaterial(rockTextures: MossyRockTextureSet): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: rockTextures.map,
    normalMap: rockTextures.normalMap,
    roughnessMap: rockTextures.roughnessMap,
    color: 0xb0aea0,
    roughness: 0.92,
    metalness: 0,
  });
  material.normalScale.set(0.55, 0.55);
  return material;
}

function createPropShadowMaterials(): {
  shadowCast: THREE.MeshStandardMaterial;
  shadowDepth: THREE.MeshDepthMaterial;
} {
  return {
    shadowCast: new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
    }),
    shadowDepth: new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    }),
  };
}

function createBoulderGeometry(seed: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uvs: number[] = [];
  const point = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).normalize();
    const ridge =
      0.8 +
      stableSurfaceNoise(point, seed) * 0.32 +
      Math.sin(point.x * 6.8 + point.z * 3.9 + seed) * 0.07;
    point.multiplyScalar(ridge);
    point.y *= 0.48 + stableSurfaceNoise(point, seed + 4.1) * 0.18;
    if (point.y < -0.24) point.y = THREE.MathUtils.lerp(point.y, -0.28, 0.62);
    position.setXYZ(i, point.x, point.y, point.z);
    uvs.push(Math.atan2(point.z, point.x) / TAU + 0.5, point.y * 0.42 + 0.5);
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function hasMinimumRockDistance(
  placements: StonePlacement[],
  x: number,
  z: number,
  minDistance: number,
): boolean {
  const minDistanceSq = minDistance * minDistance;
  for (const placement of placements) {
    const dx = x - placement.x;
    const dz = z - placement.z;
    if (dx * dx + dz * dz < minDistanceSq) return false;
  }
  return true;
}

function stableSurfaceNoise(point: THREE.Vector3, seed: number): number {
  const value = Math.sin(point.x * 127.1 + point.y * 311.7 + point.z * 74.7 + seed * 19.19) * 43758.5453123;
  return value - Math.floor(value);
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
