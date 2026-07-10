/**
 * Horizontal compass heading driven from a camera forward vector each frame.
 *
 * Zero radians = facing world +Z ("north"). Angle increases clockwise (toward +X / east).
 */
let headingRad = 0;

const listeners = new Set<() => void>();

export function getCompassHeadingRad(): number {
  return headingRad;
}

export function subscribeCompassHeading(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function publishCompassHeadingFromForwardXZ(xzForwardX: number, xzForwardZ: number): void {
  const len = Math.hypot(xzForwardX, xzForwardZ);
  if (len < 1e-9) return;
  headingRad = Math.atan2(xzForwardX / len, xzForwardZ / len);
  if (listeners.size === 0) return;
  for (const listener of listeners) listener();
}

export function resetCompassHeading(): void {
  headingRad = 0;
}

export function publishCompassHeadingFromYawRad(yawRad: number): void {
  publishCompassHeadingFromForwardXZ(-Math.sin(yawRad), -Math.cos(yawRad));
}
