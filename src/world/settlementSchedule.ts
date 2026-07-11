import type { SpacetimeGameSnapshot } from '../data/spacetimeGameStore.ts';
import { DEFAULT_PARISH_POLICY } from '../economy/chapelParish.ts';
import { hasStaffedChapel } from '../logistics/landmarkAccess.ts';
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

export function deriveSettlementSchedule(
  snapshot: Pick<SpacetimeGameSnapshot, 'simTick' | 'parishPolicy'>,
  gameState: GameState | null,
): SettlementSchedule {
  const clock = gameClock(snapshot.simTick);
  const sabbathObservance = snapshot.parishPolicy.sabbathObservanceEnabled
    ?? DEFAULT_PARISH_POLICY.sabbathObservanceEnabled;
  const staffedChapel = gameState
    ? hasStaffedChapel(gameState.buildings.values())
    : false;
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
