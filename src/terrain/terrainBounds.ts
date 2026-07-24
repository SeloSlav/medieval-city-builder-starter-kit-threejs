import type { TerrainBounds } from './Terrain.ts';

export function fullTerrainBounds(size: number): TerrainBounds {
  const half = size * 0.5;
  return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}
