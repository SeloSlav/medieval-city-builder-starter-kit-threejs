import * as THREE from 'three';
import type { RiverField } from '../rivers/RiverField.ts';
import type { QuarryLayout } from '../quarries/QuarryLayout.ts';
import { sampleTerrainMeshHeight } from './TerrainMeshHeight.ts';
import type { WorldDimensions } from '../world/worldGenerationSettings.ts';
import { resolveWorldDimensions } from '../world/worldGenerationSettings.ts';
import { DEFAULT_WORLD_GENERATION_SETTINGS } from '../world/worldGenerationSettings.ts';
import { yieldToMain } from '../utils/yieldToMain.ts';
import { fullTerrainBounds } from './terrainBounds.ts';
import {
  buildTerrainGeometryData,
  createTerrainGeometry,
  TERRAIN_RESOLUTION,
  type TerrainGeometryData,
} from './terrainGeometryData.ts';

export type TerrainBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export class Terrain {
  readonly size: number;
  readonly playableSize: number;
  readonly resolution = TERRAIN_RESOLUTION;
  readonly bounds: TerrainBounds;
  readonly mesh: THREE.Mesh;
  private dirtZoomGateAttr!: THREE.BufferAttribute;

  static fullBounds(size = resolveWorldDimensions(DEFAULT_WORLD_GENERATION_SETTINGS.mapSize).terrainSize): TerrainBounds {
    return fullTerrainBounds(size);
  }

  static async create(
    material: THREE.Material,
    riverField?: RiverField,
    quarryLayout?: QuarryLayout,
    onProgress?: (completedRows: number, totalRows: number) => void,
    dimensions: WorldDimensions = resolveWorldDimensions(DEFAULT_WORLD_GENERATION_SETTINGS.mapSize),
  ): Promise<Terrain> {
    const data = await buildTerrainGeometryData(riverField, quarryLayout, dimensions, onProgress, yieldToMain);
    return Terrain.fromGeometryData(material, data, dimensions);
  }

  static fromGeometryData(
    material: THREE.Material,
    data: TerrainGeometryData,
    dimensions: WorldDimensions,
  ): Terrain {
    return new Terrain(material, createTerrainGeometry(data), dimensions);
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

}
