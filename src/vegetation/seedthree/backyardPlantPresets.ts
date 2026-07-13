import type { SeedThreeSpeciesPreset } from './seedThreeAssets.ts';

export type BackyardPlantKind = 'apple' | 'cherry' | 'rose';

/** Custom cultivated forms; kept data-only so tooling can validate them headlessly. */
export const BACKYARD_PLANT_SPECIES: Record<BackyardPlantKind, SeedThreeSpeciesPreset> = {
  apple: {
    name: 'Gorski Backyard Apple', bark: 'white_oak_albedo.png', leaf: 'american_beech_single_albedo.png',
    foliage: { mode: 'leaves', clustersPerBranch: 3, clusterSize: 0.72, clusterSizeVar: 0.18, clusterQuads: 2, tint: 0xc8dda5, leavesPerBranch: 9, size: 0.24, downAngle: 54, bend: 0, trunkClearRadius: 0.25 },
    params: {
      scale: 4.45, scaleV: 0.42, levels: 3, ratio: 0.048, ratioPower: 1.25, baseSize: 0.31, shape: 1, flare: 0.72, attractionUp: 0.38, baseSplits: 1, baseSplitAngle: 16,
      length: [1, 0.54, 0.38, 0.22], lengthV: [0, 0.16, 0.14, 0.1], taper: [1, 1, 1, 1], curveRes: [8, 5, 4, 3], curve: [9, 30, 28, 0], curveBack: [0, -18, 0, 0], curveV: [14, 58, 58, 48], downAngle: [0, 68, 56, 52], downAngleV: [0, 20, 22, 22], rotate: [0, 137, 137, 137], rotateV: [0, 30, 32, 32], branches: [0, 16, 11, 0], radialSegments: [10, 7, 5, 4],
    },
  },
  cherry: {
    name: 'Gorski Backyard Cherry', bark: 'red_maple_albedo.png', leaf: 'red_maple_single_albedo.png',
    foliage: { mode: 'leaves', clustersPerBranch: 3, clusterSize: 0.68, clusterSizeVar: 0.2, clusterQuads: 2, tint: 0xcce0a9, leavesPerBranch: 8, size: 0.22, downAngle: 48, bend: 0, trunkClearRadius: 0.3 },
    params: {
      scale: 4.85, scaleV: 0.48, levels: 3, ratio: 0.038, ratioPower: 1.3, baseSize: 0.27, shape: 1, flare: 0.4, attractionUp: 0.62, baseSplits: 1, baseSplitAngle: 12,
      length: [1, 0.48, 0.31, 0.18], lengthV: [0, 0.14, 0.12, 0.08], taper: [1, 1, 1, 1], curveRes: [8, 5, 4, 3], curve: [5, 22, 22, 0], curveBack: [0, -8, 0, 0], curveV: [9, 46, 50, 46], downAngle: [0, 55, 51, 48], downAngleV: [0, 17, 20, 20], rotate: [0, 137, 137, 137], rotateV: [0, 25, 28, 28], branches: [0, 19, 12, 0], radialSegments: [9, 7, 5, 4],
    },
  },
  rose: {
    name: 'Gorski Cottage Rose', bark: 'sweetgum_albedo.png', leaf: 'sweetgum_single_albedo.png',
    foliage: { mode: 'leaves', clustersPerBranch: 3, clusterSize: 0.28, clusterSizeVar: 0.1, clusterQuads: 2, tint: 0xb8d591, leavesPerBranch: 7, size: 0.105, downAngle: 58, bend: 0, trunkClearRadius: 0.03 },
    params: {
      scale: 1.12, scaleV: 0.15, levels: 3, ratio: 0.033, ratioPower: 1.25, baseSize: 0.04, shape: 1, flare: 0.18, attractionUp: 0.72, baseSplits: 4, baseSplitAngle: 28,
      length: [0.9, 0.72, 0.46, 0.2], lengthV: [0.08, 0.18, 0.14, 0.08], taper: [1, 1, 1, 1], curveRes: [6, 4, 3, 3], curve: [8, 34, 32, 0], curveBack: [0, -12, 0, 0], curveV: [18, 62, 58, 50], downAngle: [0, 38, 54, 58], downAngleV: [0, 26, 24, 22], rotate: [0, 112, 137, 137], rotateV: [0, 38, 34, 34], branches: [0, 9, 7, 0], radialSegments: [7, 5, 4, 3],
    },
  },
};
