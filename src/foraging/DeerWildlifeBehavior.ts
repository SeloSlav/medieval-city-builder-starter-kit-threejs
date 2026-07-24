export type DeerBehaviorMode = 'idle' | 'graze' | 'walk' | 'flee';

export type DeerSex = 'doe' | 'stag';

export type DeerSexCounts = {
  doeCount: number;
  stagCount: number;
};

export type DeerObserver = {
  x: number;
  z: number;
  crouching: boolean;
};

export type DeerMotionState = {
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  targetX: number;
  targetZ: number;
  heading: number;
  speed: number;
  mode: DeerBehaviorMode;
  modeTimer: number;
  fleeBias: number;
};

export type DeerBehaviorContext = {
  observer: DeerObserver | null;
  random: () => number;
  isBlockedAt?: (x: number, z: number) => boolean;
};

export const DEER_FLEE_TRIGGER_DISTANCE = 19;
export const DEER_FLEE_RELEASE_DISTANCE = 32;
export const DEER_ROAM_RADIUS = 27;
export const DEER_FLEE_BOUNDARY_RADIUS = 52;
export const DEER_CROUCH_DETECTION_HALF_ANGLE = Math.PI * (65 / 180);

const TAU = Math.PI * 2;
const WALK_SPEED = 1.25;
const FLEE_SPEED = 7.1;
const MIN_REST_SECONDS = 2.2;
const MAX_REST_SECONDS = 6.8;

export function updateDeerMotion(
  state: DeerMotionState,
  dtSeconds: number,
  context: DeerBehaviorContext,
): void {
  const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
  if (dt <= 0) return;

  const observerDistance = context.observer
    ? Math.hypot(state.x - context.observer.x, state.z - context.observer.z)
    : Number.POSITIVE_INFINITY;

  if (context.observer && canDeerDetectObserver(state, context.observer, observerDistance)) {
    if (state.mode !== 'flee') beginFlee(state);
    state.modeTimer = Math.max(state.modeTimer, 1.15);
  }

  state.modeTimer -= dt;

  if (state.mode === 'flee') {
    updateFleeing(state, dt, observerDistance, context);
    return;
  }

  if (state.mode === 'walk') {
    updateWalking(state, dt, context);
    return;
  }

  state.speed = approach(state.speed, 0, 4.5 * dt);
  if (state.modeTimer <= 0) beginWalk(state, context);
}

export function chooseInitialDeerMode(random: () => number): DeerBehaviorMode {
  return random() < 0.56 ? 'graze' : 'idle';
}

export function chooseRestDuration(random: () => number): number {
  return lerp(MIN_REST_SECONDS, MAX_REST_SECONDS, random());
}

/**
 * Standing players alert deer from any direction inside the awareness radius.
 * Crouching limits awareness to a forward cone, leaving a true blind approach
 * behind the animal until it turns enough to see the player.
 */
export function canDeerDetectObserver(
  state: Pick<DeerMotionState, 'x' | 'z' | 'heading'>,
  observer: DeerObserver,
  knownDistance?: number,
): boolean {
  const dx = observer.x - state.x;
  const dz = observer.z - state.z;
  const distance = knownDistance ?? Math.hypot(dx, dz);
  if (distance > DEER_FLEE_TRIGGER_DISTANCE) return false;
  if (!observer.crouching) return true;
  if (distance < 0.001) return true;

  const inverseDistance = 1 / distance;
  const directionToObserverX = dx * inverseDistance;
  const directionToObserverZ = dz * inverseDistance;
  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  const facingDot = forwardX * directionToObserverX + forwardZ * directionToObserverZ;
  return facingDot >= Math.cos(DEER_CROUCH_DETECTION_HALF_ANGLE);
}

/**
 * Keeps small resource herds doe-heavy while guaranteeing that mixed herds show
 * both models. Five animals resolve to one stag and four does.
 */
export function herdSexCounts(count: number): DeerSexCounts {
  const herdSize = Math.max(0, Math.floor(count));
  if (herdSize === 0) return { doeCount: 0, stagCount: 0 };
  if (herdSize === 1) return { doeCount: 1, stagCount: 0 };

  const stagCount = Math.min(herdSize - 1, Math.max(1, Math.round(herdSize * 0.2)));
  return {
    doeCount: herdSize - stagCount,
    stagCount,
  };
}

export function createHerdSexDistribution(count: number, random: () => number): DeerSex[] {
  const { doeCount, stagCount } = herdSexCounts(count);
  const distribution: DeerSex[] = [
    ...Array.from({ length: stagCount }, () => 'stag' as const),
    ...Array.from({ length: doeCount }, () => 'doe' as const),
  ];

  for (let index = distribution.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = distribution[index];
    distribution[index] = distribution[swapIndex];
    distribution[swapIndex] = current;
  }
  return distribution;
}

function updateWalking(
  state: DeerMotionState,
  dt: number,
  context: DeerBehaviorContext,
): void {
  const dx = state.targetX - state.x;
  const dz = state.targetZ - state.z;
  const targetDistance = Math.hypot(dx, dz);
  if (targetDistance < 0.8 || state.modeTimer <= 0) {
    beginRest(state, context.random);
    return;
  }

  state.heading = turnToward(state.heading, Math.atan2(dx, dz), 2.2 * dt);
  state.speed = approach(state.speed, WALK_SPEED, 1.8 * dt);
  tryMove(state, dt, context, false);
}

function updateFleeing(
  state: DeerMotionState,
  dt: number,
  observerDistance: number,
  context: DeerBehaviorContext,
): void {
  if (!context.observer || (observerDistance >= DEER_FLEE_RELEASE_DISTANCE && state.modeTimer <= 0)) {
    beginWalk(state, context, true);
    return;
  }

  if (observerDistance < DEER_FLEE_RELEASE_DISTANCE) {
    state.modeTimer = Math.max(state.modeTimer, 0.35);
  }

  let desiredX = state.x - context.observer.x;
  let desiredZ = state.z - context.observer.z;
  const observerVectorLength = Math.hypot(desiredX, desiredZ);
  if (observerVectorLength < 0.001) {
    desiredX = Math.sin(state.heading);
    desiredZ = Math.cos(state.heading);
  } else {
    desiredX /= observerVectorLength;
    desiredZ /= observerVectorLength;
  }

  const homeDx = state.homeX - state.x;
  const homeDz = state.homeZ - state.z;
  const homeDistance = Math.hypot(homeDx, homeDz);
  if (homeDistance > DEER_ROAM_RADIUS) {
    const homeWeight = smoothstep(DEER_ROAM_RADIUS, DEER_FLEE_BOUNDARY_RADIUS, homeDistance) * 0.88;
    const homeLength = Math.max(homeDistance, 0.001);
    desiredX = lerp(desiredX, homeDx / homeLength, homeWeight);
    desiredZ = lerp(desiredZ, homeDz / homeLength, homeWeight);
  }

  const desiredHeading = Math.atan2(desiredX, desiredZ) + state.fleeBias;
  state.heading = turnToward(state.heading, desiredHeading, 4.6 * dt);
  state.speed = approach(state.speed, FLEE_SPEED, 7.5 * dt);
  tryMove(state, dt, context, true);
}

function tryMove(
  state: DeerMotionState,
  dt: number,
  context: DeerBehaviorContext,
  fleeing: boolean,
): void {
  const nextX = state.x + Math.sin(state.heading) * state.speed * dt;
  const nextZ = state.z + Math.cos(state.heading) * state.speed * dt;
  if (context.isBlockedAt?.(nextX, nextZ)) {
    const turnDirection = context.random() < 0.5 ? -1 : 1;
    state.heading = wrapAngle(state.heading + turnDirection * (fleeing ? 1.18 : 0.82));
    if (!fleeing) beginWalk(state, context);
    return;
  }

  state.x = nextX;
  state.z = nextZ;
}

function beginFlee(state: DeerMotionState): void {
  state.mode = 'flee';
  state.modeTimer = 1.15;
}

function beginWalk(
  state: DeerMotionState,
  context: DeerBehaviorContext,
  returningHome = false,
): void {
  state.mode = 'walk';
  state.modeTimer = lerp(7.5, 15, context.random());

  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = context.random() * TAU;
    const radius = returningHome
      ? Math.sqrt(context.random()) * DEER_ROAM_RADIUS * 0.42
      : Math.sqrt(context.random()) * DEER_ROAM_RADIUS;
    const x = state.homeX + Math.sin(angle) * radius;
    const z = state.homeZ + Math.cos(angle) * radius;
    if (context.isBlockedAt?.(x, z)) continue;
    state.targetX = x;
    state.targetZ = z;
    return;
  }

  state.targetX = state.homeX;
  state.targetZ = state.homeZ;
}

function beginRest(state: DeerMotionState, random: () => number): void {
  state.mode = random() < 0.62 ? 'graze' : 'idle';
  state.modeTimer = chooseRestDuration(random);
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

function turnToward(current: number, target: number, maxDelta: number): number {
  const delta = wrapAngle(target - current);
  return wrapAngle(current + Math.max(-maxDelta, Math.min(maxDelta, delta)));
}

function wrapAngle(angle: number): number {
  let wrapped = (angle + Math.PI) % TAU;
  if (wrapped < 0) wrapped += TAU;
  return wrapped - Math.PI;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
