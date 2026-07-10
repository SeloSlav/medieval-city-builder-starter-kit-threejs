import { Terrain } from '../terrain/Terrain.ts';
import { RiverLayout } from '../rivers/RiverLayout.ts';
import { QuarryLayout } from '../quarries/QuarryLayout.ts';
import {
  createForestCores,
  createForestSpawnConfig,
  mulberry32,
  type ForestCore,
} from '../props/forestField.ts';

export const DEFAULT_WORLD_SEED = 0x71a2e0d;
export const FOREST_LAYOUT_SEED = 0x6a55b1ade;

export type WorldLayout = {
  seed: number;
  quarryLayout: QuarryLayout;
  riverLayout: RiverLayout;
  forestCores: ForestCore[];
};

export function createWorldLayout(seed = DEFAULT_WORLD_SEED): WorldLayout {
  const riverBounds = Terrain.fullBounds();
  const riverLayout = RiverLayout.create({ bounds: riverBounds });
  const quarryLayout = QuarryLayout.create({
    bounds: riverBounds,
    seed,
    riverLayout,
    playableHalf: 410,
  });
  const spawnConfig = createForestSpawnConfig(820, 1080);
  const forestCores = createForestCores(mulberry32(FOREST_LAYOUT_SEED), spawnConfig);
  return { seed, quarryLayout, riverLayout, forestCores };
}
