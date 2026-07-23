import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FpCollisionWorld } from '../src/camera/fp/fpCollisionWorld.ts';
import {
  createFpLocomotionState,
  FP_WALK_FOOT_RADIUS_XZ,
  FP_WALK_STEP_UP_MARGIN,
  stepFpLocomotion,
} from '../src/camera/fp/fpLocomotion.ts';

const root = new THREE.Group();
root.name = 'Backyard gardens';

const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 4));
wall.position.set(0, 1, 0);
root.add(wall);

const lowStone = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 1));
lowStone.position.set(3, 0.35, 0);
root.add(lowStone);

const fence = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 3));
fence.position.set(6, 0.55, 0);
const lowFenceRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 3));
lowFenceRail.position.set(7.5, 0.55, 0);
const fenceRoot = new THREE.Group();
fenceRoot.name = 'Burgage fencing';
fenceRoot.add(fence, lowFenceRail);

const buildingRoot = new THREE.Group();
buildingRoot.name = 'Building markers';
const building = new THREE.Group();
building.userData.fpCollisionAggregate = true;
building.position.set(12, 0, 0);
building.rotation.y = Math.PI * 0.25;
const buildingShell = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2));
buildingShell.position.y = 2;
building.add(buildingShell);
buildingRoot.add(building);

const collisionWorld = new FpCollisionWorld({
  getStaticRoots: () => [root, fenceRoot, buildingRoot],
  getHeightAt: () => 0,
  getRockObstaclesNear: (x, _z, radius) => (
    Math.abs(x - 9) <= radius
      ? [{
          x: 9,
          z: 0,
          scale: 1,
          collisionRadius: 0.8,
          collisionMinY: 0,
          collisionMaxY: 1,
        }]
      : []
  ),
});

function resolveAt(
  x: number,
  y: number,
  velocity: THREE.Vector3,
  grounded: boolean,
): THREE.Vector3 {
  collisionWorld.prepare(x, 0);
  const position = new THREE.Vector3(x, y, 0);
  collisionWorld.resolvePlayer(position, x - velocity.x * 0.01, 0, velocity, {
    bodyHeight: 1.78,
    footRadius: FP_WALK_FOOT_RADIUS_XZ,
    maxStepHeight: FP_WALK_STEP_UP_MARGIN,
    grounded,
  });
  return position;
}

{
  const velocity = new THREE.Vector3(3, 0, 1.5);
  const position = resolveAt(-0.6, 0.034, velocity, true);
  assert.ok(position.x <= -0.73, 'wall should push the player outside its face');
  assert.ok(Math.abs(velocity.x) < 1e-8, 'wall should remove velocity into its face');
  assert.equal(velocity.z, 1.5, 'wall collision should preserve tangential sliding velocity');
}

{
  collisionWorld.prepare(3, 0);
  const support = collisionWorld.sampleSupportTopY(
    3,
    0,
    1.084,
    0.034,
    FP_WALK_FOOT_RADIUS_XZ,
    FP_WALK_STEP_UP_MARGIN,
    'ground',
  );
  assert.ok(Math.abs(support - 0.7) < 1e-6, 'low stones should provide a walk/jump support top');

  const velocity = new THREE.Vector3(2, 0, 0);
  const position = resolveAt(2.6, 0.034, velocity, true);
  assert.equal(position.x, 2.6, 'step-height obstacles should not act as lateral walls');
}

{
  const groundedVelocity = new THREE.Vector3(2, 0, 0);
  const groundedPosition = resolveAt(5.9, 0.034, groundedVelocity, true);
  assert.ok(groundedPosition.x < 5.8, 'a fence taller than step height should block walking');

  const airborneVelocity = new THREE.Vector3(2, 0, 0);
  const airbornePosition = resolveAt(5.9, 1.16, airborneVelocity, false);
  assert.equal(airbornePosition.x, 5.9, 'a jump should clear a fence once the feet are above it');

  const lowRailVelocity = new THREE.Vector3(2, 0, 0);
  const lowRailPosition = resolveAt(7.45, 0.034, lowRailVelocity, true);
  assert.ok(
    lowRailPosition.x < 7.22,
    'low fence rails should remain barriers instead of becoming automatic steps',
  );
}

{
  collisionWorld.prepare(9, 0);
  const rockSupport = collisionWorld.sampleSupportTopY(
    9,
    0,
    2,
    1.2,
    FP_WALK_FOOT_RADIUS_XZ,
    FP_WALK_STEP_UP_MARGIN,
    'descent',
  );
  assert.equal(rockSupport, 1, 'spatially queried rocks should be landable support surfaces');
}

{
  const velocity = new THREE.Vector3(2, 0, 0);
  const position = resolveAt(10.5, 0.034, velocity, true);
  assert.ok(
    Math.hypot(position.x - 10.5, position.z) > 0.01,
    'aggregate rotated building bounds should prevent entering structures',
  );
}

{
  const state = createFpLocomotionState();
  const position = new THREE.Vector3(-2, 0.034, 0);
  const input = {
    forward: false,
    backward: false,
    left: false,
    right: true,
    sprint: true,
    crouch: false,
    jumpHeld: false,
  };
  const walk = {
    sampleWalkGroundTopY: (
      x: number,
      z: number,
      probeTopY: number,
      phase: 'skip' | 'ground' | 'descent',
    ) => {
      const obstacle = collisionWorld.sampleSupportTopY(
        x,
        z,
        probeTopY,
        probeTopY - 1.05,
        FP_WALK_FOOT_RADIUS_XZ,
        FP_WALK_STEP_UP_MARGIN,
        phase,
      );
      return Math.max(0, obstacle);
    },
    resolveBodyCollisions: (
      nextPosition: THREE.Vector3,
      previousX: number,
      previousZ: number,
      nextState: ReturnType<typeof createFpLocomotionState>,
      bodyHeight: number,
    ) => collisionWorld.resolvePlayer(
      nextPosition,
      previousX,
      previousZ,
      nextState.velocity,
      {
        bodyHeight,
        footRadius: FP_WALK_FOOT_RADIUS_XZ,
        maxStepHeight: FP_WALK_STEP_UP_MARGIN,
        grounded: nextState.grounded,
      },
    ),
  };

  for (let frame = 0; frame < 80; frame++) {
    collisionWorld.prepare(position.x, position.z);
    stepFpLocomotion(state, position, 0, input, 0.05, walk);
  }
  assert.ok(position.x <= -0.72, 'substep collision should prevent sprint tunnelling through walls');
}

console.log('test:first-person-collision passed');
