import { getBuildingDefinition } from '../buildings.ts';
import type { InspectableTarget } from '../types.ts';
import { buildingDemolishHint, buildingLaborView, buildingRoadAccessRow, buildingStorageRows, buildingWorkRadiusRow } from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

const PROCESS: Record<string, string> = {
  grain_field: 'Legacy fixed field', threshing_barn: 'Farmstead crew works nearby drawn fields',
  watermill: 'Grain + river power → flour', granary: 'Flour + well water + firewood → staple food',
  brewery: 'Grain + water → ale', smokehouse: 'Fresh food + firewood → preserved food',
  apiary: 'Forest forage → honey + food', vineyard: 'Terraced vines → wine + food',
  monastery: 'Tithes + alms → charity, feasts, pilgrimages', carpenter: 'Timber → construction and cartwright support',
  ferry_landing: 'River crossing → regional trade income',
};

export function renderExpandedBuildingInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const definition = getBuildingDefinition(building.kind);
  const active = definition.acceptsLabor ? building.assignedLabor > 0 : true;
  return {
    eyebrow: 'Settlement building', title: definition.label,
    statusText: active ? 'Operating' : 'Awaiting workers', statusState: active ? 'active' : 'warning',
    detailsHtml: `<li><span>Role</span><span>${PROCESS[building.kind] ?? 'Settlement service'}</span></li>${buildingStorageRows(building, building.kind)}${buildingRoadAccessRow(context.worldQueries, building)}${buildingWorkRadiusRow(building.kind)}`,
    demolish: { visible: true, hint: buildingDemolishHint(building.kind) },
    labor: buildingLaborView(building, context.populationStats),
  };
}
