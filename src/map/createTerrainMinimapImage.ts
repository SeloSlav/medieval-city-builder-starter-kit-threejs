import type { RiverField } from '../rivers/RiverField.ts';
import type { TerrainBounds } from '../terrain/Terrain.ts';
import { sampleTerrainBlendWeights } from '../terrain/TerrainBlendWeights.ts';

const MINIMAP_RESOLUTION = 512;

const GRASS_COLORS = {
  meadow: { r: 78, g: 118, b: 58 },
  dense: { r: 48, g: 82, b: 42 },
  dry: { r: 128, g: 118, b: 62 },
} as const;

const WATER_COLOR = { r: 52, g: 108, b: 158 };
const MUD_COLOR = { r: 92, g: 72, b: 48 };

export type TerrainMinimapImage = {
  canvas: HTMLCanvasElement;
  bounds: TerrainBounds;
};

export function createTerrainMinimapImage(riverField: RiverField): TerrainMinimapImage {
  const canvas = document.createElement('canvas');
  canvas.width = MINIMAP_RESOLUTION;
  canvas.height = MINIMAP_RESOLUTION;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to acquire 2D canvas context for terrain minimap.');
  }

  const image = context.createImageData(MINIMAP_RESOLUTION, MINIMAP_RESOLUTION);
  const { startX, startZ, spanX, spanZ } = riverField;
  const bounds: TerrainBounds = {
    minX: startX,
    maxX: startX + spanX,
    minZ: startZ,
    maxZ: startZ + spanZ,
  };

  for (let row = 0; row < MINIMAP_RESOLUTION; row++) {
    const z = startZ + (row / (MINIMAP_RESOLUTION - 1)) * spanZ;
    for (let column = 0; column < MINIMAP_RESOLUTION; column++) {
      const x = startX + (column / (MINIMAP_RESOLUTION - 1)) * spanX;
      const color = sampleMinimapColor(riverField, x, z);
      const index = (row * MINIMAP_RESOLUTION + column) * 4;
      image.data[index] = color.r;
      image.data[index + 1] = color.g;
      image.data[index + 2] = color.b;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return { canvas, bounds };
}

function sampleMinimapColor(
  riverField: RiverField,
  x: number,
  z: number,
): { r: number; g: number; b: number } {
  if (riverField.isRenderedWetAt(x, z)) {
    return WATER_COLOR;
  }

  const [meadow, dense, dry] = sampleTerrainBlendWeights(x, z);
  const grass = {
    r: GRASS_COLORS.meadow.r * meadow + GRASS_COLORS.dense.r * dense + GRASS_COLORS.dry.r * dry,
    g: GRASS_COLORS.meadow.g * meadow + GRASS_COLORS.dense.g * dense + GRASS_COLORS.dry.g * dry,
    b: GRASS_COLORS.meadow.b * meadow + GRASS_COLORS.dense.b * dense + GRASS_COLORS.dry.b * dry,
  };

  const shoreGrass = riverField.sampleMudBlendAt(x, z);
  const mudMix = (1 - shoreGrass) * 0.88;
  return blendColors(grass, MUD_COLOR, mudMix);
}

function blendColors(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(from.r + (to.r - from.r) * clamped),
    g: Math.round(from.g + (to.g - from.g) * clamped),
    b: Math.round(from.b + (to.b - from.b) * clamped),
  };
}
