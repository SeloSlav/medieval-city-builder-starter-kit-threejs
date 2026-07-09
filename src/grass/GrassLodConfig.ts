import { uniform } from 'three/tsl';
import {
  DIRT_BLEND_EASE,
  TERRAIN_DIRT_CLOSE_DISTANCE,
  TERRAIN_DIRT_FAR_DISTANCE,
} from './grassLodMath.ts';

/** Orbit distance — shared by terrain dirt crossfade and grass visibility. */
export const grassCameraDistance = uniform(88);

/** Close zoom swaps terrain from meadow blend to exposed dirt underneath grass. */
export const TERRAIN_DIRT_LOD = {
  close: TERRAIN_DIRT_CLOSE_DISTANCE,
  far: TERRAIN_DIRT_FAR_DISTANCE,
  ease: DIRT_BLEND_EASE,
} as const;

export function updateGrassCameraDistance(distance: number): void {
  grassCameraDistance.value = distance;
}

export {
  GRASS_BLADE_CHUNK_SIZE,
  GRASS_BLADE_NEAR_RADIUS,
  GRASS_BLADE_REVEAL,
  grassBladeRevealOpacity,
  isGrassBladeZoomActive,
} from './grassLodMath.ts';
