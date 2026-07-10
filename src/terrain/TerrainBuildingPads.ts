import * as THREE from 'three';
import type { BuildingTerrainLayout } from '../buildings/BuildingTerrainLayout.ts';
import type { Terrain, TerrainBounds } from './Terrain.ts';
import { sampleBaseTerrainHeight } from './TerrainHeight.ts';

let lastAppliedBounds: TerrainBounds[] = [];

export function updateTerrainBuildingPads(terrain: Terrain, layout: BuildingTerrainLayout | null): void {
  const geometry = terrain.mesh.geometry;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const currentBounds = layout?.getAffectedBounds() ?? [];
  const boundsToUpdate = mergeBounds(lastAppliedBounds, currentBounds);

  if (boundsToUpdate.length === 0) {
    lastAppliedBounds = [];
    return;
  }

  const resolution = terrain.resolution;
  const size = terrain.size;
  const step = size / (resolution - 1);
  const half = size * 0.5;

  let globalMinX = resolution - 1;
  let globalMaxX = 0;
  let globalMinZ = resolution - 1;
  let globalMaxZ = 0;

  for (const bounds of boundsToUpdate) {
    const minXIndex = Math.max(0, Math.floor((bounds.minX + half) / step));
    const maxXIndex = Math.min(resolution - 1, Math.ceil((bounds.maxX + half) / step));
    const minZIndex = Math.max(0, Math.floor((bounds.minZ + half) / step));
    const maxZIndex = Math.min(resolution - 1, Math.ceil((bounds.maxZ + half) / step));

    globalMinX = Math.min(globalMinX, minXIndex);
    globalMaxX = Math.max(globalMaxX, maxXIndex);
    globalMinZ = Math.min(globalMinZ, minZIndex);
    globalMaxZ = Math.max(globalMaxZ, maxZIndex);

    for (let zIndex = minZIndex; zIndex <= maxZIndex; zIndex++) {
      const rowOffset = zIndex * resolution;
      for (let xIndex = minXIndex; xIndex <= maxXIndex; xIndex++) {
        const vertexIndex = rowOffset + xIndex;
        const positionOffset = vertexIndex * 3;
        const x = positions.array[positionOffset] as number;
        const z = positions.array[positionOffset + 2] as number;
        positions.array[positionOffset + 1] = sampleBaseTerrainHeight(x, z);
      }
    }
  }

  positions.needsUpdate = true;

  if (normals) {
    updateHeightfieldNormalsInRegion(positions, normals, resolution, step, globalMinX, globalMaxX, globalMinZ, globalMaxZ);
  }

  geometry.computeBoundingSphere();
  lastAppliedBounds = currentBounds;
}

export function resetTerrainBuildingPadHistory(): void {
  lastAppliedBounds = [];
}

function updateHeightfieldNormalsInRegion(
  positions: THREE.BufferAttribute,
  normals: THREE.BufferAttribute,
  resolution: number,
  step: number,
  minXIndex: number,
  maxXIndex: number,
  minZIndex: number,
  maxZIndex: number,
): void {
  const pos = positions.array as Float32Array;
  const norm = normals.array as Float32Array;
  const padMinX = Math.max(0, minXIndex - 1);
  const padMaxX = Math.min(resolution - 1, maxXIndex + 1);
  const padMinZ = Math.max(0, minZIndex - 1);
  const padMaxZ = Math.min(resolution - 1, maxZIndex + 1);

  for (let zIndex = padMinZ; zIndex <= padMaxZ; zIndex++) {
    for (let xIndex = padMinX; xIndex <= padMaxX; xIndex++) {
      const vertexIndex = zIndex * resolution + xIndex;
      const normalOffset = vertexIndex * 3;

      const yLeft = pos[((zIndex * resolution) + Math.max(0, xIndex - 1)) * 3 + 1];
      const yRight = pos[((zIndex * resolution) + Math.min(resolution - 1, xIndex + 1)) * 3 + 1];
      const yDown = pos[(Math.max(0, zIndex - 1) * resolution + xIndex) * 3 + 1];
      const yUp = pos[(Math.min(resolution - 1, zIndex + 1) * resolution + xIndex) * 3 + 1];

      const dx = (yRight - yLeft) / (2 * step);
      const dz = (yUp - yDown) / (2 * step);
      const invLength = 1 / Math.hypot(dx, 1, dz);

      norm[normalOffset] = -dx * invLength;
      norm[normalOffset + 1] = invLength;
      norm[normalOffset + 2] = -dz * invLength;
    }
  }

  normals.needsUpdate = true;
}

function mergeBounds(previous: TerrainBounds[], current: TerrainBounds[]): TerrainBounds[] {
  const merged = [...previous];
  for (const bounds of current) {
    if (!merged.some((entry) => boundsEqual(entry, bounds))) {
      merged.push(bounds);
    }
  }
  return merged;
}

function boundsEqual(a: TerrainBounds, b: TerrainBounds): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minZ === b.minZ && a.maxZ === b.maxZ;
}
