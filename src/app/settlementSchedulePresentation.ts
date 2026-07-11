import type { SpacetimeGameSnapshot } from '../data/spacetimeGameStore.ts';
import type { ResidenceMarkers } from '../residences/ResidenceMarkers.ts';
import type { GameState } from '../resources/types.ts';
import type { SceneManager } from '../scene/SceneManager.ts';
import type { BuildToolbar } from '../ui/BuildToolbar.ts';
import {
  deriveSettlementSchedule,
  type SettlementSchedule,
} from '../world/settlementSchedule.ts';

export type SettlementPresentationTargets = {
  toolbar: BuildToolbar | null;
  sceneManager: SceneManager | null;
  residenceMarkers: ResidenceMarkers | null;
};

export function syncSettlementPresentation(
  targets: SettlementPresentationTargets,
  snapshot: Pick<SpacetimeGameSnapshot, 'simTick' | 'parishPolicy'>,
  gameState: GameState | null,
  connected: boolean,
): SettlementSchedule | null {
  if (!connected) return null;
  const schedule = deriveSettlementSchedule(snapshot, gameState);
  targets.toolbar?.setSettlementClock(schedule);
  targets.sceneManager?.applyDayNight(schedule.dayNight);
  targets.residenceMarkers?.setChimneySmokeAllowed(schedule.dayNight.smokeAllowed);
  targets.residenceMarkers?.setEveningWindowGlow(schedule.dayNight.eveningWindowGlow);
  return schedule;
}
