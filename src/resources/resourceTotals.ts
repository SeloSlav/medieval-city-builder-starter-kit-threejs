import type { BuildingKind, BuildingState, GameState, ResidenceState } from './types.ts';

export const STARTING_POPULATION = 6;
export const POPULATION_PER_RESIDENCE = 4;
export const RESIDENCE_FIREWOOD_CAPACITY = 40;
export const RESIDENCE_FIREWOOD_PER_PERSON_PER_SEC = 0.02;
export const ABANDON_AFTER_DEFICIT_TICKS = 3600;
/** Must match server `TICK_DT`. */
export const SIM_TICK_SECONDS = 0.2;

export type StorageCaps = {
  timber: number;
  firewood: number;
  stone: number;
};

export type ResourceTotals = {
  timber: number;
  stone: number;
  firewood: number;
  water: number;
};

export type PopulationStats = {
  total: number;
  assigned: number;
  available: number;
};

const BUILDING_STORAGE_CAPS: Record<BuildingKind, StorageCaps> = {
  lumber_mill: { timber: 240, firewood: 0, stone: 0 },
  woodcutters_lodge: { timber: 60, firewood: 120, stone: 0 },
  stone_quarry: { timber: 0, firewood: 0, stone: 180 },
  reforester: { timber: 0, firewood: 0, stone: 0 },
};

export function buildingStorageCaps(kind: BuildingKind): StorageCaps {
  return BUILDING_STORAGE_CAPS[kind];
}

export function buildingAcceptsLabor(kind: BuildingKind): boolean {
  return kind === 'lumber_mill' || kind === 'woodcutters_lodge' || kind === 'stone_quarry';
}

export function computeResourceTotals(state: GameState): ResourceTotals {
  let timber = state.stockpile.timber;
  let stone = state.stockpile.stone;
  let firewood = state.stockpile.firewood;

  for (const building of state.buildings.values()) {
    timber += building.timber;
    stone += building.stone;
    firewood += building.firewood;
  }

  for (const residence of state.residences.values()) {
    firewood += residence.firewoodStock;
  }

  return {
    timber,
    stone,
    firewood,
    water: state.stockpile.water,
  };
}

export function computePopulationStats(state: GameState): PopulationStats {
  let fromResidences = 0;
  for (const residence of state.residences.values()) {
    if (residence.abandoned) continue;
    fromResidences += residence.population;
  }

  const total = STARTING_POPULATION + fromResidences;
  let assigned = 0;
  for (const building of state.buildings.values()) {
    assigned += building.assignedLabor;
  }

  return {
    total,
    assigned,
    available: Math.max(0, total - assigned),
  };
}

export function maxAssignableLabor(
  building: BuildingState,
  stats: PopulationStats,
): number {
  const assignedElsewhere = stats.assigned - building.assignedLabor;
  return Math.max(0, stats.total - assignedElsewhere);
}

export function residenceNeedsStatus(residence: ResidenceState): {
  label: string;
  state: 'active' | 'idle' | 'warning' | 'abandoned';
} {
  if (residence.abandoned) {
    return { label: 'Abandoned — firewood needs unmet', state: 'abandoned' };
  }
  if (residence.population === 0) {
    return { label: 'Unoccupied', state: 'idle' };
  }
  if (residence.needsDeficitTicks > 0) {
    const remainingTicks = Math.max(0, ABANDON_AFTER_DEFICIT_TICKS - residence.needsDeficitTicks);
    const remainingSeconds = remainingTicks * SIM_TICK_SECONDS;
    return {
      label: `Low firewood — abandons in ${formatShortDuration(remainingSeconds)}`,
      state: 'warning',
    };
  }
  if (residence.firewoodStock <= 0.5) {
    const demandPerSec = residence.population * RESIDENCE_FIREWOOD_PER_PERSON_PER_SEC;
    const runwaySeconds = demandPerSec > 0 ? residence.firewoodStock / demandPerSec : 0;
    return {
      label: runwaySeconds > 30
        ? `Firewood low — ~${formatShortDuration(runwaySeconds)} of stock left`
        : 'Awaiting firewood delivery',
      state: 'warning',
    };
  }
  return { label: 'Needs met', state: 'active' };
}

function formatShortDuration(seconds: number): string {
  if (seconds >= 120) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `~${minutes} min`;
  }
  return `~${Math.max(1, Math.round(seconds))}s`;
}
