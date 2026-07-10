import type { Terrain } from '../terrain/Terrain.ts';
import type { RiverField } from '../rivers/RiverField.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import type { GameState, InspectableTarget } from './types.ts';
import type { WorldLayoutRegistry } from './WorldLayoutRegistry.ts';

const RIVER_INSPECT_MAX_SHORE = 8;
const NEAREST_ROAD_MAX_DISTANCE = 18;

export class WorldQueries {
  private readonly terrain: Terrain;
  private readonly riverField: RiverField;
  private readonly registry: WorldLayoutRegistry;
  private readonly getGameState: () => GameState;
  private readonly getRoadNetwork: () => RoadNetwork;

  constructor(options: {
    terrain: Terrain;
    riverField: RiverField;
    registry: WorldLayoutRegistry;
    getGameState: () => GameState;
    getRoadNetwork: () => RoadNetwork;
  }) {
    this.terrain = options.terrain;
    this.riverField = options.riverField;
    this.registry = options.registry;
    this.getGameState = options.getGameState;
    this.getRoadNetwork = options.getRoadNetwork;
  }

  getHeightAt(x: number, z: number): number {
    return this.terrain.getHeightAt(x, z);
  }

  isNearRiver(x: number, z: number): boolean {
    if (this.riverField.isRenderedWetAt(x, z)) return true;
    return this.riverField.sampleShoreDistance(x, z) <= RIVER_INSPECT_MAX_SHORE;
  }

  getRiverAccessInfo(x: number, z: number): { shoreDistance: number; onWater: boolean } {
    return {
      onWater: this.riverField.isRenderedWetAt(x, z),
      shoreDistance: this.riverField.sampleShoreDistance(x, z),
    };
  }

  findInspectableTarget(x: number, z: number): InspectableTarget | null {
    const nodeDefinition = this.registry.findNearestDefinition(x, z);
    if (nodeDefinition) {
      const state = this.getGameState().nodes.get(nodeDefinition.id);
      if (state) {
        return { kind: 'node', definition: nodeDefinition, state };
      }
    }

    const river = this.getRiverAccessInfo(x, z);
    if (river.onWater || river.shoreDistance <= RIVER_INSPECT_MAX_SHORE) {
      return { kind: 'river', x, z, ...river };
    }

    return null;
  }

  getNearestRoadNodeDistance(x: number, z: number): number | null {
    const network = this.getRoadNetwork();
    let best: number | null = null;

    for (const node of network.nodes.values()) {
      const distance = Math.hypot(x - node.position.x, z - node.position.z);
      if (distance > NEAREST_ROAD_MAX_DISTANCE) continue;
      if (best == null || distance < best) best = distance;
    }

    return best;
  }
}
