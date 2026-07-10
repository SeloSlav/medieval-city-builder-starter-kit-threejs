import type { TerrainBounds } from '../terrain/Terrain.ts';
import type { RiverLayout } from '../rivers/RiverLayout.ts';
import { hashF64 } from '../rivers/riverHash.ts';
import { CENTRAL_CLEARING_RADIUS, hasMinimumDistance, mulberry32 } from '../props/forestField.ts';

export type QuarryKind = 'large' | 'small';

export type QuarrySite = {
  x: number;
  z: number;
  rotation: number;
  kind: QuarryKind;
  radiusX: number;
  radiusZ: number;
  pitDepth: number;
};

export type QuarryLayoutOptions = {
  bounds: TerrainBounds;
  seed?: number;
  riverLayout?: RiverLayout;
  playableHalf?: number;
};

const MIN_LARGE_QUARRY_SPACING = 110;
const MIN_SMALL_QUARRY_SPACING = 72;
const RIVER_AVOIDANCE_MASK = 0.22;
const DRAIN_AVOIDANCE_RADIUS = 130;

export class QuarryLayout {
  readonly sites: QuarrySite[];
  readonly seed: number;

  private constructor(seed: number, sites: QuarrySite[]) {
    this.seed = seed;
    this.sites = sites;
  }

  static create(options: QuarryLayoutOptions): QuarryLayout {
    const seed = options.seed ?? 0x71a2e0d;
    const playableHalf = options.playableHalf ?? 410;
    const riverLayout = options.riverLayout;
    const rng = mulberry32(seed);
    const sites: QuarrySite[] = [];

    const largeSite = pickQuarrySite(rng, seed, playableHalf, riverLayout, sites, 'large');
    if (largeSite) sites.push(largeSite);

    for (let i = 0; i < 2; i++) {
      const smallSite = pickQuarrySite(rng, seed ^ (i + 3) * 0x5151, playableHalf, riverLayout, sites, 'small');
      if (smallSite) sites.push(smallSite);
    }

    return new QuarryLayout(seed, sites);
  }

  getPitDepression(x: number, z: number): number {
    let depression = 0;
    for (const site of this.sites) {
      const blend = sampleSiteBlend(x, z, site, 0.08, 1.02);
      if (blend <= 0) continue;
      const bowl = blend * blend * site.pitDepth;
      depression = Math.max(depression, bowl);
    }
    return depression;
  }

  getPadBlend(x: number, z: number): number {
    let blend = 0;
    for (const site of this.sites) {
      const inner = site.kind === 'large' ? 0.12 : 0.18;
      const outer = site.kind === 'large' ? 1.08 : 1.02;
      blend = Math.max(blend, sampleSiteBlend(x, z, site, inner, outer));
    }
    return blend;
  }

  isBlockedForProps(x: number, z: number): boolean {
    for (const site of this.sites) {
      const margin = site.kind === 'large' ? 1.06 : 1.04;
      if (sampleSiteBlend(x, z, site, 0, margin) >= 0.42) return true;
    }
    return false;
  }

  isBlockedForGrass(x: number, z: number): boolean {
    for (const site of this.sites) {
      const margin = site.kind === 'large' ? 1.12 : 1.06;
      if (sampleSiteBlend(x, z, site, 0, margin) >= 0.28) return true;
    }
    return false;
  }
}

function pickQuarrySite(
  rng: () => number,
  seed: number,
  playableHalf: number,
  riverLayout: RiverLayout | undefined,
  existing: QuarrySite[],
  kind: QuarryKind,
): QuarrySite | null {
  const margin = playableHalf * 0.08;
  const maxAttempts = kind === 'large' ? 280 : 220;
  const minSpacing = kind === 'large' ? MIN_LARGE_QUARRY_SPACING : MIN_SMALL_QUARRY_SPACING;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = (rng() * 2 - 1) * (playableHalf - margin);
    const z = (rng() * 2 - 1) * (playableHalf - margin);
    if (Math.hypot(x, z) < CENTRAL_CLEARING_RADIUS + 48) continue;
    if (Math.hypot(x, z + 88) < DRAIN_AVOIDANCE_RADIUS) continue;
    if (riverLayout && riverLayout.sampleRiverMask(x, z) > RIVER_AVOIDANCE_MASK) continue;
    if (!hasMinimumDistance(existing, x, z, minSpacing)) continue;

    const suitability = quarrySuitabilityAt(x, z, playableHalf);
    if (suitability < 0.34 || rng() > suitability * 0.94) continue;

    const rotation = hashF64(seed, attempt, kind === 'large' ? 1 : 2) * Math.PI;
    if (kind === 'large') {
      return {
        x,
        z,
        rotation,
        kind,
        radiusX: lerp(24, 32, hashF64(seed, attempt, 3)),
        radiusZ: lerp(18, 26, hashF64(seed, attempt, 4)),
        pitDepth: lerp(5.4, 7.2, hashF64(seed, attempt, 5)),
      };
    }

    return {
      x,
      z,
      rotation,
      kind,
      radiusX: lerp(11, 15, hashF64(seed, attempt, 3)),
      radiusZ: lerp(9, 13, hashF64(seed, attempt, 4)),
      pitDepth: lerp(1.1, 2.4, hashF64(seed, attempt, 5)),
    };
  }

  return createFallbackSite(existing, kind, seed);
}

function createFallbackSite(existing: QuarrySite[], kind: QuarryKind, seed: number): QuarrySite {
  const presets: Array<{ x: number; z: number; rotation: number }> =
    kind === 'large'
      ? [
          { x: 168, z: 142, rotation: 0.42 },
          { x: -182, z: 96, rotation: 1.18 },
          { x: 124, z: -176, rotation: 2.04 },
        ]
      : [
          { x: -148, z: -118, rotation: 0.86 },
          { x: 196, z: -64, rotation: 1.62 },
          { x: -96, z: 184, rotation: 2.38 },
        ];

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    const minSpacing = kind === 'large' ? MIN_LARGE_QUARRY_SPACING : MIN_SMALL_QUARRY_SPACING;
    if (!hasMinimumDistance(existing, preset.x, preset.z, minSpacing)) continue;
    if (kind === 'large') {
      return {
        ...preset,
        kind,
        radiusX: 28,
        radiusZ: 22,
        pitDepth: 6.4,
      };
    }
    return {
      ...preset,
      kind,
      radiusX: 13,
      radiusZ: 11,
      pitDepth: 1.8,
    };
  }

  const offset = hashF64(seed, existing.length, kind === 'large' ? 9 : 10) * 80 - 40;
  if (kind === 'large') {
    return {
      x: 150 + offset,
      z: 130 - offset * 0.4,
      rotation: 0.5,
      kind,
      radiusX: 28,
      radiusZ: 22,
      pitDepth: 6.4,
    };
  }
  return {
    x: -140 - offset,
    z: -110 + offset * 0.35,
    rotation: 1.1,
    kind,
    radiusX: 13,
    radiusZ: 11,
    pitDepth: 1.8,
  };
}

function quarrySuitabilityAt(x: number, z: number, playableHalf: number): number {
  const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
  const ridgeBias = smoothstep(playableHalf * 0.34, playableHalf * 0.78, edgeDistance) * 0.28;
  const stoneNoise = valueNoise2(x * 0.016 + 24.6, z * 0.016 - 11.3);
  const openGround = 1 - smoothstep(0.68, 0.96, valueNoise2(x * 0.008 + 5.2, z * 0.008 - 8.4));
  return saturate(ridgeBias + stoneNoise * 0.46 + openGround * 0.18);
}

function sampleSiteBlend(
  x: number,
  z: number,
  site: QuarrySite,
  innerFade: number,
  outerFade: number,
): number {
  const dx = x - site.x;
  const dz = z - site.z;
  const cos = Math.cos(site.rotation);
  const sin = Math.sin(site.rotation);
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  const normDist = Math.hypot(localX / site.radiusX, localZ / site.radiusZ);
  return 1 - smoothstep(innerFade, outerFade, normDist);
}

function valueNoise2(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hashGrid2(x0, z0);
  const b = hashGrid2(x0 + 1, z0);
  const c = hashGrid2(x0, z0 + 1);
  const d = hashGrid2(x0 + 1, z0 + 1);
  const x0Lerp = a + (b - a) * sx;
  const x1Lerp = c + (d - c) * sx;
  return x0Lerp + (x1Lerp - x0Lerp) * sz;
}

function hashGrid2(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = saturate((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function saturate(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
