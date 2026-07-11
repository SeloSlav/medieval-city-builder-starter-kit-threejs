import type { SpacetimeGameSnapshot } from '../data/spacetimeGameStore.ts';
import type { ResidenceMarkers } from '../residences/ResidenceMarkers.ts';
import type { GameState } from '../resources/types.ts';
import type { SceneManager } from '../scene/SceneManager.ts';
import type { BuildToolbar } from '../ui/BuildToolbar.ts';
import {
  deriveSettlementSchedule,
  settlementScheduleDirtyKey,
  type SettlementSchedule,
} from '../world/settlementSchedule.ts';

export type SettlementPresentationTargets = {
  toolbar: BuildToolbar | null;
  sceneManager: SceneManager | null;
  residenceMarkers: ResidenceMarkers | null;
};

export class SettlementPresentationController {
  private lastDirtyKey = '';

  sync(
    targets: SettlementPresentationTargets,
    snapshot: Pick<SpacetimeGameSnapshot, 'simTick' | 'parishPolicy'>,
    gameState: GameState | null,
    connected: boolean,
  ): SettlementSchedule | null {
    if (!connected) {
      this.lastDirtyKey = '';
      return null;
    }

    const dirtyKey = settlementScheduleDirtyKey(snapshot, gameState);
    if (dirtyKey === this.lastDirtyKey) {
      return null;
    }
    this.lastDirtyKey = dirtyKey;
    return applySettlementPresentation(targets, snapshot, gameState);
  }

  reset(): void {
    this.lastDirtyKey = '';
  }
}

export function applySettlementPresentation(
  targets: SettlementPresentationTargets,
  snapshot: Pick<SpacetimeGameSnapshot, 'simTick' | 'parishPolicy'>,
  gameState: GameState | null,
): SettlementSchedule {
  const schedule = deriveSettlementSchedule(snapshot, gameState);
  targets.toolbar?.setSettlementClock(schedule);
  targets.sceneManager?.applyDayNight(schedule.dayNight);
  targets.residenceMarkers?.setChimneySmokeAllowed(schedule.dayNight.smokeAllowed);
  targets.residenceMarkers?.setEveningWindowGlow(schedule.dayNight.eveningWindowGlow);
  return schedule;
}
