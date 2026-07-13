import type { BuildingKind } from '../generated/gameBalance.ts';
import type { PlacementBuildMenuAction } from './buildMenuCards.ts';

export const BUILDING_KIND_TO_MENU_ACTION: Record<BuildingKind, PlacementBuildMenuAction> = {
  lumber_mill: 'lumber-mill',
  reforester: 'reforester',
  stone_quarry: 'stone-quarry',
  woodcutters_lodge: 'woodcutters-lodge',
  well: 'well',
  hunters_hall: 'hunters-hall',
  foragers_shed: 'foragers-shed',
  chapel: 'chapel',
  marketplace: 'marketplace',
  grain_field: 'grain-field',
  threshing_barn: 'threshing-barn',
  monastery: 'monastery',
  brewery: 'brewery',
  smokehouse: 'smokehouse',
  granary: 'granary',
  apiary: 'apiary',
  watermill: 'watermill',
  carpenter: 'carpenter',
  ferry_landing: 'ferry-landing',
  vineyard: 'vineyard',
};

export type BuildingMenuAction = Exclude<PlacementBuildMenuAction, 'residences' | 'grain-field'>;

export const MENU_ACTION_TO_BUILDING_KIND: Record<BuildingMenuAction, BuildingKind> = {
  'lumber-mill': 'lumber_mill',
  'reforester': 'reforester',
  'stone-quarry': 'stone_quarry',
  'woodcutters-lodge': 'woodcutters_lodge',
  well: 'well',
  'hunters-hall': 'hunters_hall',
  'foragers-shed': 'foragers_shed',
  chapel: 'chapel',
  marketplace: 'marketplace',
  'threshing-barn': 'threshing_barn',
  monastery: 'monastery',
  brewery: 'brewery',
  smokehouse: 'smokehouse',
  granary: 'granary',
  apiary: 'apiary',
  watermill: 'watermill',
  carpenter: 'carpenter',
  'ferry-landing': 'ferry_landing',
  vineyard: 'vineyard',
};

export function toolbarModeToMenuAction(
  mode: BuildingKind | 'road' | 'residences' | 'farm-fields' | 'idle',
): PlacementBuildMenuAction | null {
  if (mode === 'idle' || mode === 'road') return null;
  if (mode === 'residences') return 'residences';
  if (mode === 'farm-fields') return 'grain-field';
  return BUILDING_KIND_TO_MENU_ACTION[mode];
}
