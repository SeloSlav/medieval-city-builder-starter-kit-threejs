import type { RiverLayout } from '../rivers/RiverLayout.ts';
import type { QuarryLayout } from '../quarries/QuarryLayout.ts';

const PLAYABLE_SIZE = 820;
const TERRAIN_SIZE = 1080;

let activeRiverLayout: RiverLayout | null = null;
let activeQuarryLayout: QuarryLayout | null = null;

export function setActiveRiverLayout(layout: RiverLayout | null): void {
  activeRiverLayout = layout;
}

export function getActiveRiverLayout(): RiverLayout | null {
  return activeRiverLayout;
}

export function setActiveQuarryLayout(layout: QuarryLayout | null): void {
  activeQuarryLayout = layout;
}

export function getActiveQuarryLayout(): QuarryLayout | null {
  return activeQuarryLayout;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  const x0Lerp = a + (b - a) * sx;
  const x1Lerp = c + (d - c) * sx;
  return x0Lerp + (x1Lerp - x0Lerp) * sz;
}

function fbm(x: number, z: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * frequency, z * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / norm - 0.5;
}

function ridgedFbm(x: number, z: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = fbm(x * frequency, z * frequency, 1) + 0.5;
    const ridge = 1 - Math.abs(n * 2 - 1);
    value += ridge * ridge * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / norm;
}

function getEdgeHillFactor(x: number, z: number): number {
  const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
  const hillStart = PLAYABLE_SIZE * 0.44;
  const hillEnd = TERRAIN_SIZE * 0.5;
  return smoothstep(hillStart, hillEnd, edgeDistance);
}

function getEdgeHillHeight(x: number, z: number): number {
  const t = getEdgeHillFactor(x, z);
  if (t <= 0) return 0;

  const ridge = fbm(x * 0.0085 + 37.5, z * 0.0085 - 22.4, 5) + 0.5;
  const detail = fbm(x * 0.026 - 6.2, z * 0.026 + 9.7, 3) + 0.5;
  const shoulder = t * t * (14 + ridge * 26);
  const crest = t * t * t * t * (14 + detail * 18);
  return shoulder + crest;
}

function getMacroDrainage(x: number, z: number): number {
  const warpX = fbm(x * 0.0018 + 14.2, z * 0.0018 - 9.4, 3) * 48;
  const warpZ = fbm(x * 0.0018 - 22.6, z * 0.0018 + 11.8, 3) * 48;
  const wx = x + warpX;
  const wz = z + warpZ;
  const broadValley = fbm(wx * 0.0026 + 31.5, wz * 0.0026 - 18.7, 5);
  const uplandRidge = ridgedFbm(wx * 0.0044 - 8.2, wz * 0.0044 + 26.4, 4);
  const terrace = fbm(wx * 0.0095 + 4.1, wz * 0.0095 - 2.8, 3);
  return broadValley * 7.8 - uplandRidge * 5.4 + terrace * 1.6;
}

export function sampleRawTerrainHeight(x: number, z: number): number {
  const layout = activeRiverLayout;
  const basinX = layout?.drain.x ?? 0;
  const basinZ = layout?.drain.z ?? -88;
  const n1 = fbm(x * 0.014, z * 0.014, 4) * 5.6;
  const n2 = fbm(x * 0.04 + 18.4, z * 0.04 - 9.2, 3) * 1.2;
  const broad = Math.sin(x * 0.012 + z * 0.005) * 1.35 + Math.cos(z * 0.011) * 1.0;
  const basin = -Math.exp(-((x - basinX) * (x - basinX) + (z - basinZ) * (z - basinZ)) / 62000) * 3.4;
  return n1 + n2 + broad + basin + getMacroDrainage(x, z) + getEdgeHillHeight(x, z);
}

export function sampleBaseTerrainHeight(x: number, z: number): number {
  const raw = sampleRawTerrainHeight(x, z);
  const riverLayout = activeRiverLayout;
  const quarryLayout = activeQuarryLayout;
  let height = raw;
  if (riverLayout) height -= riverLayout.getValleyDepression(x, z);
  if (quarryLayout) height -= quarryLayout.getPitDepression(x, z);
  return height;
}
