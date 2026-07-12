import { computeForestTreePlacements } from '../props/forestPlacements.ts';
import { RiverField } from '../rivers/RiverField.ts';
import { treeWoodYield } from '../resources/treeYield.ts';
import { createWorldLayout, type WorldLayout } from '../resources/WorldLayout.ts';
import { WorldLayoutRegistry } from '../resources/WorldLayoutRegistry.ts';
import { Terrain } from '../terrain/Terrain.ts';
import {
  DEFAULT_WORLD_GENERATION_SETTINGS,
  forestDensityScale,
  resolveWorldDimensions,
  type WorldGenerationSettings,
} from './worldGenerationSettings.ts';

export type WorldBootstrapQuarry = {
  quarryId: string;
  x: number;
  z: number;
  maxYield: number;
};

export type WorldBootstrapForagingNode = {
  nodeId: string;
  nodeKind: 'game' | 'berries';
  x: number;
  z: number;
  maxYield: number;
  anchorX: number;
  anchorZ: number;
};

export type WorldBootstrapTree = {
  treeId: string;
  layoutIndex: number;
  woodYield: number;
  x: number;
  z: number;
};

export type WorldBootstrapData = {
  seed: number;
  quarries: WorldBootstrapQuarry[];
  foragingNodes: WorldBootstrapForagingNode[];
  gameRespawnCandidates: Array<{ x: number; z: number }>;
  trees: WorldBootstrapTree[];
};

/** Headless bootstrap for scripts — rebuilds river/quarry blocking without full terrain mesh. */
export function computeWorldBootstrapDataHeadless(
  settings: WorldGenerationSettings = DEFAULT_WORLD_GENERATION_SETTINGS,
): WorldBootstrapData {
  const worldLayout = createWorldLayout(settings);
  return computeWorldBootstrapDataFromLayout(worldLayout);
}

export function computeWorldBootstrapDataFromLayout(worldLayout: WorldLayout): WorldBootstrapData {
  const dims = resolveWorldDimensions(worldLayout.settings.mapSize);
  const registry = WorldLayoutRegistry.fromWorldLayout(worldLayout);
  const riverBounds = Terrain.fullBounds(dims.terrainSize);
  const riverField = RiverField.fromLayout({ bounds: riverBounds, layout: worldLayout.riverLayout });
  const isBlockedAt = (x: number, z: number) =>
    riverField.isBlockedForProps(x, z) || worldLayout.quarryLayout.isBlockedForProps(x, z);

  const quarries: WorldBootstrapQuarry[] = registry.definitionList
    .filter((definition) => definition.kind === 'quarry')
    .map((definition) => ({
      quarryId: definition.id,
      x: definition.x,
      z: definition.z,
      maxYield: definition.maxYield,
    }));

  const foragingNodes: WorldBootstrapForagingNode[] = registry.definitionList
    .filter((definition) => definition.kind === 'game' || definition.kind === 'berries')
    .map((definition) => ({
      nodeId: definition.id,
      nodeKind: definition.kind as 'game' | 'berries',
      x: definition.x,
      z: definition.z,
      maxYield: definition.maxYield,
      anchorX: definition.x,
      anchorZ: definition.z,
    }));

  const treePlacements = computeForestTreePlacements(dims.playableSize, dims.terrainSize, isBlockedAt, {
    treeSeed: worldLayout.treeSeed,
    densityScale: forestDensityScale(worldLayout.settings.forestDensity),
  });
  const trees: WorldBootstrapTree[] = treePlacements.map((placement, layoutIndex) => ({
    treeId: `tree-${layoutIndex}`,
    layoutIndex,
    x: placement.x,
    z: placement.z,
    woodYield: treeWoodYield({
      form: placement.form,
      species: placement.species,
      scale: placement.scale,
    }),
  }));

  return {
    seed: worldLayout.seed,
    quarries,
    foragingNodes,
    gameRespawnCandidates: worldLayout.foragingLayout.gameRespawnCandidates,
    trees,
  };
}
