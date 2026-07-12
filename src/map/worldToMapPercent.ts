import type { RiverField } from '../rivers/RiverField.ts';
import type { TerrainBounds } from '../terrain/Terrain.ts';

export function riverFieldBounds(riverField: RiverField): TerrainBounds {
  return {
    minX: riverField.startX,
    maxX: riverField.startX + riverField.spanX,
    minZ: riverField.startZ,
    maxZ: riverField.startZ + riverField.spanZ,
  };
}

export function worldToMapPercent(
  x: number,
  z: number,
  bounds: TerrainBounds,
): { x: number; y: number } {
  return {
    x: ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100,
    y: ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * 100,
  };
}
