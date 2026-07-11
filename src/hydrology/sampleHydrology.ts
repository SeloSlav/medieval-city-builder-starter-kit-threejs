import type { RiverField } from '../rivers/RiverField.ts';

const SHORE_DECAY_METERS = 32;
const VALLEY_DEPTH_SCALE = 1.85;

/** 0–1 score for well yield: rivers, valleys, and near-shore moisture. */
export function sampleHydrologyScore(riverField: RiverField, x: number, z: number): number {
  if (riverField.isRenderedWetAt(x, z)) {
    return 1;
  }

  const riverMask = riverField.sampleConnectedMask(x, z);
  const shoreDistance = riverField.sampleShoreDistance(x, z);
  const valleyDepth = riverField.layout.getValleyDepression(x, z);

  const shoreFactor = shoreDistance <= 0
    ? 1
    : Math.exp(-shoreDistance / SHORE_DECAY_METERS);
  const valleyFactor = Math.min(1, valleyDepth / VALLEY_DEPTH_SCALE);
  const riverFactor = riverMask;

  return clamp01(riverFactor * 0.34 + shoreFactor * 0.42 + valleyFactor * 0.24);
}

/** Map display score — emphasizes visible rivers and near-shore moisture. */
export function sampleHydrologyMapScore(riverField: RiverField, x: number, z: number): number {
  if (riverField.isRenderedWetAt(x, z)) {
    return 1;
  }

  const shoreDistance = riverField.sampleShoreDistance(x, z);
  if (shoreDistance <= 0) {
    return 0.92;
  }

  const nearShore = Math.exp(-shoreDistance / 18);
  const valleyDepth = riverField.layout.getValleyDepression(x, z);
  const valleyFactor = Math.min(0.55, valleyDepth / VALLEY_DEPTH_SCALE * 0.55);

  return clamp01(nearShore * 0.78 + valleyFactor);
}

export function hydrologyGradeLabel(score: number): string {
  if (score >= 0.82) return 'Excellent';
  if (score >= 0.62) return 'Good';
  if (score >= 0.42) return 'Fair';
  if (score >= 0.22) return 'Poor';
  return 'Dry';
}

export function wellCapacityFromHydrology(baseCapacity: number, hydrologyScore: number): number {
  return baseCapacity * (0.32 + 0.68 * clamp01(hydrologyScore));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
