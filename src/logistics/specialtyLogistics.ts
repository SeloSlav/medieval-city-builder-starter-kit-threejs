import {
  RESIDENCE_ALE_CAPACITY,
  RESIDENCE_ALE_PER_PERSON_PER_SEC,
  RESIDENCE_PRESERVED_FOOD_CAPACITY,
  RESIDENCE_PRESERVED_FOOD_PER_PERSON_PER_SEC,
} from '../generated/gameBalance.ts';
import type { BuildingKind, BuildingState, ResidenceState } from '../resources/types.ts';
import { getNeedStock } from '../residences/residenceNeedState.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import { roadPathDistance } from './roadLogistics.ts';

export const MONASTERY_MIN_PARISH_POPULATION = 12;

const PRESERVED_FOOD_SUPPLIER_KINDS: readonly BuildingKind[] = ['smokehouse', 'granary', 'monastery'];
const ALE_SUPPLIER_KINDS: readonly BuildingKind[] = ['brewery', 'monastery'];

export function findRoadLinkedSupplierForResidence(
  residence: ResidenceState,
  buildings: Iterable<BuildingState>,
  network: RoadNetwork,
  supplierKinds: readonly BuildingKind[],
): BuildingState | null {
  let best: BuildingState | null = null;
  let bestDistance = Infinity;

  for (const building of buildings) {
    if (building.constructionComplete === false || !supplierKinds.includes(building.kind)) continue;
    const distance = roadPathDistance(network, residence.x, residence.z, building.x, building.z);
    if (distance == null) continue;
    if (
      distance + 1e-6 < bestDistance
      || (Math.abs(distance - bestDistance) <= 1e-6 && best != null && building.id < best.id)
    ) {
      bestDistance = distance;
      best = building;
    }
  }

  return best;
}

export function parishPopulation(residences: Iterable<ResidenceState>): number {
  let total = 0;
  for (const residence of residences) {
    total += residence.population;
  }
  return total;
}

export function hasStaffedChapel(buildings: Iterable<BuildingState>): boolean {
  for (const building of buildings) {
    if (
      building.kind === 'chapel'
      && building.constructionComplete !== false
      && building.assignedLabor > 0
    ) return true;
  }
  return false;
}

export function residencePreservedFoodRunwaySeconds(residence: ResidenceState): number | null {
  if (residence.abandoned || residence.population === 0 || residence.tier < 2) return null;
  const stock = getNeedStock(residence.needs, 'preservedFood');
  const usePerSec = residence.population * RESIDENCE_PRESERVED_FOOD_PER_PERSON_PER_SEC;
  if (usePerSec <= 1e-9) return null;
  return stock / usePerSec;
}

export function residencePreservedFoodRunwayDays(residence: ResidenceState): number | null {
  const runwaySeconds = residencePreservedFoodRunwaySeconds(residence);
  if (runwaySeconds == null) return null;
  return runwaySeconds / 86400;
}

export function residenceAleRunwaySeconds(residence: ResidenceState): number | null {
  if (residence.abandoned || residence.population === 0 || residence.tier < 3) return null;
  const stock = getNeedStock(residence.needs, 'ale');
  const usePerSec = residence.population * RESIDENCE_ALE_PER_PERSON_PER_SEC;
  if (usePerSec <= 1e-9) return null;
  return stock / usePerSec;
}

export function residenceAleRunwayDays(residence: ResidenceState): number | null {
  const runwaySeconds = residenceAleRunwaySeconds(residence);
  if (runwaySeconds == null) return null;
  return runwaySeconds / 86400;
}

export function formatSpecialtyRunwayDays(days: number): string {
  if (days >= 2) return `${days.toFixed(1)} days`;
  const hours = Math.max(1, Math.round(days * 24));
  return `${hours}h`;
}

export { PRESERVED_FOOD_SUPPLIER_KINDS, ALE_SUPPLIER_KINDS, RESIDENCE_PRESERVED_FOOD_CAPACITY, RESIDENCE_ALE_CAPACITY };
