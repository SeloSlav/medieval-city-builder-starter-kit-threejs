import * as THREE from 'three';

export type RockObstacle = {
  x: number;
  z: number;
  scale: number;
};

export function distancePointToPolylineXZ(x: number, z: number, path: THREE.Vector3[]): number {
  let minDistance = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    minDistance = Math.min(minDistance, distancePointToSegmentXZ(x, z, path[i], path[i + 1]));
  }
  return minDistance;
}

export function distancePointToSegmentXZ(x: number, z: number, a: THREE.Vector3, b: THREE.Vector3): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  const t = lengthSq <= 1e-6 ? 0 : THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0, 1);
  const px = a.x + abx * t;
  const pz = a.z + abz * t;
  return Math.hypot(x - px, z - pz);
}

export function isRockNearPath(
  rock: RockObstacle,
  path: THREE.Vector3[],
  roadHalfWidth: number,
  margin = 0.8,
): boolean {
  const rockRadius = rock.scale * 1.35;
  const threshold = roadHalfWidth + rockRadius + margin;
  return distancePointToPolylineXZ(rock.x, rock.z, path) <= threshold;
}
