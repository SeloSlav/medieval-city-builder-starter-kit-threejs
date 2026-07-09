/** Matches CameraController default orbit distance at 100% zoom. */
export const BASELINE_CAMERA_DISTANCE = 88;

/** Full dirt ground at this zoom and beyond (zooming in). */
export const DIRT_REVEAL_ZOOM_PERCENT = 400;

/** Full meadow terrain at this zoom and below (zooming out). */
export const DIRT_FADE_END_ZOOM_PERCENT = 100;

/** Pow easing on the dirt↔meadow blend (< 1 = dirt appears more gradually). */
export const DIRT_BLEND_EASE = 0.72;

export const TERRAIN_DIRT_CLOSE_DISTANCE =
  BASELINE_CAMERA_DISTANCE / (DIRT_REVEAL_ZOOM_PERCENT / 100);

export const TERRAIN_DIRT_FAR_DISTANCE =
  BASELINE_CAMERA_DISTANCE / (DIRT_FADE_END_ZOOM_PERCENT / 100);

/** Blade tufts track the same dirt reveal band as close-zoom terrain. */
export const GRASS_BLADE_REVEAL = {
  close: TERRAIN_DIRT_CLOSE_DISTANCE,
  far: TERRAIN_DIRT_FAR_DISTANCE,
} as const;

/** Horizontal radius around the camera where blade tufts stay visible. */
export const GRASS_BLADE_NEAR_RADIUS = 46;

/** Spatial chunk size for instanced grass batches. */
export const GRASS_BLADE_CHUNK_SIZE = 32;

/** 0 = full dirt, 1 = full meadow. Shared by terrain shader and grass CPU fade. */
export function dirtMeadowBlend(cameraDistance: number): number {
  const t = smoothstep(TERRAIN_DIRT_CLOSE_DISTANCE, TERRAIN_DIRT_FAR_DISTANCE, cameraDistance);
  return Math.pow(t, DIRT_BLEND_EASE);
}

export function grassBladeRevealOpacity(cameraDistance: number): number {
  return 1 - dirtMeadowBlend(cameraDistance);
}

export function isGrassBladeZoomActive(cameraDistance: number): boolean {
  return grassBladeRevealOpacity(cameraDistance) > 0.02;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
