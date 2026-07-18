import { getBuildingDefinition } from '../buildings.ts';
import type { InspectableTarget } from '../types.ts';
import { buildingLaborView, buildingRoadAccessRow } from './buildingCommon.ts';
import type { InspectorRenderContext, InspectorView } from './renderInspectableTarget.ts';

export function renderConstructionInspector(
  target: Extract<InspectableTarget, { kind: 'building' }>,
  context: InspectorRenderContext,
): InspectorView {
  const { building } = target;
  const definition = getBuildingDefinition(building.kind);
  const inbound = context.worldQueries.getInboundSupplyTrip(building);
  const progress = Math.round(building.constructionProgress * 100);
  const timberPending = Math.max(
    0,
    building.constructionReservedTimber - building.constructionTreasuryTimber,
  );
  const stonePending = Math.max(
    0,
    building.constructionReservedStone - building.constructionTreasuryStone,
  );
  const hasUndelivered = building.constructionReservedTimber > 1e-6
    || building.constructionReservedStone > 1e-6;
  const roadAccess = context.worldQueries.getRoadAccessLabel(building.x, building.z);

  let statusText = `${progress}% built`;
  let statusState = 'active';
  if (building.assignedLabor <= 0) {
    statusText = 'Waiting for builders';
    statusState = 'warning';
  } else if (inbound) {
    statusText = `Receiving ${inbound.cargoKind}`;
  } else if (
    (timberPending > 1e-6 || stonePending > 1e-6)
    && definition.requiresRoad
    && (roadAccess === 'No road nearby' || roadAccess.startsWith('Not connected'))
  ) {
    statusText = 'Waiting for a road connection';
    statusState = 'warning';
  } else if (timberPending > 1e-6 || stonePending > 1e-6) {
    statusText = 'Waiting for a staffed material source';
    statusState = 'warning';
  } else if (hasUndelivered) {
    statusText = 'Moving founders’ reserve onto the site';
  } else {
    statusText = `${progress}% built · materials ready`;
  }

  const origin = inbound ? context.worldQueries.getBuilding(inbound.buildingId) : null;
  const incomingLabel = inbound
    ? `${inbound.cargoKind} cart from ${
        origin ? getBuildingDefinition(origin.kind).label : 'material store'
      }`
    : 'None';

  return {
    eyebrow: 'Construction site',
    title: definition.label,
    statusText,
    statusState,
    detailsHtml: `
      <li><span>Builder progress</span><span>${progress}%</span></li>
      <li><span>Timber delivered</span><span>${formatAmount(building.constructionDeliveredTimber)} / ${formatAmount(building.constructionRequiredTimber)}</span></li>
      <li><span>Stone delivered</span><span>${formatAmount(building.constructionDeliveredStone)} / ${formatAmount(building.constructionRequiredStone)}</span></li>
      <li><span>Incoming haul</span><span>${incomingLabel}</span></li>
      <li><span>Reserved at stores</span><span>${formatAmount(timberPending)} timber · ${formatAmount(stonePending)} stone</span></li>
      <li><span>Founders’ reserve</span><span>${formatAmount(building.constructionTreasuryTimber)} timber · ${formatAmount(building.constructionTreasuryStone)} stone</span></li>
      ${buildingRoadAccessRow(context.worldQueries, building)}
    `,
    demolish: {
      visible: true,
      label: 'Cancel construction',
      hint: 'Cancels immediately. Undelivered reservations are released; delivered materials are salvaged at the usual demolition rate.',
    },
    labor: buildingLaborView(building, context.populationStats),
  };
}

function formatAmount(value: number): string {
  return value < 10 && Math.abs(value - Math.round(value)) > 0.01
    ? value.toFixed(1)
    : Math.round(value).toString();
}
