import assert from 'node:assert/strict';
import {
  FARM_MAX_FIELD_AREA,
  FARM_MIN_FIELD_AREA,
  FARM_MIN_FIELD_EDGE,
  GRANARY_FIREWOOD_PER_CYCLE,
  GRANARY_WATER_PER_CYCLE,
  MILL_WATER_PER_HARVEST,
  WATERMILL_WATER_PER_CYCLE,
} from '../src/generated/gameBalance.ts';
import {
  expectedFieldYield,
  fieldArea,
  fieldEdgeLengths,
  fieldShapeEfficiency,
  moistureSuitability,
  rectangleFromBaseline,
  sampleAverageSlopeDegrees,
} from '../src/farming/farmFieldMath.ts';
import { sampleAuthoritativeHydrologyScore } from '../src/hydrology/sampleAuthoritativeHydrology.ts';

const rectangle = rectangleFromBaseline(
  { x: 0, z: 0 },
  { x: 20, z: 0 },
  { x: 5, z: 20 },
);
assert.ok(rectangle, 'three points should produce a rectangle');
assert.equal(fieldArea(rectangle), 400);
assert.deepEqual(fieldEdgeLengths(rectangle).map(Math.round), [20, 20, 20, 20]);
assert.equal(fieldShapeEfficiency(rectangle), 1);
assert.equal(sampleAverageSlopeDegrees(rectangle, () => 10), 0);
assert.ok(sampleAuthoritativeHydrologyScore(0, 0) >= 0 && sampleAuthoritativeHydrologyScore(0, 0) <= 1);
assert.equal(sampleAuthoritativeHydrologyScore(10_000, 10_000), 0);

const ryeDry = moistureSuitability('rye', 0.38);
const oatsDry = moistureSuitability('oats', 0.38);
const oatsWet = moistureSuitability('oats', 0.58);
assert.ok(ryeDry > oatsDry, 'rye should be the better crop on drier ground');
assert.ok(oatsWet > moistureSuitability('rye', 0.58), 'oats should be the better crop on wetter ground');

const goodYield = expectedFieldYield({
  area: 400,
  crop: 'rye',
  moisture: 0.38,
  fertility: 0.9,
  averageSlopeDegrees: 2,
  corners: rectangle,
});
const poorYield = expectedFieldYield({
  area: 400,
  crop: 'rye',
  moisture: 0.95,
  fertility: 0.4,
  averageSlopeDegrees: 15,
  corners: rectangle,
});
assert.ok(goodYield > poorYield * 3, 'hydrology, fertility, and slope should materially affect harvests');
assert.equal(expectedFieldYield({ area: 400, crop: 'fallow', moisture: 0.5, fertility: 0.5, averageSlopeDegrees: 0, corners: rectangle }), 0);

assert.ok(FARM_MIN_FIELD_AREA >= FARM_MIN_FIELD_EDGE ** 2);
assert.ok(FARM_MAX_FIELD_AREA >= 20 * FARM_MIN_FIELD_AREA);
assert.equal(MILL_WATER_PER_HARVEST, 0, 'lumber should not consume well water');
assert.equal(WATERMILL_WATER_PER_CYCLE, 0, 'a river-powered mill should not consume well water');
assert.ok(GRANARY_WATER_PER_CYCLE > 0, 'bakery production should consume well water');
assert.ok(GRANARY_FIREWOOD_PER_CYCLE > 0, 'bakery production should consume fuel');

console.log('farming and water-chain tests passed');
