import type { BuildingKind } from './types.ts';
import type { ResourceTotals } from './resourceTotals.ts';

export type BuildingResourceCost = {
  timber: number;
  stone: number;
};

/** Enough for one lumber mill + one stone quarry, plus reserve for early residences. */
export const STARTING_TIMBER = 120;
export const STARTING_STONE = 140;

export const STONE_SALVAGE_FRACTION = 0.92;
export const TIMBER_SALVAGE_FRACTION = 0.7;

/** Per main house in a burgage zone — cost scales with residence count at placement. */
export const RESIDENCE_TIMBER_COST = 8;
export const RESIDENCE_STONE_COST = 12;

/** Planned cottage-scale residence footprint reference. */
export const ESTIMATED_COTTAGE_COST: BuildingResourceCost = {
  timber: RESIDENCE_TIMBER_COST,
  stone: RESIDENCE_STONE_COST,
};

export function residenceZoneCost(residenceCount: number): BuildingResourceCost {
  return {
    timber: RESIDENCE_TIMBER_COST * residenceCount,
    stone: RESIDENCE_STONE_COST * residenceCount,
  };
}

export const BUILDING_COSTS: Record<BuildingKind, BuildingResourceCost> = {
  lumber_mill: { timber: 45, stone: 15 },
  reforester: { timber: 35, stone: 10 },
  woodcutters_lodge: { timber: 40, stone: 12 },
  stone_quarry: { timber: 25, stone: 40 },
};

export function residenceZoneSalvageRefund(residenceCount: number): BuildingResourceCost {
  const cost = residenceZoneCost(residenceCount);
  return {
    timber: Math.round(cost.timber * TIMBER_SALVAGE_FRACTION),
    stone: Math.round(cost.stone * STONE_SALVAGE_FRACTION),
  };
}

export function getBuildingCost(kind: BuildingKind): BuildingResourceCost {
  return BUILDING_COSTS[kind];
}

export function buildingSalvageRefund(kind: BuildingKind): BuildingResourceCost {
  const cost = getBuildingCost(kind);
  return {
    timber: Math.round(cost.timber * TIMBER_SALVAGE_FRACTION),
    stone: Math.round(cost.stone * STONE_SALVAGE_FRACTION),
  };
}

export function canAffordBuilding(
  totals: Pick<ResourceTotals, 'timber' | 'stone'>,
  kind: BuildingKind,
): boolean {
  const cost = getBuildingCost(kind);
  return totals.timber >= cost.timber && totals.stone >= cost.stone;
}

export function canAffordResidenceZone(
  totals: Pick<ResourceTotals, 'timber' | 'stone'>,
  residenceCount: number,
): boolean {
  const cost = residenceZoneCost(residenceCount);
  return totals.timber >= cost.timber && totals.stone >= cost.stone;
}

export function formatBuildingCost(cost: BuildingResourceCost): string {
  return `${cost.timber} timber, ${cost.stone} stone`;
}
