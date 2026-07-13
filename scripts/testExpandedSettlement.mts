import assert from 'node:assert/strict';
import {
  BUILDING_DEFINITIONS,
  BUILDING_KINDS,
  BUILDING_STORAGE_CAPS,
  RESIDENCE_TIER1_CAPACITY,
  RESIDENCE_TIER2_CAPACITY,
  RESIDENCE_TIER3_CAPACITY,
} from '../src/generated/gameBalance.ts';
import { createDefaultNeeds } from '../src/residences/residenceNeedState.ts';
import { evaluateResidenceNeedRecovery } from '../src/residences/residenceNeeds.ts';
import type { ResidenceState } from '../src/resources/types.ts';
import * as THREE from 'three';
import { createBuildingMesh } from '../src/buildings/BuildingMeshes.ts';
import { createResidenceMesh } from '../src/residences/ResidenceMarkers.ts';

const expanded = [
  'grain_field', 'threshing_barn', 'monastery', 'brewery', 'smokehouse', 'granary',
  'apiary', 'watermill', 'carpenter', 'ferry_landing', 'vineyard',
] as const;
for (const kind of expanded) {
  assert.ok(BUILDING_KINDS.includes(kind), `${kind} must remain a generated buildable kind`);
  assert.ok(BUILDING_DEFINITIONS[kind].label.length > 0, `${kind} needs player-facing copy`);
}
assert.equal(BUILDING_DEFINITIONS.watermill.requiresWaterShore, true);
assert.equal(BUILDING_DEFINITIONS.ferry_landing.requiresWaterShore, true);
assert.equal(BUILDING_DEFINITIONS.monastery.acceptsLabor, false);
assert.ok(BUILDING_STORAGE_CAPS.granary.grain > BUILDING_STORAGE_CAPS.grain_field.grain);
assert.deepEqual([RESIDENCE_TIER1_CAPACITY, RESIDENCE_TIER2_CAPACITY, RESIDENCE_TIER3_CAPACITY], [3, 6, 10]);

const residence = (tier: 1 | 2 | 3): ResidenceState => ({
  id: `tier-${tier}`, zoneId: 'zone', parcelIndex: 0, x: 0, z: 0, yaw: 0,
  population: 1, populationCapacity: tier === 1 ? 3 : tier === 2 ? 6 : 10,
  tier, settlementTicks: 0, needs: createDefaultNeeds(), abandoned: false, householdWealth: 0,
});
const supply = { servingLodgeId: 'lodge', servingWellId: 'well', servingFoodSupplierId: 'food' };
assert.equal(evaluateResidenceNeedRecovery(residence(1), supply).length, 3);
assert.equal(evaluateResidenceNeedRecovery(residence(2), supply).length, 4);
assert.equal(evaluateResidenceNeedRecovery(residence(3), supply).length, 5);

for (const kind of expanded) {
  const model = createBuildingMesh(kind);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  let meshCount = 0;
  model.traverse((object) => { if (object instanceof THREE.Mesh) meshCount += 1; });
  assert.ok(meshCount >= 8, `${kind} needs a modeled silhouette, not a placeholder`);
  assert.ok([size.x, size.y, size.z].every(Number.isFinite), `${kind} bounds must be finite`);
  assert.ok(size.x > 1 && size.y > 1 && size.z > 1, `${kind} must have a visible three-dimensional footprint`);
}

const tierSizes = ([1, 2, 3] as const).map((tier) =>
  new THREE.Box3().setFromObject(createResidenceMesh(42, tier)).getSize(new THREE.Vector3()),
);
assert.ok(tierSizes[0].x < tierSizes[1].x && tierSizes[1].x < tierSizes[2].x);
assert.ok(tierSizes[0].y < tierSizes[1].y && tierSizes[1].y < tierSizes[2].y);

console.log('expanded settlement tests passed');
