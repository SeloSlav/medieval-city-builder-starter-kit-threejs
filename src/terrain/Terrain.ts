import * as THREE from 'three';
import type { RiverField } from '../rivers/RiverField.ts';
import type { QuarryLayout } from '../quarries/QuarryLayout.ts';
import { sampleBaseTerrainHeight } from './TerrainHeight.ts';
import { sampleTerrainMeshHeight } from './TerrainMeshHeight.ts';
import type { WorldDimensions } from '../world/worldGenerationSettings.ts';
import { resolveWorldDimensions } from '../world/worldGenerationSettings.ts';
import { DEFAULT_WORLD_GENERATION_SETTINGS } from '../world/worldGenerationSettings.ts';
import { sampleTerrainBlendWeights, sampleTerrainUv } from './TerrainBlendWeights.ts';
import { yieldToMain } from '../utils/yieldToMain.ts';

export type TerrainBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const TERRAIN_ROWS_PER_YIELD = 40;

export class Terrain {
  readonly size: number;
  readonly playableSize: number;
  readonly resolution = 769;
  readonly bounds: TerrainBounds;
  readonly mesh: THREE.Mesh;
  private dirtZoomGateAttr!: THREE.BufferAttribute;

  static fullBounds(size = resolveWorldDimensions(DEFAULT_WORLD_GENERATION_SETTINGS.mapSize).terrainSize): TerrainBounds {
    const half = size * 0.5;
    return { minX: -half, maxX: half, minZ: -half, maxZ: half };
  }

  static async create(
    material: THREE.Material,
    riverField?: RiverField,
    quarryLayout?: QuarryLayout,
    onProgress?: (completedRows: number, totalRows: number) => void,
    dimensions: WorldDimensions = resolveWorldDimensions(DEFAULT_WORLD_GENERATION_SETTINGS.mapSize),
  ): Promise<Terrain> {
    const geometry = await Terrain.buildGeometryAsync(riverField, quarryLayout, dimensions, onProgress);
    return new Terrain(material, geometry, dimensions);
  }

  private constructor(material: THREE.Material, geometry: THREE.BufferGeometry, dimensions: WorldDimensions) {
    this.size = dimensions.terrainSize;
    this.playableSize = dimensions.playableSize;
    const half = this.playableSize * 0.5;
    this.bounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
    this.dirtZoomGateAttr = geometry.getAttribute('dirtZoomGate') as THREE.BufferAttribute;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Continuous terrain heightfield';
    this.mesh.receiveShadow = true;
    this.mesh.userData.terrain = true;
  }

  getHeightAt(x: number, z: number): number {
    return sampleTerrainMeshHeight(this.mesh.geometry, x, z, this.resolution, this.size);
  }

  getPointAt(x: number, z: number, offset = 0): THREE.Vector3 {
    return new THREE.Vector3(x, this.getHeightAt(x, z) + offset, z);
  }

  getPointAtInto(x: number, z: number, target: THREE.Vector3, offset = 0): THREE.Vector3 {
    return target.set(x, this.getHeightAt(x, z) + offset, z);
  }

  clampXZ(x: number, z: number): { x: number; z: number } {
    return {
      x: THREE.MathUtils.clamp(x, this.bounds.minX, this.bounds.maxX),
      z: THREE.MathUtils.clamp(z, this.bounds.minZ, this.bounds.maxZ),
    };
  }

  setDirtZoomGate(value: number): void {
    const array = this.dirtZoomGateAttr.array as Float32Array;
    array.fill(value);
    this.dirtZoomGateAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const { material } = this.mesh;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material.dispose();
    }
  }

  private static async buildGeometryAsync(
    riverField: RiverField | undefined,
    quarryLayout: QuarryLayout | undefined,
    dimensions: WorldDimensions,
    onProgress?: (completedRows: number, totalRows: number) => void,
  ): Promise<THREE.BufferGeometry> {
    const resolution = 769;
    const size = dimensions.terrainSize;
    const vertexCount = resolution * resolution;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const colors = new Float32Array(vertexCount * 3);
    const shoreBlends = new Float32Array(vertexCount);
    const roadWearBlends = new Float32Array(vertexCount);
    const quarryPadBlends = new Float32Array(vertexCount);
    const dirtZoomGates = new Float32Array(vertexCount);
    const step = size / (resolution - 1);
    const half = size * 0.5;
    for (let zIndex = 0; zIndex < resolution; zIndex++) {
      const rowOffset = zIndex * resolution;
      for (let xIndex = 0; xIndex < resolution; xIndex++) {
        const vertexIndex = rowOffset + xIndex;
        const x = -half + xIndex * step;
        const z = -half + zIndex * step;
        const positionOffset = vertexIndex * 3;
        positions[positionOffset] = x;
        positions[positionOffset + 1] = sampleBaseTerrainHeight(x, z);
        positions[positionOffset + 2] = z;

        const uv = sampleTerrainUv(x, z);
        const uvOffset = vertexIndex * 2;
        uvs[uvOffset] = uv[0];
        uvs[uvOffset + 1] = uv[1];

        const weights = sampleTerrainBlendWeights(x, z);
        const colorOffset = vertexIndex * 3;
        colors[colorOffset] = weights[0];
        colors[colorOffset + 1] = weights[1];
        colors[colorOffset + 2] = weights[2];

        shoreBlends[vertexIndex] = riverField?.sampleMudBlendAt(x, z) ?? 0;
        roadWearBlends[vertexIndex] = 0;
        quarryPadBlends[vertexIndex] = quarryLayout?.getPadBlend(x, z) ?? 0;
        dirtZoomGates[vertexIndex] = 0;
      }

      onProgress?.(zIndex + 1, resolution);
      if ((zIndex + 1) % TERRAIN_ROWS_PER_YIELD === 0) {
        await yieldToMain();
      }
    }

    const quadCount = (resolution - 1) * (resolution - 1);
    const indices = new Uint32Array(quadCount * 6);
    let indexOffset = 0;
    for (let zIndex = 0; zIndex < resolution - 1; zIndex++) {
      for (let xIndex = 0; xIndex < resolution - 1; xIndex++) {
        const a = zIndex * resolution + xIndex;
        const b = a + 1;
        const c = a + resolution;
        const d = c + 1;
        indices[indexOffset++] = a;
        indices[indexOffset++] = c;
        indices[indexOffset++] = b;
        indices[indexOffset++] = b;
        indices[indexOffset++] = c;
        indices[indexOffset++] = d;
      }
    }

    await yieldToMain();

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('shoreBlend', new THREE.BufferAttribute(shoreBlends, 1));
    geometry.setAttribute('roadWearBlend', new THREE.BufferAttribute(roadWearBlends, 1));
    geometry.setAttribute('quarryPadBlend', new THREE.BufferAttribute(quarryPadBlends, 1));
    geometry.setAttribute('dirtZoomGate', new THREE.BufferAttribute(dirtZoomGates, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
