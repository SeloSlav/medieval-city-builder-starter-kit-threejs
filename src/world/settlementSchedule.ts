import type { SpacetimeGameSnapshot } from '../data/spacetimeGameStore.ts';
import { DEFAULT_PARISH_POLICY } from '../economy/chapelParish.ts';
import { playerHasStaffedChapel } from '../logistics/landmarkAccess.ts';
import type { GameState } from '../resources/types.ts';
import { computeDayNightState, type DayNightLightingState } from './dayNightPresentation.ts';
import {
  gameClock,
  isLaborPaused,
  laborPauseLabel,
  type GameClock,
} from './gameCalendar.ts';

export type SettlementSchedule = {
  clock: GameClock;
  laborPaused: boolean;
  laborPauseLabel: string | null;
  dayNight: DayNightLightingState;
  sabbathObservance: boolean;
  staffedChapel: boolean;
};

export function settlementScheduleDirtyKey(
  snapshot: Pick<SpacetimeGameSnapshot, 'simTick' | 'parishPolicy'>,
  gameState: GameState | null,
): string {
  const sabbathObservance = snapshot.parishPolicy.sabbathObservanceEnabled
    ?? DEFAULT_PARISH_POLICY.sabbathObservanceEnabled;
  let chapelSignature = '';
  if (gameState) {
    for (const building of gameState.buildings.values()) {
      if (building.kind !== 'chapel') continue;
      chapelSignature += `${building.id}:${building.assignedLabor};`;
    }
  }
  return `${snapshot.simTick}|${sabbathObservance ? 1 : 0}|${chapelSignature}`;
}

export function deriveSettlementSchedule(
  snapshot: Pick<SpacetimeGameSnapshot, 'simTick' | 'parishPolicy'>,
  gameState: GameState | null,
): SettlementSchedule {
  const clock = gameClock(snapshot.simTick);
  const sabbathObservance = snapshot.parishPolicy.sabbathObservanceEnabled
    ?? DEFAULT_PARISH_POLICY.sabbathObservanceEnabled;
  const staffedChapel = gameState ? playerHasStaffedChapel(gameState.buildings.values()) : false;
  const laborPaused = isLaborPaused(clock, sabbathObservance, staffedChapel);

  return {
    clock,
    laborPaused,
    laborPauseLabel: laborPauseLabel(clock, sabbathObservance, staffedChapel),
    dayNight: computeDayNightState(clock, laborPaused),
    sabbathObservance,
    staffedChapel,
  };
}

/**
 * Client mirror of `labor_and_logistics_paused` when owner policy inputs are known.
 * Server also requires `owner_has_staffed_chapel` from DB — pass staffedChapel from player buildings.
 */
export function expectLaborPausedLikeServer(
  clock: GameClock,
  sabbathObservanceEnabled: boolean,
  staffedChapel: boolean,
): boolean {
  return isLaborPaused(clock, sabbathObservanceEnabled, staffedChapel);
}
