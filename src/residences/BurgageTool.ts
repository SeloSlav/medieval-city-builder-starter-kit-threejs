import * as THREE from 'three';
import type { TerrainProjector } from '../terrain/TerrainProjector.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import type { GameState } from '../resources/types.ts';
import type { BurgageFrontageEdge } from './burgageLayout.ts';
import { cornersFromPoints, computeBurgageLayout } from './burgageLayout.ts';
import {
  rectangleCornersToPoints,
  rectangleFromFrontageAndBackPoint,
} from './burgageRectangle.ts';
import { initialPlotCount } from './burgagePlacementValidation.ts';
import { BurgagePreview } from './BurgagePreview.ts';
import {
  detectFrontageEdge,
  validateBurgagePlacement,
  type BurgagePlacementFailureReason,
} from './burgagePlacementValidation.ts';

const MIN_POINT_DISTANCE = 1.2;
const SNAP_DISTANCE = 6;
const HOVER_PREVIEW_MOVE_THRESHOLD = 0.35;

export type BurgageZoneCommit = {
  corners: THREE.Vector3[];
  frontageEdge: BurgageFrontageEdge;
  plotCount: number;
};

type BurgageToolOptions = {
  domElement: HTMLElement;
  camera: THREE.Camera;
  terrainProjector: TerrainProjector;
  roadNetwork: RoadNetwork;
  getState: () => GameState;
  getHeightAt: (x: number, z: number) => number;
  getNaturalHeightAt: (x: number, z: number) => number;
  isWaterAt: (x: number, z: number) => boolean;
  onCommit: (commit: BurgageZoneCommit) => void | Promise<void>;
  onModeChanged: () => void;
  onPlacementRejected?: (reason: BurgagePlacementFailureReason) => void;
  onPlacementFailed?: (message: string) => void;
  onPickRejected?: (reason: 'missed_terrain' | 'too_close') => void;
  isBlocked: () => boolean;
};

export class BurgageTool {
  private readonly options: BurgageToolOptions;
  private readonly preview: BurgagePreview;
  private enabled = false;
  private points: THREE.Vector3[] = [];
  private frontageEdge: BurgageFrontageEdge = 0;
  private plotCount = 1;
  private plotCountTouched = false;
  private hoverPoint: THREE.Vector3 | null = null;
  private lastHoverPreviewX = Number.NaN;
  private lastHoverPreviewZ = Number.NaN;

  constructor(options: BurgageToolOptions) {
    this.options = options;
    this.preview = new BurgagePreview();
    options.domElement.addEventListener('mousedown', this.onPointerDown, { capture: true });
    options.domElement.addEventListener('mousemove', this.onPointerMove);
    window.addEventListener('keydown', this.onKeyDown);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getCursor(): string | null {
    if (!this.enabled || this.options.isBlocked()) return null;
    return 'crosshair';
  }

  hasDraft(): boolean {
    return this.points.length > 0;
  }

  isDraftBuildable(): boolean {
    return this.getValidation().ok;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.cancelDraft(false);
    } else {
      this.refreshPreview();
    }
    this.options.onModeChanged();
  }

  getBuildButtonPosition(): { clientX: number; clientY: number } | null {
    if (!this.enabled || !this.isDraftBuildable() || this.points.length < 4) return null;
    const anchor = this.points[1] ?? this.points[this.points.length - 1];
    const rect = this.options.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const projected = anchor.clone();
    projected.y += 1.4;
    projected.project(this.options.camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return {
      clientX: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      clientY: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    };
  }

  getStatusDetail(): string | null {
    if (!this.enabled) return null;
    if (this.points.length === 0) {
      return 'Click the first road-frontage corner';
    }
    if (this.points.length === 1) {
      return 'Click the second frontage corner along the road';
    }
    if (this.points.length === 2) {
      return 'Click behind the frontage to set zone depth (rectangle closes automatically)';
    }
    const validation = this.getValidation();
    if (!validation.ok) return 'Adjust zone or plot count';
    const count = validation.layout.residences.length;
    const cost = validation.layout.totalCost;
    return `${count} ${count === 1 ? 'residence' : 'residences'} — ${cost.wood} wood, ${cost.stone} stone`;
  }

  commitDraft(): void {
    if (this.points.length < 4) return;
    const validation = this.getValidation();
    if (!validation.ok) {
      this.options.onPlacementRejected?.(validation.reason);
      return;
    }
    void this.commitValidated();
  }

  dispose(): void {
    this.options.domElement.removeEventListener('mousedown', this.onPointerDown, { capture: true });
    this.options.domElement.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('keydown', this.onKeyDown);
    this.preview.dispose();
  }

  attachTo(parent: THREE.Group): void {
    parent.add(this.preview.group);
  }

  update(): void {
    if (!this.enabled || this.options.isBlocked()) {
      this.preview.clear();
    }
  }

  private readonly onPointerMove = (event: MouseEvent): void => {
    if (!this.enabled || this.options.isBlocked()) return;
    const point = this.pickPoint(event.clientX, event.clientY);
    if (point && this.shouldSkipHoverPreview(point)) return;
    this.hoverPoint = point;
    this.refreshPreview();
  };

  private shouldSkipHoverPreview(point: THREE.Vector3): boolean {
    const dx = point.x - this.lastHoverPreviewX;
    const dz = point.z - this.lastHoverPreviewZ;
    if (!Number.isFinite(this.lastHoverPreviewX)) return false;
    return Math.hypot(dx, dz) < HOVER_PREVIEW_MOVE_THRESHOLD;
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (!this.enabled || event.button !== 0 || this.options.isBlocked()) return;
    if (event.altKey) return;

    const point = this.pickPoint(event.clientX, event.clientY);
    if (!point) {
      this.options.onPickRejected?.('missed_terrain');
      return;
    }

    if (this.points.length >= 4) {
      const validation = this.getValidation();
      if (!validation.ok) {
        event.preventDefault();
        event.stopPropagation();
        this.options.onPlacementRejected?.(validation.reason);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void this.commitValidated();
      return;
    }

    if (this.points.length === 2) {
      const rectangle = this.buildRectangleFromPoint(point);
      if (!rectangle) {
        this.options.onPickRejected?.('too_close');
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.points = rectangle;
      this.syncFrontageAndPlotCount();
      this.options.onModeChanged();
      this.refreshPreview();
      return;
    }

    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      if (Math.hypot(point.x - last.x, point.z - last.z) < MIN_POINT_DISTANCE) {
        this.options.onPickRejected?.('too_close');
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();
    this.points.push(point);
    this.options.onModeChanged();
    this.refreshPreview();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || this.options.isBlocked()) return;
    if (this.points.length < 4) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitDraft();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.plotCountTouched = true;
      this.plotCount += 1;
      this.refreshPreview();
      this.options.onModeChanged();
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.plotCountTouched = true;
      this.plotCount = Math.max(1, this.plotCount - 1);
      this.refreshPreview();
      this.options.onModeChanged();
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.frontageEdge = ((this.frontageEdge + 1) % 4) as BurgageFrontageEdge;
      if (!this.plotCountTouched) this.syncPlotCountFromFrontage();
      this.refreshPreview();
      this.options.onModeChanged();
    }
  };

  private async commitValidated(): Promise<void> {
    const validation = this.getValidation();
    if (!validation.ok) {
      this.options.onPlacementRejected?.(validation.reason);
      return;
    }
    try {
      await this.options.onCommit({
        corners: this.points.map((point) => point.clone()),
        frontageEdge: this.frontageEdge,
        plotCount: validation.layout.plotCount,
      });
      this.setEnabled(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Residence placement failed.';
      this.options.onPlacementFailed?.(message);
    }
  }

  private cancelDraft(notify: boolean): void {
    this.points = [];
    this.hoverPoint = null;
    this.lastHoverPreviewX = Number.NaN;
    this.lastHoverPreviewZ = Number.NaN;
    this.frontageEdge = 0;
    this.plotCount = 1;
    this.plotCountTouched = false;
    this.preview.clear();
    if (notify) this.options.onModeChanged();
  }

  private getValidation() {
    return validateBurgagePlacement({
      corners: this.points,
      frontageEdge: this.frontageEdge,
      plotCount: this.plotCount,
      stockpile: this.options.getState().stockpile,
      roadNetwork: this.options.roadNetwork,
      isWaterAt: this.options.isWaterAt,
      getNaturalHeightAt: this.options.getNaturalHeightAt,
    });
  }

  private refreshPreview(): void {
    const corners = this.resolvePreviewCorners();

    let layout = null;
    let previewFrontageEdge = this.frontageEdge;
    let previewPlotCount = this.plotCount;

    if (corners.length === 4) {
      const cornerPoints = corners.map((point) => ({ x: point.x, z: point.z }));
      const zoneCorners = cornersFromPoints(cornerPoints);
      if (zoneCorners) {
        if (this.points.length < 4) {
          previewFrontageEdge = detectFrontageEdge(zoneCorners, this.options.roadNetwork);
          if (!this.plotCountTouched) {
            previewPlotCount = initialPlotCount(zoneCorners, previewFrontageEdge);
          }
        }
        layout = computeBurgageLayout(zoneCorners, previewFrontageEdge, previewPlotCount);
      }
    }

    const validation = this.points.length === 4
      ? this.getValidation()
      : corners.length === 4
        ? validateBurgagePlacement({
          corners,
          frontageEdge: previewFrontageEdge,
          plotCount: previewPlotCount,
          stockpile: this.options.getState().stockpile,
          roadNetwork: this.options.roadNetwork,
          isWaterAt: this.options.isWaterAt,
          getNaturalHeightAt: this.options.getNaturalHeightAt,
        })
        : { ok: false as const, reason: 'invalid_shape' as const };

    if (this.hoverPoint) {
      this.lastHoverPreviewX = this.hoverPoint.x;
      this.lastHoverPreviewZ = this.hoverPoint.z;
    }
    this.preview.update(
      corners,
      layout,
      validation.ok,
      this.options.getHeightAt,
      this.points.length < 4,
    );
  }

  private resolvePreviewCorners(): THREE.Vector3[] {
    if (this.points.length >= 4) {
      return this.points.map((point) => point.clone());
    }
    if (this.points.length === 2) {
      const backPoint = this.hoverPoint ?? this.points[1];
      const rectangle = this.buildRectangleFromBackPoint(backPoint);
      return rectangle ?? [...this.points];
    }
    if (this.points.length === 1 && this.hoverPoint) {
      return [this.points[0].clone(), this.hoverPoint.clone()];
    }
    return this.points.map((point) => point.clone());
  }

  private buildRectangleFromPoint(point: THREE.Vector3): THREE.Vector3[] | null {
    return this.buildRectangleFromBackPoint(point);
  }

  private buildRectangleFromBackPoint(backPoint: THREE.Vector3): THREE.Vector3[] | null {
    if (this.points.length < 2) return null;
    const frontStart = { x: this.points[0].x, z: this.points[0].z };
    const frontEnd = { x: this.points[1].x, z: this.points[1].z };
    const rect = rectangleFromFrontageAndBackPoint(
      frontStart,
      frontEnd,
      { x: backPoint.x, z: backPoint.z },
      this.options.roadNetwork,
    );
    if (!rect) return null;

    return rectangleCornersToPoints(rect).map((corner) => {
      const y = this.options.getHeightAt(corner.x, corner.z);
      return new THREE.Vector3(corner.x, y, corner.z);
    });
  }

  private syncFrontageAndPlotCount(): void {
    const cornerPoints = this.points.map((point) => ({ x: point.x, z: point.z }));
    const corners = cornersFromPoints(cornerPoints);
    if (!corners) return;
    this.frontageEdge = detectFrontageEdge(corners, this.options.roadNetwork);
    this.syncPlotCountFromFrontage();
  }

  private syncPlotCountFromFrontage(): void {
    const cornerPoints = this.points.map((point) => ({ x: point.x, z: point.z }));
    const corners = cornersFromPoints(cornerPoints);
    if (!corners) return;
    this.plotCount = initialPlotCount(corners, this.frontageEdge);
  }

  private pickPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const picked = this.options.terrainProjector.pick(clientX, clientY);
    if (!picked) return null;
    const snapped = this.applyRoadSnap(picked);
    return new THREE.Vector3(snapped.x, snapped.y, snapped.z);
  }

  private applyRoadSnap(point: THREE.Vector3): THREE.Vector3 {
    const snap = this.options.roadNetwork.findSnap(point, SNAP_DISTANCE);
    if (!snap) return point;
    return snap.point.clone();
  }
}
