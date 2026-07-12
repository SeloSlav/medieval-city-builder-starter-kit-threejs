import type { GameState } from '../resources/types.ts';
import type { ResourceNodeDefinition } from '../resources/types.ts';
import type { WorldLayoutRegistry } from '../resources/WorldLayoutRegistry.ts';
import { buildingKindLabel } from '../resources/WorldLayoutRegistry.ts';
import type { RiverField } from '../rivers/RiverField.ts';
import type { TerrainBounds } from '../terrain/Terrain.ts';
import { createTerrainMinimapImage } from './createTerrainMinimapImage.ts';

export type MinimapFocus = {
  x: number;
  z: number;
  yaw: number;
};

type TerrainMinimapOverlayOptions = {
  uiRoot: HTMLElement;
  riverField: RiverField;
  registry: WorldLayoutRegistry;
  getGameState: () => GameState;
  getFocus: () => MinimapFocus | null;
  isBlocked: () => boolean;
};

type MinimapMarker = {
  id: string;
  element: HTMLElement;
  x: number;
  z: number;
  hidden?: boolean;
};

const MARKER_KIND_CLASS: Record<string, string> = {
  quarry: 'terrain-minimap__marker--quarry',
  game: 'terrain-minimap__marker--game',
  berries: 'terrain-minimap__marker--berries',
  building: 'terrain-minimap__marker--building',
};

export class TerrainMinimapOverlay {
  private readonly options: TerrainMinimapOverlayOptions;
  private readonly root: HTMLElement;
  private readonly mapSurface: HTMLElement;
  private readonly markersRoot: HTMLElement;
  private readonly focusMarker: HTMLElement;
  private readonly bounds: TerrainBounds;
  private readonly staticMarkers: MinimapMarker[] = [];
  private readonly buildingMarkers = new Map<string, MinimapMarker>();
  private visible = false;

  constructor(options: TerrainMinimapOverlayOptions) {
    this.options = options;
    const { canvas, bounds } = createTerrainMinimapImage(options.riverField);
    this.bounds = bounds;

    this.root = document.createElement('div');
    this.root.className = 'terrain-minimap';
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');

    this.root.innerHTML = `
      <div class="terrain-minimap__panel">
        <div class="terrain-minimap__header">
          <span class="terrain-minimap__title">World map</span>
          <span class="terrain-minimap__hint">Hold G</span>
        </div>
        <div class="terrain-minimap__map-wrap">
          <div class="terrain-minimap__map-surface"></div>
          <div class="terrain-minimap__markers"></div>
          <div class="terrain-minimap__focus" aria-hidden="true"></div>
        </div>
      </div>
    `;

    this.mapSurface = this.root.querySelector<HTMLElement>('.terrain-minimap__map-surface')!;
    this.mapSurface.appendChild(canvas);
    this.markersRoot = this.root.querySelector<HTMLElement>('.terrain-minimap__markers')!;
    this.focusMarker = this.root.querySelector<HTMLElement>('.terrain-minimap__focus')!;

    this.buildStaticMarkers(options.registry.definitionList);
    options.uiRoot.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.root.hidden = !visible;
    if (visible) {
      this.syncBuildingMarkers();
      this.updateMarkers();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  shouldShow(keyHeld: boolean): boolean {
    return shouldShowTerrainMinimap(keyHeld, this.options.isBlocked);
  }

  update(): void {
    if (!this.visible) return;
    this.syncBuildingMarkers();
    this.updateMarkers();
    this.updateFocusMarker();
  }

  dispose(): void {
    this.root.remove();
  }

  private buildStaticMarkers(definitions: readonly ResourceNodeDefinition[]): void {
    for (const definition of definitions) {
      if (definition.kind !== 'quarry' && definition.kind !== 'game' && definition.kind !== 'berries') continue;
      const marker = this.createMarker(definition.id, definition.kind, definition.label);
      marker.x = definition.x;
      marker.z = definition.z;
      this.staticMarkers.push(marker);
      this.markersRoot.appendChild(marker.element);
    }
  }

  private syncBuildingMarkers(): void {
    const buildings = this.options.getGameState().buildings;
    const activeIds = new Set<string>();

    for (const building of buildings.values()) {
      activeIds.add(building.id);
      let marker = this.buildingMarkers.get(building.id);
      if (!marker) {
        marker = this.createMarker(building.id, 'building', buildingKindLabel(building.kind));
        marker.x = building.x;
        marker.z = building.z;
        this.buildingMarkers.set(building.id, marker);
        this.markersRoot.appendChild(marker.element);
      } else {
        marker.x = building.x;
        marker.z = building.z;
        marker.element.title = buildingKindLabel(building.kind);
      }
    }

    for (const [id, marker] of this.buildingMarkers) {
      if (activeIds.has(id)) continue;
      marker.element.remove();
      this.buildingMarkers.delete(id);
    }
  }

  private updateMarkers(): void {
    const foragingNodes = this.options.getGameState().foragingNodes;

    for (const marker of this.staticMarkers) {
      const definitionKind = marker.element.dataset.kind;
      if (definitionKind === 'game' || definitionKind === 'berries') {
        const state = foragingNodes.get(marker.id);
        marker.hidden = !state || state.remaining <= 0;
      }
      this.placeMarker(marker);
    }

    for (const marker of this.buildingMarkers.values()) {
      this.placeMarker(marker);
    }
  }

  private updateFocusMarker(): void {
    const focus = this.options.getFocus();
    if (!focus) {
      this.focusMarker.hidden = true;
      return;
    }

    const point = this.worldToPercent(focus.x, focus.z);
    this.focusMarker.hidden = false;
    this.focusMarker.style.left = `${point.x}%`;
    this.focusMarker.style.top = `${point.y}%`;
    this.focusMarker.style.transform = `translate(-50%, -50%) rotate(${focus.yaw}rad)`;
  }

  private placeMarker(marker: MinimapMarker): void {
    marker.element.hidden = marker.hidden === true;
    if (marker.hidden) return;
    const point = this.worldToPercent(marker.x, marker.z);
    marker.element.style.left = `${point.x}%`;
    marker.element.style.top = `${point.y}%`;
  }

  private worldToPercent(x: number, z: number): { x: number; y: number } {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    return {
      x: ((x - minX) / (maxX - minX)) * 100,
      y: ((z - minZ) / (maxZ - minZ)) * 100,
    };
  }

  private createMarker(id: string, kind: string, label: string): MinimapMarker {
    const element = document.createElement('span');
    element.className = `terrain-minimap__marker ${MARKER_KIND_CLASS[kind] ?? 'terrain-minimap__marker--building'}`;
    element.dataset.kind = kind;
    element.dataset.id = id;
    element.title = label;
    return { id, element, x: 0, z: 0 };
  }
}

export function shouldShowTerrainMinimap(
  keyHeld: boolean,
  isBlocked: () => boolean,
): boolean {
  return keyHeld && !isBlocked();
}
