import type { RoadNetworkSnapshot } from '../roads/RoadNetwork.ts';

export const RESOURCE_KINDS = ['stone', 'wood', 'water'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_NODE_KINDS = ['quarry', 'forest', 'water-access'] as const;
export type ResourceNodeKind = (typeof RESOURCE_NODE_KINDS)[number];

export type ResourceNodeDefinition = {
  id: string;
  kind: ResourceNodeKind;
  resource: ResourceKind;
  x: number;
  z: number;
  label: string;
  maxYield: number;
  pickRadius: number;
  quarryKind?: 'large' | 'small';
  forestStrength?: number;
};

export type ResourceNodeState = {
  nodeId: string;
  kind: ResourceNodeKind;
  resource: ResourceKind;
  remaining: number;
  maxYield: number;
};

export type ResourceStockpile = Record<ResourceKind, number>;

export type GameStateSnapshot = {
  version: 1;
  seed: number;
  tick: number;
  stockpile: ResourceStockpile;
  nodes: ResourceNodeState[];
  roads: RoadNetworkSnapshot;
};

export type GameState = {
  seed: number;
  tick: number;
  stockpile: ResourceStockpile;
  nodes: Map<string, ResourceNodeState>;
};

export type InspectableTarget =
  | {
      kind: 'node';
      definition: ResourceNodeDefinition;
      state: ResourceNodeState;
    }
  | {
      kind: 'river';
      x: number;
      z: number;
      shoreDistance: number;
      onWater: boolean;
    };

export function createEmptyStockpile(): ResourceStockpile {
  return { stone: 0, wood: 0, water: 0 };
}

export function isResourceKind(value: string): value is ResourceKind {
  return (RESOURCE_KINDS as readonly string[]).includes(value);
}
