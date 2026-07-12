import { BUILDING_ROAD_ACCESS_DISTANCE } from '../generated/gameBalance.ts';
import { roadPathRoute } from '../logistics/roadLogistics.ts';
import { MAIN_HOUSE_DEPTH } from '../residences/burgageLayout.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import type { ResidenceState } from '../resources/types.ts';
import {
  distancePointToPolylineXZ,
  polylineLengthXZ,
  samplePolylineXZ,
  type PointXZ,
} from '../utils/pathGeometry.ts';
import { hashStringSeed, mulberry32 } from '../utils/random.ts';

export type { PointXZ as RoadPoint };

export const MAX_VILLAGERS_TOTAL = 48;
export const MAX_VILLAGERS_PER_RESIDENCE = 4;

export function residenceDoorPosition(residence: ResidenceState): PointXZ {
  const doorOffset = MAIN_HOUSE_DEPTH * 0.5 - 0.1;
  const sin = Math.sin(residence.yaw);
  const cos = Math.cos(residence.yaw);
  return {
    x: residence.x + sin * doorOffset,
    z: residence.z + cos * doorOffset,
  };
}

export function computeVillagerSlots(residences: readonly ResidenceState[]): Map<string, number> {
  const slots = new Map<string, number>();
  let total = 0;

  for (const residence of residences) {
    if (residence.abandoned || residence.population <= 0) continue;
    const count = Math.min(
      MAX_VILLAGERS_PER_RESIDENCE,
      Math.max(1, Math.ceil(residence.population / 2)),
    );
    slots.set(residence.id, count);
    total += count;
  }

  if (total <= MAX_VILLAGERS_TOTAL) return slots;

  const entries = [...slots.entries()].sort((a, b) => b[1] - a[1]);
  const trimmed = new Map<string, number>();
  let remaining = MAX_VILLAGERS_TOTAL;
  for (const [id, count] of entries) {
    if (remaining <= 0) break;
    const kept = Math.min(count, remaining);
    trimmed.set(id, kept);
    remaining -= kept;
  }
  return trimmed;
}

export function findNearestRoadEdgePath(
  network: RoadNetwork,
  x: number,
  z: number,
): { path: PointXZ[]; distance: number } | null {
  let best: { path: PointXZ[]; distance: number } | null = null;

  for (const edge of network.edges.values()) {
    if (edge.sampledPath.length < 2) continue;
    const path = edge.sampledPath.map((point) => ({ x: point.x, z: point.z }));
    const distance = distancePointToPolylineXZ(x, z, edge.sampledPath);
    if (!best || distance < best.distance) {
      best = { path, distance };
    }
  }

  return best;
}

export function pickVillagerWalkPath(
  residence: ResidenceState,
  residences: readonly ResidenceState[],
  network: RoadNetwork,
  seed: number,
  nearestEdge: { path: PointXZ[]; distance: number } | null,
): PointXZ[] | null {
  const rng = mulberry32(seed);
  const door = residenceDoorPosition(residence);

  const candidates = residences.filter(
    (other) =>
      other.id !== residence.id
      && !other.abandoned
      && other.population > 0,
  );
  if (candidates.length > 0) {
    const shuffled = [...candidates].sort(() => rng() - 0.5);
    for (const target of shuffled.slice(0, 6)) {
      const targetDoor = residenceDoorPosition(target);
      const route = roadPathRoute(network, door.x, door.z, targetDoor.x, targetDoor.z);
      if (!route || route.distance < 6 || route.distance > 140) continue;
      return route.polyline;
    }
  }

  return pickLocalRoadWander(door, nearestEdge, seed);
}

function pickLocalRoadWander(
  door: PointXZ,
  nearestEdge: { path: PointXZ[]; distance: number } | null,
  seed: number,
): PointXZ[] | null {
  if (!nearestEdge || nearestEdge.distance > BUILDING_ROAD_ACCESS_DISTANCE) return null;

  const rng = mulberry32(seed ^ 0x9e3779b9);
  const totalLength = polylineLengthXZ(nearestEdge.path);
  if (totalLength < 8) return null;

  const wanderLength = 12 + rng() * 18;
  const startDistance = rng() * Math.max(1, totalLength - wanderLength);
  const endDistance = Math.min(totalLength, startDistance + wanderLength);
  const start = samplePolylineXZ(nearestEdge.path, startDistance);
  const end = samplePolylineXZ(nearestEdge.path, endDistance);
  if (!start || !end) return null;

  return [
    door,
    { x: start.x, z: start.z },
    { x: end.x, z: end.z },
    { x: start.x, z: start.z },
    door,
  ];
}

export function pickIdleOffset(residenceId: string, slotIndex: number): { x: number; z: number; yaw: number } {
  const rng = mulberry32(hashStringSeed(`${residenceId}:${slotIndex}`));
  const radius = 0.35 + rng() * 0.85;
  const angle = rng() * Math.PI * 2;
  return {
    x: Math.sin(angle) * radius,
    z: Math.cos(angle) * radius,
    yaw: angle + Math.PI + (rng() - 0.5) * 0.6,
  };
}

export function pickWalkSpeed(seed: number): number {
  const rng = mulberry32(seed);
  return 1.05 + rng() * 0.35;
}

export function pickIdleDuration(seed: number): number {
  const rng = mulberry32(seed);
  return 2.5 + rng() * 6.5;
}

export function pickVillagerAppearanceSeed(residenceId: string, slotIndex: number): number {
  return hashStringSeed(`villager:${residenceId}:${slotIndex}`);
}
