import assert from 'node:assert/strict';
import { worldDirectionToMapRotation, worldToMapPercent } from '../src/map/worldToMapPercent.ts';

const EPSILON = 1e-12;
const bounds = { minX: -100, maxX: 100, minZ: -200, maxZ: 200 };

assert.deepEqual(
  worldToMapPercent(0, 0, bounds),
  { x: 50, y: 50 },
  'the world origin should be centered on the minimap',
);
assert.deepEqual(
  worldToMapPercent(100, 200, bounds),
  { x: 100, y: 100 },
  'world +X should map right and world +Z should map down',
);

const cardinalDirections = [
  { label: 'world -Z points up', x: 0, z: -1, expected: 0 },
  { label: 'world +X points right', x: 1, z: 0, expected: Math.PI / 2 },
  { label: 'world +Z points down', x: 0, z: 1, expected: Math.PI },
  { label: 'world -X points left', x: -1, z: 0, expected: -Math.PI / 2 },
] as const;

for (const direction of cardinalDirections) {
  const actual = worldDirectionToMapRotation(direction.x, direction.z);
  assert.ok(
    Math.abs(actual - direction.expected) < EPSILON,
    `${direction.label}: expected ${direction.expected}, received ${actual}`,
  );
}

console.log('test:world-map passed');
