import type { PointXZ } from '../utils/pathGeometry.ts';

const NAV_GRID_STEP_M = 0.65;
const NAV_SEARCH_PADDING_M = 9;
const NAV_SEGMENT_SAMPLE_M = 0.22;
const MAX_NAV_CELLS = 24_000;
const CARDINAL_COST = 1;
const DIAGONAL_COST = Math.SQRT2;

type GridPoint = {
  x: number;
  z: number;
};

type SearchNode = GridPoint & {
  key: number;
  g: number;
  f: number;
};

export type AgentObstacleTest = (x: number, z: number) => boolean;

/**
 * Detours a polyline around static obstacles. Clear waypoints are preserved
 * exactly for worker activity stops; any waypoint inside a collider is moved
 * to the nearest reachable grid point so an agent never walks into the mesh.
 */
export function routeAgentPolyline(
  path: readonly PointXZ[],
  isBlocked: AgentObstacleTest,
): PointXZ[] | null {
  if (path.length < 2) return path.map(copyPoint);

  const routed: PointXZ[] = [];
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index];
    const end = path[index + 1];
    const leg = routeAgentLeg(start, end, isBlocked);
    if (!leg) return null;
    for (const point of leg) {
      pushDistinct(routed, point);
    }
  }
  return routed;
}

function routeAgentLeg(
  start: PointXZ,
  end: PointXZ,
  isBlocked: AgentObstacleTest,
): PointXZ[] | null {
  if (
    !isBlocked(start.x, start.z)
    && !isBlocked(end.x, end.z)
    && segmentIsClear(start, end, isBlocked)
  ) {
    return [copyPoint(start), copyPoint(end)];
  }

  for (const padding of [
    NAV_SEARCH_PADDING_M,
    NAV_SEARCH_PADDING_M * 2,
    NAV_SEARCH_PADDING_M * 4,
  ]) {
    const route = routeAgentLegWithinBounds(start, end, isBlocked, padding);
    if (route) return route;
  }
  return null;
}

function routeAgentLegWithinBounds(
  start: PointXZ,
  end: PointXZ,
  isBlocked: AgentObstacleTest,
  padding: number,
): PointXZ[] | null {
  const originX = Math.floor((Math.min(start.x, end.x) - padding) / NAV_GRID_STEP_M)
    * NAV_GRID_STEP_M;
  const originZ = Math.floor((Math.min(start.z, end.z) - padding) / NAV_GRID_STEP_M)
    * NAV_GRID_STEP_M;
  const width = Math.ceil(
    (Math.max(start.x, end.x) + padding - originX) / NAV_GRID_STEP_M,
  ) + 1;
  const height = Math.ceil(
    (Math.max(start.z, end.z) + padding - originZ) / NAV_GRID_STEP_M,
  ) + 1;
  if (width * height > MAX_NAV_CELLS) return null;

  const blockedCache = new Int8Array(width * height);
  const gridBlocked = (x: number, z: number): boolean => {
    if (x < 0 || z < 0 || x >= width || z >= height) return true;
    const key = z * width + x;
    const cached = blockedCache[key];
    if (cached !== 0) return cached === 2;
    const blocked = isBlocked(
      originX + x * NAV_GRID_STEP_M,
      originZ + z * NAV_GRID_STEP_M,
    );
    blockedCache[key] = blocked ? 2 : 1;
    return blocked;
  };

  const requestedStart = worldToGrid(start, originX, originZ, width, height);
  const requestedEnd = worldToGrid(end, originX, originZ, width, height);
  const startBlocked = isBlocked(start.x, start.z);
  const endBlocked = isBlocked(end.x, end.z);
  const gridToWorld = (point: GridPoint): PointXZ => ({
    x: originX + point.x * NAV_GRID_STEP_M,
    z: originZ + point.z * NAV_GRID_STEP_M,
  });
  const gridStart = nearestOpenGridPoint(
    requestedStart,
    gridBlocked,
    width,
    height,
    startBlocked
      ? undefined
      : (point) => segmentIsClear(start, gridToWorld(point), isBlocked),
  );
  const gridEnd = nearestOpenGridPoint(
    requestedEnd,
    gridBlocked,
    width,
    height,
    endBlocked
      ? undefined
      : (point) => segmentIsClear(end, gridToWorld(point), isBlocked),
  );
  if (!gridStart || !gridEnd) return null;

  const gridPath = findGridPath(gridStart, gridEnd, gridBlocked, width, height);
  if (!gridPath) return null;

  const worldPath = gridPath.map(gridToWorld);
  const smoothed = smoothGridPath(worldPath, isBlocked);
  const result: PointXZ[] = [startBlocked ? gridToWorld(gridStart) : copyPoint(start)];
  for (const point of smoothed) pushDistinct(result, point);
  pushDistinct(result, endBlocked ? gridToWorld(gridEnd) : end);
  return result;
}

function findGridPath(
  start: GridPoint,
  end: GridPoint,
  isBlocked: (x: number, z: number) => boolean,
  width: number,
  height: number,
): GridPoint[] | null {
  const cellCount = width * height;
  const gScores = new Float64Array(cellCount);
  gScores.fill(Number.POSITIVE_INFINITY);
  const parents = new Int32Array(cellCount);
  parents.fill(-1);
  const closed = new Uint8Array(cellCount);
  const open = new MinHeap();
  const startKey = start.z * width + start.x;
  const endKey = end.z * width + end.x;
  gScores[startKey] = 0;
  open.push({
    ...start,
    key: startKey,
    g: 0,
    f: octileDistance(start.x, start.z, end.x, end.z),
  });

  const directions = [
    { x: 1, z: 0, cost: CARDINAL_COST },
    { x: -1, z: 0, cost: CARDINAL_COST },
    { x: 0, z: 1, cost: CARDINAL_COST },
    { x: 0, z: -1, cost: CARDINAL_COST },
    { x: 1, z: 1, cost: DIAGONAL_COST },
    { x: 1, z: -1, cost: DIAGONAL_COST },
    { x: -1, z: 1, cost: DIAGONAL_COST },
    { x: -1, z: -1, cost: DIAGONAL_COST },
  ] as const;

  while (open.size > 0) {
    const current = open.pop();
    if (!current || closed[current.key]) continue;
    if (current.g > gScores[current.key] + 1e-8) continue;
    if (current.key === endKey) {
      return reconstructGridPath(endKey, parents, width);
    }
    closed[current.key] = 1;

    for (const direction of directions) {
      const nextX = current.x + direction.x;
      const nextZ = current.z + direction.z;
      if (isBlocked(nextX, nextZ)) continue;
      if (
        direction.x !== 0
        && direction.z !== 0
        && (
          isBlocked(current.x + direction.x, current.z)
          || isBlocked(current.x, current.z + direction.z)
        )
      ) {
        continue;
      }

      const nextKey = nextZ * width + nextX;
      if (closed[nextKey]) continue;
      const nextG = current.g + direction.cost;
      if (nextG + 1e-8 >= gScores[nextKey]) continue;
      gScores[nextKey] = nextG;
      parents[nextKey] = current.key;
      open.push({
        x: nextX,
        z: nextZ,
        key: nextKey,
        g: nextG,
        f: nextG + octileDistance(nextX, nextZ, end.x, end.z),
      });
    }
  }

  return null;
}

function nearestOpenGridPoint(
  requested: GridPoint,
  isBlocked: (x: number, z: number) => boolean,
  width: number,
  height: number,
  canConnect?: (point: GridPoint) => boolean,
): GridPoint | null {
  if (
    !isBlocked(requested.x, requested.z)
    && (!canConnect || canConnect(requested))
  ) {
    return requested;
  }

  const maxRadius = Math.min(8, Math.max(width, height));
  for (let radius = 1; radius <= maxRadius; radius++) {
    let best: GridPoint | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const x = requested.x + dx;
        const z = requested.z + dz;
        if (x < 0 || z < 0 || x >= width || z >= height || isBlocked(x, z)) continue;
        const point = { x, z };
        if (canConnect && !canConnect(point)) continue;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= bestDistanceSq) continue;
        best = point;
        bestDistanceSq = distanceSq;
      }
    }
    if (best) return best;
  }
  return null;
}

function smoothGridPath(
  path: readonly PointXZ[],
  isBlocked: AgentObstacleTest,
): PointXZ[] {
  if (path.length <= 2) return path.map(copyPoint);
  const smoothed: PointXZ[] = [copyPoint(path[0])];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1 && !segmentIsClear(path[anchor], path[next], isBlocked)) {
      next -= 1;
    }
    smoothed.push(copyPoint(path[next]));
    anchor = next;
  }
  return smoothed;
}

function segmentIsClear(
  start: PointXZ,
  end: PointXZ,
  isBlocked: AgentObstacleTest,
): boolean {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  if (length <= 1e-6) return !isBlocked(start.x, start.z);
  const steps = Math.max(1, Math.ceil(length / NAV_SEGMENT_SAMPLE_M));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    if (isBlocked(
      start.x + (end.x - start.x) * t,
      start.z + (end.z - start.z) * t,
    )) {
      return false;
    }
  }
  return true;
}

function reconstructGridPath(
  endKey: number,
  parents: Int32Array,
  width: number,
): GridPoint[] {
  const reversed: GridPoint[] = [];
  let key = endKey;
  while (key >= 0) {
    reversed.push({ x: key % width, z: Math.floor(key / width) });
    key = parents[key];
  }
  reversed.reverse();
  return reversed;
}

function worldToGrid(
  point: PointXZ,
  originX: number,
  originZ: number,
  width: number,
  height: number,
): GridPoint {
  return {
    x: clampInt(Math.round((point.x - originX) / NAV_GRID_STEP_M), 0, width - 1),
    z: clampInt(Math.round((point.z - originZ) / NAV_GRID_STEP_M), 0, height - 1),
  };
}

function octileDistance(x: number, z: number, endX: number, endZ: number): number {
  const dx = Math.abs(endX - x);
  const dz = Math.abs(endZ - z);
  return CARDINAL_COST * (dx + dz)
    + (DIAGONAL_COST - 2 * CARDINAL_COST) * Math.min(dx, dz);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function copyPoint(point: PointXZ): PointXZ {
  return { x: point.x, z: point.z };
}

function pushDistinct(path: PointXZ[], point: PointXZ): void {
  const previous = path[path.length - 1];
  if (previous && Math.hypot(previous.x - point.x, previous.z - point.z) <= 1e-5) return;
  path.push(copyPoint(point));
}

class MinHeap {
  private readonly values: SearchNode[] = [];

  get size(): number {
    return this.values.length;
  }

  push(node: SearchNode): void {
    this.values.push(node);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].f <= node.f) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = node;
  }

  pop(): SearchNode | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const smaller = right < this.values.length
        && this.values[right].f < this.values[left].f
        ? right
        : left;
      if (this.values[smaller].f >= last.f) break;
      this.values[index] = this.values[smaller];
      index = smaller;
    }
    this.values[index] = last;
    return first;
  }
}
