export const GAME_SPEEDS = [0, 1, 5, 20, 120] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];
export const PLAYER_GAME_SPEEDS = [1, 5, 20, 120] as const satisfies readonly GameSpeed[];

export function normalizeGameSpeed(value: number): GameSpeed {
  // Preserve the nearest intent for worlds saved before the 1x / 5x / 20x rebalance.
  if (value === 4) return 5;
  if (value === 12) return 20;
  return GAME_SPEEDS.includes(value as GameSpeed) ? value as GameSpeed : 1;
}

export function gameSpeedLabel(speed: GameSpeed): string {
  if (speed === 0) return 'Paused';
  if (speed === 1) return 'Scenic';
  if (speed === 5) return 'Normal';
  if (speed === 20) return 'Fast';
  return 'Ultra';
}
