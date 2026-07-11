import type { BuildingKind, BuildingState, ResidenceState } from '../resources/types.ts';

export type RoadPathProbe = (ax: number, az: number, bx: number, bz: number) => number | null;

export function isRoadPathConnected(
  probe: RoadPathProbe,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  return probe(ax, az, bx, bz) != null;
}

export function isChapelStaffed(building: BuildingState): boolean {
  return building.kind === 'chapel' && building.assignedLabor > 0;
}

export function hasStaffedChapel(buildings: Iterable<BuildingState>): boolean {
  for (const building of buildings) {
    if (isChapelStaffed(building)) {
      return true;
    }
  }
  return false;
}

/** Player-owned buildings only — mirrors server `owner_has_staffed_chapel` for the active identity. */
export function playerHasStaffedChapel(buildings: Iterable<BuildingState>): boolean {
  return hasStaffedChapel(buildings);
}

export function hasRoadPathToBuildingKind(
  buildings: Iterable<BuildingState>,
  ax: number,
  az: number,
  kind: BuildingKind,
  probe: RoadPathProbe,
  requireStaff = false,
): boolean {
  for (const building of buildings) {
    if (building.kind !== kind) {
      continue;
    }
    if (requireStaff && building.assignedLabor <= 0) {
      continue;
    }
    if (isRoadPathConnected(probe, ax, az, building.x, building.z)) {
      return true;
    }
  }
  return false;
}

/** Mirrors `find_serving_chapel` in `server/src/simulation/landmark_access.rs`. */
export function findServingChapel(
  residence: ResidenceState,
  chapels: Iterable<BuildingState>,
  probe: RoadPathProbe,
): BuildingState | null {
  for (const chapel of chapels) {
    if (!isChapelStaffed(chapel)) {
      continue;
    }
    if (isRoadPathConnected(probe, residence.x, residence.z, chapel.x, chapel.z)) {
      return chapel;
    }
  }
  return null;
}

export function isResidenceConnectedToMarketplace(
  residence: ResidenceState,
  buildings: Iterable<BuildingState>,
  probe: RoadPathProbe,
): boolean {
  return hasRoadPathToBuildingKind(buildings, residence.x, residence.z, 'marketplace', probe);
}

export function isResidenceConnectedToChapel(
  residence: ResidenceState,
  buildings: Iterable<BuildingState>,
  probe: RoadPathProbe,
): boolean {
  return findServingChapel(residence, buildings, probe) != null;
}
