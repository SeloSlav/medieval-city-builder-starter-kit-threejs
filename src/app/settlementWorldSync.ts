import type { DeliveryAgentRenderer } from '../logistics/DeliveryAgentRenderer.ts';
import type { BackyardGardenMarkers } from '../residences/BackyardGardenMarkers.ts';
import type { ResidenceMarkers } from '../residences/ResidenceMarkers.ts';
import type { GameState } from '../resources/types.ts';

export type SettlementWorldSyncTargets = {
  residenceMarkers: ResidenceMarkers | null;
  backyardGardenMarkers: BackyardGardenMarkers | null;
  deliveryAgents: DeliveryAgentRenderer | null;
  getHeightAt: (x: number, z: number) => number;
};

export function syncSettlementWorld(
  targets: SettlementWorldSyncTargets,
  state: GameState,
): void {
  const { getHeightAt } = targets;
  targets.residenceMarkers?.syncResidences(state.residences.values(), getHeightAt);
  targets.backyardGardenMarkers?.syncGardens({
    residences: state.residences.values(),
    zones: state.burgageZones.values(),
    gardens: state.backyardGardens,
    getHeightAt,
  });
  targets.deliveryAgents?.syncTrips(state.deliveryTrips.values());
}

export function tickSettlementWorld(
  targets: Pick<SettlementWorldSyncTargets, 'residenceMarkers' | 'deliveryAgents'>,
  dt: number,
): void {
  targets.residenceMarkers?.tick(dt);
  targets.deliveryAgents?.update(dt);
}

export function disposeSettlementWorld(
  targets: SettlementWorldSyncTargets,
): void {
  targets.residenceMarkers?.dispose();
  targets.backyardGardenMarkers?.dispose();
  targets.deliveryAgents?.dispose();
}
