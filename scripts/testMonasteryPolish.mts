import assert from 'node:assert/strict';
import {
  MONASTERY_CHARITY_FOOD_PER_DELIVERY,
  MONASTERY_COVERAGE_RADIUS,
} from '../src/generated/gameBalance.ts';
import { validateBuildingPlacement } from '../src/buildings/BuildingPlacementValidation.ts';
import {
  findLinkedMonasteryInCoverage,
  isResidenceInMonasteryCoverage,
  monasteryLinkedToChapel,
} from '../src/logistics/landmarkAccess.ts';
import { clampMonasteryTitheShare } from '../src/economy/monasteryPolicy.ts';
import { createDefaultNeeds } from '../src/residences/residenceNeedState.ts';
import type { BuildingState, ResidenceState } from '../src/resources/types.ts';

function residence(overrides: Partial<ResidenceState> = {}): ResidenceState {
  return {
    id: 'res-1',
    zoneId: 'zone-1',
    parcelIndex: 0,
    x: 10,
    z: 10,
    yaw: 0,
    population: 3,
    populationCapacity: 3,
    settlementTicks: 0,
    needs: createDefaultNeeds(),
    abandoned: false,
    householdWealth: 0,
    tier: 1,
    ...overrides,
  };
}

function building(overrides: Partial<BuildingState>): BuildingState {
  return {
    id: 'building-1',
    kind: 'monastery',
    x: 20,
    z: 10,
    workRadius: MONASTERY_COVERAGE_RADIUS,
    actionCooldown: 0,
    timber: 0,
    firewood: 0,
    stone: 0,
    water: 0,
    food: 0,
    gold: 0,
    waterCapacity: 0,
    assignedLabor: 0,
    ...overrides,
  };
}

const staffedChapel = building({ id: 'chapel-1', kind: 'chapel', x: 10, z: 20, assignedLabor: 1 });
const monastery = building({ id: 'monastery-1', kind: 'monastery', x: 40, z: 10 });
const home = residence();

const connectedProbe = (ax: number, az: number, bx: number, bz: number): number | null => {
  if (ax === home.x && az === home.z && bx === staffedChapel.x && bz === staffedChapel.z) return 12;
  if (ax === home.x && az === home.z && bx === monastery.x && bz === monastery.z) return 24;
  if (ax === monastery.x && az === monastery.z && bx === staffedChapel.x && bz === staffedChapel.z) return 18;
  return null;
};

assert.equal(monasteryLinkedToChapel(monastery, [staffedChapel], connectedProbe), true);
assert.equal(
  findLinkedMonasteryInCoverage(home, [monastery], [staffedChapel], connectedProbe)?.id,
  monastery.id,
);
assert.equal(
  isResidenceInMonasteryCoverage(home, [monastery], [staffedChapel], connectedProbe),
  true,
);

const farProbe = () => 900;
assert.equal(
  isResidenceInMonasteryCoverage(home, [monastery], [staffedChapel], farProbe),
  false,
);

assert.equal(clampMonasteryTitheShare(0.95), 0.8);
assert.equal(clampMonasteryTitheShare(-0.1), 0);
assert.equal(MONASTERY_CHARITY_FOOD_PER_DELIVERY, 4);

const flatResult = validateBuildingPlacement('monastery', 0, 0, {
  buildings: [],
  residences: [],
  burgageZones: [],
  quarries: [],
  foragingNodes: [],
  stockpile: { timber: 999, stone: 999 },
  isWaterAt: () => false,
  getNaturalHeightAt: () => 0,
});
assert.equal(flatResult.ok, false);
if (!flatResult.ok) {
  assert.equal(flatResult.reason, 'requires_hillside');
}

const hillsideHeight = (x: number, z: number) => x * 0.4 + z * 0.25;
const staffedChapelBuilding = building({ id: 'chapel-1', kind: 'chapel', x: 50, z: 50, assignedLabor: 1 });
const populatedResidences = Array.from({ length: 4 }, (_, index) =>
  residence({ id: `res-${index}`, population: 3 }),
);
const hillsideResult = validateBuildingPlacement('monastery', 0, 0, {
  buildings: [staffedChapelBuilding],
  residences: populatedResidences,
  burgageZones: [],
  quarries: [],
  foragingNodes: [],
  stockpile: { timber: 999, stone: 999 },
  isWaterAt: () => false,
  getNaturalHeightAt: hillsideHeight,
});
assert.equal(hillsideResult.ok, true);

const noChapelResult = validateBuildingPlacement('monastery', 0, 0, {
  buildings: [],
  residences: populatedResidences,
  burgageZones: [],
  quarries: [],
  foragingNodes: [],
  stockpile: { timber: 999, stone: 999 },
  isWaterAt: () => false,
  getNaturalHeightAt: hillsideHeight,
});
assert.equal(noChapelResult.ok, false);
if (!noChapelResult.ok) {
  assert.equal(noChapelResult.reason, 'requires_staffed_chapel');
}

const smallParishResult = validateBuildingPlacement('monastery', 0, 0, {
  buildings: [staffedChapelBuilding],
  residences: [residence({ population: 8 })],
  burgageZones: [],
  quarries: [],
  foragingNodes: [],
  stockpile: { timber: 999, stone: 999 },
  isWaterAt: () => false,
  getNaturalHeightAt: hillsideHeight,
});
assert.equal(smallParishResult.ok, false);
if (!smallParishResult.ok) {
  assert.equal(smallParishResult.reason, 'requires_parish_population');
}

console.log('monastery polish tests passed');
