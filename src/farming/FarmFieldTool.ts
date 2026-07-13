import * as THREE from 'three';
import {
  FARM_MAX_ACCEPTED_SLOPE_DEGREES,
  FARM_MAX_FIELD_AREA,
  FARM_MIN_FIELD_AREA,
  FARM_MIN_FIELD_EDGE,
} from '../generated/gameBalance.ts';
import { sampleAuthoritativeHydrologyScore } from '../hydrology/sampleAuthoritativeHydrology.ts';
import { buildingFootprintPolygonFromState, burgageZonePolygon } from '../placement/placementConflicts.ts';
import type { GameState, FarmCrop, BuildingState } from '../resources/types.ts';
import type { TreeRegistry } from '../resources/TreeRegistry.ts';
import type { TerrainProjector } from '../terrain/TerrainProjector.ts';
import { convexPolygonsOverlap2, isPointInPolygon2, type Point2 } from '../utils/polygonGeometry.ts';
import { FarmFieldPreview } from './FarmFieldMarkers.ts';
import {
  cropLabel,
  fieldArea,
  fieldCentroid,
  fieldEdgeLengths,
  moistureSuitability,
  rectangleFromBaseline,
  sampleAverageSlopeDegrees,
  type FarmFieldCorners,
} from './farmFieldMath.ts';

const MIN_CLICK_DISTANCE = 1.5;
const CROPS: readonly FarmCrop[] = ['rye', 'oats', 'fallow'];

export type FarmFieldPlacementFailureReason =
  | 'too_small' | 'too_large' | 'edge_too_short' | 'too_steep' | 'no_farmstead'
  | 'water' | 'quarry' | 'building' | 'residence' | 'field' | 'trees';

type Validation =
  | { ok: true; corners: FarmFieldCorners; farmstead: BuildingState; slope: number; moisture: number }
  | { ok: false; reason: FarmFieldPlacementFailureReason; corners: FarmFieldCorners | null; slope?: number; moisture?: number };

type FarmFieldToolOptions = {
  domElement: HTMLElement;
  camera: THREE.Camera;
  terrainProjector: TerrainProjector;
  getState: () => GameState;
  getTreeRegistry: () => TreeRegistry | null;
  getHeightAt: (x: number, z: number) => number;
  isWaterAt: (x: number, z: number) => boolean;
  isQuarryPitAt: (x: number, z: number) => boolean;
  onCommit: (input: { farmsteadId: string; corners: FarmFieldCorners; crop: FarmCrop; averageSlopeDegrees: number }) => Promise<void> | void;
  onModeChanged: () => void;
  onPlacementRejected?: (reason: FarmFieldPlacementFailureReason) => void;
  onPlacementFailed?: (message: string) => void;
  onCropChanged?: (crop: FarmCrop, recommendation: string) => void;
  isBlocked: () => boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(element?.isContentEditable);
}

export class FarmFieldTool {
  private readonly options: FarmFieldToolOptions;
  private readonly preview: FarmFieldPreview;
  private enabled = false;
  private points: Point2[] = [];
  private hoverPoint: Point2 | null = null;
  private fixedCorners: FarmFieldCorners | null = null;
  private crop: FarmCrop = 'rye';
  private pointerInside = false;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private pointerDirty = false;
  private validation: Validation = { ok: false, reason: 'too_small', corners: null };

  constructor(options: FarmFieldToolOptions) {
    this.options = options;
    this.preview = new FarmFieldPreview(options.getHeightAt);
    options.domElement.addEventListener('mousedown', this.onPointerDown, { capture: true });
    options.domElement.addEventListener('mousemove', this.onPointerMove);
    options.domElement.addEventListener('mouseenter', this.onPointerEnter);
    options.domElement.addEventListener('mouseleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  attachTo(parent: THREE.Group): void {
    parent.add(this.preview.group);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  hasDraft(): boolean {
    return this.points.length > 0 || this.fixedCorners !== null;
  }

  isDraftBuildable(): boolean {
    return this.fixedCorners !== null && this.validation.ok;
  }

  getCursor(): string | null {
    return this.enabled && !this.options.isBlocked() ? 'crosshair' : null;
  }

  shouldBlockCameraInput(event: MouseEvent | WheelEvent): boolean {
    return this.enabled && !this.options.isBlocked() && event instanceof MouseEvent && event.button === 2;
  }

  setEnabled(enabled: boolean): void {
    if (enabled && this.options.isBlocked()) return;
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clearDraft();
    else this.pointerDirty = true;
    this.options.onModeChanged();
  }

  getCrop(): FarmCrop {
    return this.crop;
  }

  cycleCrop(): void {
    if (!this.enabled) return;
    const index = CROPS.indexOf(this.crop);
    this.crop = CROPS[(index + 1) % CROPS.length];
    this.refreshPreview();
    const moisture = this.validation.moisture ?? 0.5;
    const suitability = Math.round(moistureSuitability(this.crop, moisture) * 100);
    const recommendation = this.crop === 'fallow'
      ? 'restores fertility after harvest'
      : `${suitability}% moisture suitability`;
    this.options.onCropChanged?.(this.crop, recommendation);
    this.options.onModeChanged();
  }

  getStatusDetail(): string {
    if (this.points.length === 0 && !this.fixedCorners) return `Click to start the field baseline · crop: ${cropLabel(this.crop)} (C to change)`;
    if (this.points.length === 1) return 'Click to set the other end of the field baseline';
    if (!this.fixedCorners) return 'Click to set field depth';
    if (!this.validation.ok) return this.failureDetail(this.validation.reason);
    const area = Math.round(fieldArea(this.validation.corners));
    const slope = this.validation.slope.toFixed(1);
    const moisture = Math.round(this.validation.moisture * 100);
    return `${cropLabel(this.crop)} · ${area} m² · ${slope}° slope · ${moisture}% moisture · hammer or Enter to place`;
  }

  getBuildButtonPosition(): { clientX: number; clientY: number } | null {
    if (!this.validation.ok) return null;
    const center = fieldCentroid(this.validation.corners);
    const rect = this.options.domElement.getBoundingClientRect();
    const point = new THREE.Vector3(center.x, this.options.getHeightAt(center.x, center.z) + 2, center.z);
    point.project(this.options.camera);
    if (point.z < -1 || point.z > 1) return null;
    return {
      clientX: rect.left + (point.x * 0.5 + 0.5) * rect.width,
      clientY: rect.top + (-point.y * 0.5 + 0.5) * rect.height,
    };
  }

  commitDraft(): void {
    if (!this.validation.ok) {
      if (!this.validation.ok) this.options.onPlacementRejected?.(this.validation.reason);
      return;
    }
    const commit = this.validation;
    void Promise.resolve(this.options.onCommit({
      farmsteadId: commit.farmstead.id,
      corners: commit.corners,
      crop: this.crop,
      averageSlopeDegrees: commit.slope,
    })).then(() => {
      this.clearDraft();
      this.options.onModeChanged();
    }).catch((error: unknown) => {
      this.options.onPlacementFailed?.(error instanceof Error ? error.message : 'Field placement failed.');
    });
  }

  update(): void {
    if (!this.enabled) return;
    if (this.options.isBlocked() || !this.pointerDirty) return;
    this.pointerDirty = false;
    if (!this.pointerInside) return;
    const point = this.options.terrainProjector.pick(this.pointerClientX, this.pointerClientY);
    this.hoverPoint = point ? { x: point.x, z: point.z } : null;
    this.refreshPreview();
  }

  dispose(): void {
    this.options.domElement.removeEventListener('mousedown', this.onPointerDown, { capture: true });
    this.options.domElement.removeEventListener('mousemove', this.onPointerMove);
    this.options.domElement.removeEventListener('mouseenter', this.onPointerEnter);
    this.options.domElement.removeEventListener('mouseleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.preview.dispose();
  }

  private readonly onPointerEnter = (): void => {
    this.pointerInside = true;
    this.pointerDirty = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
    this.hoverPoint = null;
    this.refreshPreview();
  };

  private readonly onPointerMove = (event: MouseEvent): void => {
    if (!this.enabled || this.options.isBlocked()) return;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    this.pointerDirty = true;
  };

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (!this.enabled || this.options.isBlocked()) return;
    if (event.button === 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.hasDraft()) this.undoLastStep();
      else this.setEnabled(false);
      return;
    }
    if (event.button !== 0 || event.altKey) return;
    const picked = this.options.terrainProjector.pick(event.clientX, event.clientY);
    if (!picked) return;
    const point = { x: picked.x, z: picked.z };
    if (this.points.length > 0 && Math.hypot(point.x - this.points[this.points.length - 1].x, point.z - this.points[this.points.length - 1].z) < MIN_CLICK_DISTANCE) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.fixedCorners) {
      if (this.validation.ok) this.commitDraft();
      else this.options.onPlacementRejected?.(this.validation.reason);
      return;
    }
    if (this.points.length < 2) this.points.push(point);
    else this.fixedCorners = rectangleFromBaseline(this.points[0], this.points[1], point);
    this.refreshPreview();
    this.options.onModeChanged();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target) || !this.enabled || this.options.isBlocked()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.hasDraft()) this.clearDraft();
      else this.setEnabled(false);
      this.options.onModeChanged();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.undoLastStep();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.commitDraft();
      return;
    }
    if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      event.stopPropagation();
      this.cycleCrop();
    }
  };

  private undoLastStep(): void {
    if (this.fixedCorners) this.fixedCorners = null;
    else this.points.pop();
    this.refreshPreview();
    this.options.onModeChanged();
  }

  private clearDraft(): void {
    this.points = [];
    this.fixedCorners = null;
    this.validation = { ok: false, reason: 'too_small', corners: null };
    this.preview.show(null, false, this.crop);
  }

  private refreshPreview(): void {
    const corners = this.fixedCorners ?? (
      this.points.length === 2 && this.hoverPoint
        ? rectangleFromBaseline(this.points[0], this.points[1], this.hoverPoint)
        : null
    );
    this.validation = this.validate(corners);
    this.preview.show(corners, this.validation.ok, this.crop);
  }

  private validate(corners: FarmFieldCorners | null): Validation {
    if (!corners) return { ok: false, reason: 'too_small', corners: null };
    const area = fieldArea(corners);
    if (area < FARM_MIN_FIELD_AREA) return { ok: false, reason: 'too_small', corners };
    if (area > FARM_MAX_FIELD_AREA) return { ok: false, reason: 'too_large', corners };
    if (fieldEdgeLengths(corners).some((edge) => edge < FARM_MIN_FIELD_EDGE)) return { ok: false, reason: 'edge_too_short', corners };
    const slope = sampleAverageSlopeDegrees(corners, this.options.getHeightAt);
    const center = fieldCentroid(corners);
    const moisture = sampleAuthoritativeHydrologyScore(center.x, center.z);
    if (slope > FARM_MAX_ACCEPTED_SLOPE_DEGREES) return { ok: false, reason: 'too_steep', corners, slope, moisture };
    const state = this.options.getState();
    let farmstead: BuildingState | null = null;
    let distance = Infinity;
    for (const building of state.buildings.values()) {
      if (building.kind !== 'threshing_barn') continue;
      const next = Math.hypot(building.x - center.x, building.z - center.z);
      if (next <= building.workRadius && next < distance) {
        farmstead = building;
        distance = next;
      }
    }
    if (!farmstead) return { ok: false, reason: 'no_farmstead', corners, slope, moisture };
    const samples = [...corners, center];
    if (samples.some((point) => this.options.isWaterAt(point.x, point.z))) return { ok: false, reason: 'water', corners, slope, moisture };
    if (samples.some((point) => this.options.isQuarryPitAt(point.x, point.z))) return { ok: false, reason: 'quarry', corners, slope, moisture };
    for (const building of state.buildings.values()) {
      if (convexPolygonsOverlap2(corners, buildingFootprintPolygonFromState(building))) return { ok: false, reason: 'building', corners, slope, moisture };
    }
    for (const zone of state.burgageZones.values()) {
      if (convexPolygonsOverlap2(corners, burgageZonePolygon(zone))) return { ok: false, reason: 'residence', corners, slope, moisture };
    }
    for (const field of state.farmFields.values()) {
      if (convexPolygonsOverlap2(corners, field.corners)) return { ok: false, reason: 'field', corners, slope, moisture };
    }
    const registry = this.options.getTreeRegistry();
    if (registry) {
      const radius = Math.max(...fieldEdgeLengths(corners));
      for (const tree of registry.treesInRadius(center.x, center.z, radius)) {
        if (!isPointInPolygon2(tree, corners)) continue;
        if (state.trees.get(tree.id)?.phase !== 'stump') return { ok: false, reason: 'trees', corners, slope, moisture };
      }
    }
    return { ok: true, corners, farmstead, slope, moisture };
  }

  private failureDetail(reason: FarmFieldPlacementFailureReason): string {
    switch (reason) {
      case 'too_small': return `Field too small · at least ${FARM_MIN_FIELD_AREA} m²`;
      case 'too_large': return `Field too large · maximum ${FARM_MAX_FIELD_AREA} m²`;
      case 'edge_too_short': return `Each edge must be at least ${FARM_MIN_FIELD_EDGE} m`;
      case 'too_steep': return `Ground too steep · maximum ${FARM_MAX_ACCEPTED_SLOPE_DEGREES}° average`;
      case 'no_farmstead': return 'Field center must lie within a farmstead working radius';
      case 'water': return 'Field cannot cover open water';
      case 'quarry': return 'Field cannot cover a quarry pit';
      case 'building': return 'Field overlaps a building';
      case 'residence': return 'Field overlaps a residence plot';
      case 'field': return 'Field overlaps existing farmland';
      case 'trees': return 'Clear standing trees before cultivating this field';
    }
  }
}
