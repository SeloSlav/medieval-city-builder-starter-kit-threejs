import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSTRUCTION_DELIVERY_SPEED_MPS,
  CONSTRUCTION_HAUL_PER_WORKER,
  CONSTRUCTION_MAX_BUILDERS,
  CONSTRUCTION_TREASURY_TRANSFER_PER_SEC,
  CONSTRUCTION_WORK_PER_WORKER_PER_SEC,
} from '../src/generated/gameBalance.ts';
import {
  constructionVisualSignature,
  createConstructionSiteMesh,
} from '../src/buildings/ConstructionSiteMesh.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

assert.equal(CONSTRUCTION_MAX_BUILDERS, 4);
assert.ok(CONSTRUCTION_HAUL_PER_WORKER > 0);
assert.ok(CONSTRUCTION_DELIVERY_SPEED_MPS > 0);
assert.ok(CONSTRUCTION_TREASURY_TRANSFER_PER_SEC > 0);
assert.ok(CONSTRUCTION_WORK_PER_WORKER_PER_SEC > 0);

assert.notEqual(
  constructionVisualSignature(0.1, 0.2, 0.2),
  constructionVisualSignature(0.65, 0.8, 1),
  'site signature must change with construction stage and delivered piles',
);

const mesh = createConstructionSiteMesh('village_storehouse', 0.55, 0.7, 1);
assert.equal(mesh.name, 'Construction site');
assert.ok(mesh.children.length >= 10, 'site should contain a foundation, frame, scaffold, and piles');
assert.ok(
  mesh.children.some((child) => child.position.y > 2),
  'mid-stage site should contain raised timber framing',
);

const constructionServer = read('server/src/simulation/construction.rs');
assert.match(constructionServer, /construction_reserved_timber/);
assert.match(constructionServer, /try_start_construction_supply_trip/);
assert.match(constructionServer, /construction_progress/);
assert.match(constructionServer, /complete_site/);

const placementServer = read('server/src/reducers/buildings.rs');
assert.match(placementServer, /construction_complete: false/);
assert.match(placementServer, /construction_treasury_reservation/);
assert.doesNotMatch(
  placementServer.slice(
    placementServer.indexOf('pub fn place_building'),
    placementServer.indexOf('pub fn assign_building_labor'),
  ),
  /spend_aggregate_timber/,
  'building placement must reserve resources instead of consuming them instantly',
);

const simServer = read('server/src/reducers/simulation.rs');
assert.match(simServer, /step_construction_sites/);
assert.match(simServer, /if !building\.construction_complete/);

const woodcutterServer = read('server/src/simulation/woodcutters_lodge.rs');
assert.match(
  woodcutterServer,
  /available_unreserved_building_timber/,
  'firewood processing must not consume timber reserved for construction',
);

const generatedBuilding = read('src/generated/building_table.ts');
for (const field of [
  'constructionComplete',
  'constructionProgress',
  'constructionRequiredTimber',
  'constructionDeliveredStone',
  'constructionReservedTimber',
  'constructionTreasuryStone',
]) {
  assert.match(generatedBuilding, new RegExp(field), `generated binding missing ${field}`);
}

console.log('construction logistics tests passed');
