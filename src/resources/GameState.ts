import type { RoadNetworkSnapshot } from '../roads/RoadNetwork.ts';
import {
  createEmptyStockpile,
  RESOURCE_KINDS,
  type GameState,
  type GameStateSnapshot,
  type ResourceNodeState,
  type ResourceStockpile,
} from './types.ts';
import type { WorldLayoutRegistry } from './WorldLayoutRegistry.ts';

export function createInitialGameState(registry: WorldLayoutRegistry, seed: number): GameState {
  const nodes = new Map<string, ResourceNodeState>();
  for (const definition of registry.definitionList) {
    nodes.set(definition.id, {
      nodeId: definition.id,
      kind: definition.kind,
      resource: definition.resource,
      remaining: definition.maxYield,
      maxYield: definition.maxYield,
    });
  }

  return {
    seed,
    tick: 0,
    stockpile: createEmptyStockpile(),
    nodes,
  };
}

export function gameStateToSnapshot(state: GameState, roads: RoadNetworkSnapshot): GameStateSnapshot {
  return {
    version: 1,
    seed: state.seed,
    tick: state.tick,
    stockpile: { ...state.stockpile },
    nodes: [...state.nodes.values()],
    roads,
  };
}

export function restoreGameState(snapshot: GameStateSnapshot, registry: WorldLayoutRegistry): GameState {
  if (snapshot.version !== 1) {
    throw new Error(`Unsupported game state version: ${String(snapshot.version)}`);
  }

  const nodes = new Map<string, ResourceNodeState>();
  for (const node of snapshot.nodes) {
    const definition = registry.getDefinition(node.nodeId);
    if (!definition) continue;
    nodes.set(node.nodeId, {
      nodeId: node.nodeId,
      kind: definition.kind,
      resource: definition.resource,
      remaining: clamp(node.remaining, 0, definition.maxYield),
      maxYield: definition.maxYield,
    });
  }

  for (const definition of registry.definitionList) {
    if (nodes.has(definition.id)) continue;
    nodes.set(definition.id, {
      nodeId: definition.id,
      kind: definition.kind,
      resource: definition.resource,
      remaining: definition.maxYield,
      maxYield: definition.maxYield,
    });
  }

  return {
    seed: snapshot.seed,
    tick: Math.max(0, snapshot.tick),
    stockpile: normalizeStockpile(snapshot.stockpile),
    nodes,
  };
}

export function serializeGameState(snapshot: GameStateSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function deserializeGameState(raw: string): GameStateSnapshot {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Game state must be a JSON object.');
  }
  return validateGameStateSnapshot(parsed as Partial<GameStateSnapshot>);
}

export type ExtractFromNodeResult =
  | { ok: true; state: GameState; extracted: number }
  | { ok: false; state: GameState; error: string };

/** Reducer-shaped extraction — ready for a future SpacetimeDB reducer. */
export function extractFromNode(state: GameState, nodeId: string, amount: number): ExtractFromNodeResult {
  const node = state.nodes.get(nodeId);
  if (!node) {
    return { ok: false, state, error: 'Unknown resource node.' };
  }
  if (amount <= 0) {
    return { ok: false, state, error: 'Amount must be positive.' };
  }

  const extracted = Math.min(amount, node.remaining);
  if (extracted <= 0) {
    return { ok: false, state, error: 'Nothing left to extract.' };
  }

  const nextNodes = new Map(state.nodes);
  nextNodes.set(nodeId, { ...node, remaining: node.remaining - extracted });

  const nextStockpile = { ...state.stockpile };
  nextStockpile[node.resource] += extracted;

  return {
    ok: true,
    extracted,
    state: {
      ...state,
      tick: state.tick + 1,
      stockpile: nextStockpile,
      nodes: nextNodes,
    },
  };
}

function validateGameStateSnapshot(value: Partial<GameStateSnapshot>): GameStateSnapshot {
  if (value.version !== 1) throw new Error('Unsupported game state version.');
  if (typeof value.seed !== 'number') throw new Error('Missing seed.');
  if (typeof value.tick !== 'number') throw new Error('Missing tick.');
  if (!value.stockpile || typeof value.stockpile !== 'object') throw new Error('Missing stockpile.');
  if (!Array.isArray(value.nodes)) throw new Error('Missing nodes.');
  if (!value.roads || typeof value.roads !== 'object') throw new Error('Missing roads.');

  return {
    version: 1,
    seed: value.seed,
    tick: value.tick,
    stockpile: normalizeStockpile(value.stockpile as Partial<ResourceStockpile>),
    nodes: value.nodes as ResourceNodeState[],
    roads: value.roads as RoadNetworkSnapshot,
  };
}

function normalizeStockpile(value: Partial<ResourceStockpile>): ResourceStockpile {
  const stockpile = createEmptyStockpile();
  for (const kind of RESOURCE_KINDS) {
    const amount = value[kind];
    stockpile[kind] = typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }
  return stockpile;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
