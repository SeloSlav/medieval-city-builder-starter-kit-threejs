import type { BuildingState } from '../resources/types.ts';
import { constructionVisualSignature } from './ConstructionSiteMesh.ts';

export function buildingMeshSignature(building: BuildingState): string {
  if (building.constructionComplete !== false) {
    return `complete:${building.kind}`;
  }
  return constructionVisualSignature(
    building.constructionProgress,
    ratio(building.constructionDeliveredTimber, building.constructionRequiredTimber),
    ratio(building.constructionDeliveredStone, building.constructionRequiredStone),
  );
}

export function buildingMarkerCollectionSignature(
  buildings: ReadonlyMap<string, BuildingState>,
): string {
  return [...buildings.values()]
    .map((building) => {
      const dynamicState = building.kind === 'lumber_mill'
        && building.constructionComplete !== false
        ? `:timber:${building.timber.toFixed(3)}`
        : '';
      return [
        building.id,
        building.x.toFixed(2),
        building.z.toFixed(2),
        buildingMeshSignature(building),
        dynamicState,
      ].join(':');
    })
    .sort()
    .join('|');
}

function ratio(value: number, required: number): number {
  if (required <= 1e-6) return 1;
  return Math.min(1, Math.max(0, value / required));
}
