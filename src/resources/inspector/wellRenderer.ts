import { WELL_BASE_REFILL_PER_SEC, BUILDING_STORAGE_CAPS } from '../../generated/gameBalance.ts';
import { getBuildingCost } from '../buildingEconomy.ts';
import type { InspectableTarget } from '../types.ts';
import {
  buildingCostRows,
  buildingDemolishHint,
  buildingWorkRadiusRow,
} from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';
import { hiddenLabor } from './renderInspectableTarget.ts';
import { hydrologyGradeLabel, sampleHydrologyScore, wellCapacityFromHydrology } from '../../hydrology/sampleHydrology.ts';

export function renderWellInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const label = context.worldQueries.getBuildingLabel(building.kind);
  const cost = getBuildingCost(building.kind);
  const hydrology = sampleHydrologyScore(context.worldQueries.getRiverField(), building.x, building.z);
  const capacity = building.waterCapacity > 0
    ? building.waterCapacity
    : wellCapacityFromHydrology(BUILDING_STORAGE_CAPS.well.water ?? 100, hydrology);
  const fillPct = capacity > 0 ? Math.round((building.water / capacity) * 100) : 0;
  const refillPerSec = WELL_BASE_REFILL_PER_SEC * hydrology;
  const servedHomes = context.worldQueries.countResidencesInWellRange(building);

  return {
    eyebrow: 'Building',
    title: label,
    statusText: building.water + 1e-6 >= capacity
      ? `Full — supplying ${servedHomes} home${servedHomes === 1 ? '' : 's'} in range`
      : `Refilling — ${fillPct}% (${Math.round(building.water)} / ${Math.round(capacity)} water)`,
    statusState: building.water > capacity * 0.2 ? 'active' : 'idle',
    detailsHtml: `
      ${buildingCostRows(building.kind, cost)}
      <li><span>Hydrology</span><span>${hydrologyGradeLabel(hydrology)} (${Math.round(hydrology * 100)}%)</span></li>
      <li><span>Stored water</span><span>${Math.round(building.water)} / ${Math.round(capacity)}</span></li>
      <li><span>Refill rate</span><span>${refillPerSec.toFixed(2)} / sec</span></li>
      ${buildingWorkRadiusRow(building.kind)}
      <li><span>Homes in range</span><span>${servedHomes}</span></li>
    `,
    demolish: {
      visible: true,
      hint: buildingDemolishHint(building.kind),
    },
    labor: hiddenLabor(),
  };
}
