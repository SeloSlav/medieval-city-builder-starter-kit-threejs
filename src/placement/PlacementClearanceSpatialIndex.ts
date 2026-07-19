import type { BuildingTerrainSource } from '../buildings/BuildingTerrainLayout.ts';
import { getBuildingSiteClearanceSearchRadius } from '../buildings/BuildingTerrainLayout.ts';
import type { Point2 } from '../utils/polygonGeometry.ts';

const CELL_SIZE = 48;

type CellMap<T extends object> = Map<number, T[]>;

export class PlacementClearanceSpatialIndex {
  private readonly buildingCells: CellMap<BuildingTerrainSource> = new Map();
  private readonly burgageCells: CellMap<Point2[]> = new Map();
  private readonly farmFieldCells: CellMap<Point2[]> = new Map();

  constructor(
    buildings: Iterable<BuildingTerrainSource>,
    burgageParcelPolygons: Iterable<Point2[]>,
    farmFieldPolygons: Iterable<Point2[]>,
  ) {
    for (const building of buildings) {
      insertPoint(this.buildingCells, building.x, building.z, building);
    }
    for (const polygon of burgageParcelPolygons) {
      insertBounds(this.burgageCells, polygonBounds(polygon), polygon);
    }
    for (const polygon of farmFieldPolygons) {
      insertBounds(this.farmFieldCells, polygonBounds(polygon), polygon);
    }
  }

  buildingsNear(x: number, z: number, clearanceRadius = 0): BuildingTerrainSource[] {
    return queryRadius(
      this.buildingCells,
      x,
      z,
      getBuildingSiteClearanceSearchRadius(clearanceRadius),
    );
  }

  burgageParcelsNear(x: number, z: number, clearanceRadius = 0): Point2[][] {
    return queryRadius(this.burgageCells, x, z, Math.max(0, clearanceRadius));
  }

  farmFieldsNear(x: number, z: number, clearanceRadius = 0): Point2[][] {
    return queryRadius(this.farmFieldCells, x, z, Math.max(0, clearanceRadius));
  }

  someBuildingNear(
    x: number,
    z: number,
    clearanceRadius: number,
    predicate: (building: BuildingTerrainSource) => boolean,
  ): boolean {
    return someRadius(
      this.buildingCells,
      x,
      z,
      getBuildingSiteClearanceSearchRadius(clearanceRadius),
      predicate,
    );
  }

  someBurgageParcelNear(
    x: number,
    z: number,
    clearanceRadius: number,
    predicate: (polygon: Point2[]) => boolean,
  ): boolean {
    return someRadius(
      this.burgageCells,
      x,
      z,
      Math.max(0, clearanceRadius),
      predicate,
    );
  }

  someFarmFieldNear(
    x: number,
    z: number,
    clearanceRadius: number,
    predicate: (polygon: Point2[]) => boolean,
  ): boolean {
    return someRadius(
      this.farmFieldCells,
      x,
      z,
      Math.max(0, clearanceRadius),
      predicate,
    );
  }
}

type BoundsXZ = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

function insertPoint<T extends object>(
  cells: CellMap<T>,
  x: number,
  z: number,
  value: T,
): void {
  insertCell(cells, packCell(Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE)), value);
}

function insertBounds<T extends object>(
  cells: CellMap<T>,
  bounds: BoundsXZ,
  value: T,
): void {
  for (const key of cellKeysForBounds(bounds)) {
    insertCell(cells, key, value);
  }
}

function insertCell<T extends object>(cells: CellMap<T>, key: number, value: T): void {
  const bucket = cells.get(key);
  if (bucket) bucket.push(value);
  else cells.set(key, [value]);
}

function queryRadius<T extends object>(
  cells: CellMap<T>,
  x: number,
  z: number,
  radius: number,
): T[] {
  const results: T[] = [];
  const seen = new Set<T>();
  const bounds = {
    minX: x - radius,
    maxX: x + radius,
    minZ: z - radius,
    maxZ: z + radius,
  };
  for (const key of cellKeysForBounds(bounds)) {
    for (const value of cells.get(key) ?? []) {
      if (seen.has(value)) continue;
      seen.add(value);
      results.push(value);
    }
  }
  return results;
}

function someRadius<T extends object>(
  cells: CellMap<T>,
  x: number,
  z: number,
  radius: number,
  predicate: (value: T) => boolean,
): boolean {
  const minCellX = Math.floor((x - radius) / CELL_SIZE);
  const maxCellX = Math.floor((x + radius) / CELL_SIZE);
  const minCellZ = Math.floor((z - radius) / CELL_SIZE);
  const maxCellZ = Math.floor((z + radius) / CELL_SIZE);
  for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      for (const value of cells.get(packCell(cellX, cellZ)) ?? []) {
        // Values spanning multiple cells may be tested more than once. That is cheaper
        // than allocating a Set for every tree, shrub, and rock clearance query.
        if (predicate(value)) return true;
      }
    }
  }
  return false;
}

function polygonBounds(polygon: Point2[]): BoundsXZ {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  return { minX, maxX, minZ, maxZ };
}

function cellKeysForBounds(bounds: BoundsXZ): number[] {
  const keys: number[] = [];
  const minCellX = Math.floor(bounds.minX / CELL_SIZE);
  const maxCellX = Math.floor(bounds.maxX / CELL_SIZE);
  const minCellZ = Math.floor(bounds.minZ / CELL_SIZE);
  const maxCellZ = Math.floor(bounds.maxZ / CELL_SIZE);
  for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      keys.push(packCell(cellX, cellZ));
    }
  }
  return keys;
}

function packCell(cellX: number, cellZ: number): number {
  return ((cellX + 32768) & 0xffff) | (((cellZ + 32768) & 0xffff) << 16);
}
