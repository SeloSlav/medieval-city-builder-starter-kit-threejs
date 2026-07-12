import { buildingKindLabel } from '../resources/WorldLayoutRegistry.ts';
import type { WorldLayoutRegistry } from '../resources/WorldLayoutRegistry.ts';
import type {
  BuildingState,
  ForagingNodeState,
  ResourceNodeKind,
} from '../resources/types.ts';

export type WorldMapMarkerKind = ResourceNodeKind | 'building';

export type WorldMapMarker = {
  id: string;
  kind: WorldMapMarkerKind;
  label: string;
  x: number;
  z: number;
};

export function buildLayoutWorldMapMarkers(registry: WorldLayoutRegistry): WorldMapMarker[] {
  return registry.definitionList
    .filter((definition) => {
      if (definition.kind === 'quarry') {
        return definition.resource === 'stone';
      }
      return definition.kind === 'game' || definition.kind === 'berries';
    })
    .map((definition) => ({
      id: definition.id,
      kind: definition.kind,
      label: definition.label,
      x: definition.x,
      z: definition.z,
    }));
}

export function buildBuildingWorldMapMarkers(buildings: Iterable<BuildingState>): WorldMapMarker[] {
  return Array.from(buildings, (building) => ({
    id: building.id,
    kind: 'building',
    label: buildingKindLabel(building.kind),
    x: building.x,
    z: building.z,
  }));
}

export function isWorldMapForagingMarkerVisible(
  marker: WorldMapMarker,
  foragingNodes: Map<string, ForagingNodeState>,
): boolean {
  if (marker.kind !== 'game' && marker.kind !== 'berries') return true;
  const state = foragingNodes.get(marker.id);
  return Boolean(state && state.remaining > 0);
}

export function filterWorldMapMarkersByKind<K extends WorldMapMarkerKind>(
  markers: readonly WorldMapMarker[],
  kind: K,
): Array<WorldMapMarker & { kind: K }> {
  return markers.filter((marker): marker is WorldMapMarker & { kind: K } => marker.kind === kind);
}

export function filterWorldMapForagingMarkers(markers: readonly WorldMapMarker[]): WorldMapMarker[] {
  return markers.filter((marker) => marker.kind === 'game' || marker.kind === 'berries');
}
