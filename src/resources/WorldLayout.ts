import { fullTerrainBounds } from '../terrain/terrainBounds.ts';
import { RiverLayout } from '../rivers/RiverLayout.ts';
import { ForagingLayout } from '../foraging/ForagingLayout.ts';
import { QuarryLayout } from '../quarries/QuarryLayout.ts';
import {
  createForestCores,
  createForestSpawnConfig,
  mulberry32,
  type ForestCore,
} from '../props/forestField.ts';
import {
  deriveSubSeed,
  hydrologyRiverCount,
  hydrologyTributaryCount,
  resolveWorldDimensions,
  scaledRiverDrain,
  forestDensityScale,
  type WorldGenerationSettings,
} from '../world/worldGenerationSettings.ts';
import { DEFAULT_WORLD_GENERATION_SETTINGS } from '../world/worldGenerationSettings.ts';

export { DEFAULT_WORLD_SEED } from '../world/worldGenerationSettings.ts';

export type WorldLayout = {
  settings: WorldGenerationSettings;
  seed: number;
  quarryLayout: QuarryLayout;
  foragingLayout: ForagingLayout;
  riverLayout: RiverLayout;
  forestCores: ForestCore[];
  treeSeed: number;
};

export function createWorldLayout(settings: WorldGenerationSettings = DEFAULT_WORLD_GENERATION_SETTINGS): WorldLayout {
  const dims = resolveWorldDimensions(settings.mapSize);
  const riverBounds = fullTerrainBounds(dims.terrainSize);
  const riverSeed = deriveSubSeed(settings.seed, 'river');
  const forestSeed = deriveSubSeed(settings.seed, 'forest');
  const treeSeed = deriveSubSeed(settings.seed, 'trees');
  const riverLayout = RiverLayout.create({
    bounds: riverBounds,
    seed: riverSeed,
    riverCount: hydrologyRiverCount(settings.hydrology),
    tributaryCount: hydrologyTributaryCount(settings.hydrology),
    drain: scaledRiverDrain(dims.playableHalf),
  });
  const quarryLayout = QuarryLayout.create({
    bounds: riverBounds,
    seed: settings.seed,
    riverLayout,
    playableHalf: dims.playableHalf,
  });
  const densityScale = forestDensityScale(settings.forestDensity);
  const spawnConfig = createForestSpawnConfig(dims.playableSize, dims.terrainSize, densityScale);
  const forestCores = createForestCores(mulberry32(forestSeed), spawnConfig);
  const foragingLayout = ForagingLayout.create({
    forestCores,
    riverLayout,
    playableHalf: dims.playableHalf,
    seed: settings.seed ^ 0x4f0d21,
  });
  return {
    settings,
    seed: settings.seed,
    quarryLayout,
    foragingLayout,
    riverLayout,
    forestCores,
    treeSeed,
  };
}
