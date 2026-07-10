export type Point2 = {
  x: number;
  z: number;
};

export function distance2(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function midpoint2(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) * 0.5, z: (a.z + b.z) * 0.5 };
}

export function lerp2(a: Point2, b: Point2, t: number): Point2 {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function splitEdge2(start: Point2, end: Point2, segments: number): Point2[] {
  const points: Point2[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push(lerp2(start, end, i / segments));
  }
  return points;
}

export function polygonArea2(points: Point2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    sum += points[i].x * next.z - next.x * points[i].z;
  }
  return Math.abs(sum) * 0.5;
}

export function isPointInPolygon2(point: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersects =
      zi > point.z !== zj > point.z
      && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function cross2(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

/** True when four corners form a simple convex quad in winding order. */
export function isConvexQuad2(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const signs = [
    Math.sign(cross2(a, b, c)),
    Math.sign(cross2(b, c, d)),
    Math.sign(cross2(c, d, a)),
    Math.sign(cross2(d, a, b)),
  ];
  if (signs.some((value) => value === 0)) return false;
  return signs.every((value) => value === signs[0]);
}

export function normalize2(v: Point2): Point2 {
  const length = Math.hypot(v.x, v.z);
  if (length <= 1e-6) return { x: 0, z: 0 };
  return { x: v.x / length, z: v.z / length };
}

export function subtract2(a: Point2, b: Point2): Point2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function add2(a: Point2, b: Point2): Point2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function scale2(v: Point2, scalar: number): Point2 {
  return { x: v.x * scalar, z: v.z * scalar };
}

export function perpendicularLeft2(v: Point2): Point2 {
  return { x: -v.z, z: v.x };
}

export function perpendicularRight2(v: Point2): Point2 {
  return { x: v.z, z: -v.x };
}

export function orientedFootprintFits(
  center: Point2,
  yaw: number,
  halfWidth: number,
  halfDepth: number,
  polygon: Point2[],
): boolean {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const corners: Point2[] = [
    { x: -halfWidth, z: -halfDepth },
    { x: halfWidth, z: -halfDepth },
    { x: halfWidth, z: halfDepth },
    { x: -halfWidth, z: halfDepth },
  ].map((local) => ({
    x: center.x + local.x * cos - local.z * sin,
    z: center.z + local.x * sin + local.z * cos,
  }));
  return corners.every((corner) => isPointInPolygon2(corner, polygon));
}
