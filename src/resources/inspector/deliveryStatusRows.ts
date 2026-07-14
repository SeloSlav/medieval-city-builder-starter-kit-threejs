import {
  cargoKindLabel,
  formatTripBuildingDestinationLabel,
  formatTripDestinationLabel,
  formatTripPhaseLabel,
  tripRemainingSeconds,
  type DeliveryTripState,
} from '../../logistics/deliveryTrips.ts';
import { formatDeliveryRoadDistance, formatDeliveryTripDuration } from '../../logistics/deliveryLogistics.ts';
import type { BuildingState, ResidenceState } from '../types.ts';
import { formatCooldown } from './woodcuttersLodgeStatus.ts';

export type DeliveryStatusContext = {
  getRoadPathDistance(ax: number, az: number, bx: number, bz: number): number | null;
  getResidence(id: string): ResidenceState | null;
  getBuilding(id: string): BuildingState | null;
  getBuildingLabel(kind: BuildingState['kind']): string;
  getActiveTripPathDistance(trip: DeliveryTripState): number | null;
};

export function renderOutboundDeliveryRows(
  activeTrip: DeliveryTripState | null,
  tripRemaining: number | null,
  destinationLabel: string,
  pathDistance: number | null,
  plannedTripSeconds: number,
  cargoPerTrip: string | null,
  context: DeliveryStatusContext,
): string {
  if (activeTrip) {
    const dest = activeTrip.destinationKind === 'building'
      ? formatTripBuildingDestinationLabel(
          activeTrip,
          context.getBuildingLabel,
          context.getBuilding,
          destinationLabel,
        )
      : formatTripDestinationLabel(activeTrip, context.getResidence, destinationLabel);
    return `
      <li><span>Active haul</span><span>${cargoKindLabel(activeTrip.cargoKind)} → ${dest}</span></li>
      <li><span>Delivery timer</span><span>${formatTripPhaseLabel(activeTrip.phase)} — ${formatCooldown(tripRemaining ?? Infinity)} left</span></li>
      <li><span>Road distance</span><span>${formatDeliveryRoadDistance(pathDistance)}</span></li>`;
  }

  return `
    <li><span>Next delivery</span><span>${destinationLabel}</span></li>
    <li><span>Road distance</span><span>${formatDeliveryRoadDistance(pathDistance)}</span></li>
    <li><span>Delivery timer</span><span>Ready / ${formatDeliveryTripDuration(plannedTripSeconds)}</span></li>
    ${cargoPerTrip ? `<li><span>Cargo per trip</span><span>${cargoPerTrip}</span></li>` : ''}`;
}

export function renderInboundSupplyRow(
  inboundTrip: DeliveryTripState | null,
  context: DeliveryStatusContext,
): string {
  if (!inboundTrip) return '';
  const origin = context.getBuilding(inboundTrip.buildingId);
  const originLabel = origin ? context.getBuildingLabel(origin.kind) : 'Supplier';
  const pathDistance = context.getActiveTripPathDistance(inboundTrip);
  const remaining = tripRemainingSeconds(inboundTrip, pathDistance);
  return `
    <li><span>Inbound haul</span><span>${cargoKindLabel(inboundTrip.cargoKind)} from ${originLabel}</span></li>
    <li><span>Receiving</span><span>${formatTripPhaseLabel(inboundTrip.phase)} — ${formatCooldown(remaining)} left</span></li>`;
}
