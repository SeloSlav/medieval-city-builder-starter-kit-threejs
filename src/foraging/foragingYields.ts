export const GAME_PATCH_MAX_YIELD = 200;
/** Two berry patches share the old single-patch budget (2 × 60 = 120). */
export const BERRY_PATCH_MAX_YIELD = 60;

export const GAME_PATCH_PICK_RADIUS = 42;
export const BERRY_PATCH_PICK_RADIUS = 28;

export function foragingPickRadius(nodeKind: 'game' | 'berries'): number {
  return nodeKind === 'game' ? GAME_PATCH_PICK_RADIUS : BERRY_PATCH_PICK_RADIUS;
}
