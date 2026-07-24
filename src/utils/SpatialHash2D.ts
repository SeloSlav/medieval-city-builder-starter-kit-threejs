export type Point2D = { x: number; z: number };

/**
 * Uniform-grid neighbor index for deterministic placement generation.
 * Queries only inspect cells touched by the requested radius instead of
 * scanning every point already accepted.
 */
export class SpatialHash2D<T extends Point2D> {
  private readonly cells = new Map<string, T[]>();
  readonly cellSize: number;

  constructor(
    cellSize: number,
    initial: ReadonlyArray<T> = [],
  ) {
    if (!(cellSize > 0)) throw new Error('SpatialHash2D cellSize must be positive.');
    this.cellSize = cellSize;
    for (const point of initial) this.add(point);
  }

  add(point: T): void {
    const key = this.key(this.cellX(point.x), this.cellZ(point.z));
    const cell = this.cells.get(key);
    if (cell) cell.push(point);
    else this.cells.set(key, [point]);
  }

  hasPointWithin(x: number, z: number, radius: number): boolean {
    const radiusSq = radius * radius;
    let found = false;
    this.forEachNearby(x, z, radius, (point) => {
      const dx = x - point.x;
      const dz = z - point.z;
      if (dx * dx + dz * dz < radiusSq) found = true;
    }, () => found);
    return found;
  }

  distanceToNearestWithin(x: number, z: number, radius: number): number {
    let nearestSq = radius * radius;
    let found = false;
    this.forEachNearby(x, z, radius, (point) => {
      const dx = x - point.x;
      const dz = z - point.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < nearestSq) {
        nearestSq = distanceSq;
        found = true;
      }
    });
    return found ? Math.sqrt(nearestSq) : Number.POSITIVE_INFINITY;
  }

  private forEachNearby(
    x: number,
    z: number,
    radius: number,
    callback: (point: T) => void,
    shouldStop?: () => boolean,
  ): void {
    const minCellX = this.cellX(x - radius);
    const maxCellX = this.cellX(x + radius);
    const minCellZ = this.cellZ(z - radius);
    const maxCellZ = this.cellZ(z + radius);
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const points = this.cells.get(this.key(cellX, cellZ));
        if (!points) continue;
        for (const point of points) {
          callback(point);
          if (shouldStop?.()) return;
        }
      }
    }
  }

  private cellX(x: number): number {
    return Math.floor(x / this.cellSize);
  }

  private cellZ(z: number): number {
    return Math.floor(z / this.cellSize);
  }

  private key(x: number, z: number): string {
    return `${x},${z}`;
  }
}
