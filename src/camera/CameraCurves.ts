import * as THREE from 'three';

/**
 * Close-zoom ground-eye rig tuning. The normal camera uses the classic
 * distance/pitch orbit; these constants only apply once zoomed in past
 * CLOSE_BLEND_START_DISTANCE.
 */

/** Orbit distance below which the ground-eye rig begins blending in. */
export const CLOSE_BLEND_START_DISTANCE = 32;

export const CLOSE_BACK_DISTANCE = 13;
export const CLOSE_HEIGHT_ABOVE_TERRAIN = 4;
export const CLOSE_LOOK_AHEAD = 12;
export const CLOSE_LOOK_HEIGHT_OFFSET = 0.35;
export const CLOSE_PAN_SPEED_SCALE = 0.22;
export const CLOSE_FOV = 48;
export const DEFAULT_FOV = 54;

/** Minimum clearance between camera and sampled terrain height. */
export const MIN_CAMERA_TERRAIN_CLEARANCE = 1.8;

function smoothstep01(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** 0 = classic orbit, 1 = full ground-eye rig. */
export function evalCloseBlendFromDistance(distance: number, minDistance: number): number {
  const start = CLOSE_BLEND_START_DISTANCE;
  const end = minDistance;
  if (distance >= start) return 0;
  if (end >= start) return 1;
  return smoothstep01((start - distance) / (start - end));
}
