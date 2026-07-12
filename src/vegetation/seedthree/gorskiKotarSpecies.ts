/**
 * Maps Gorski Kotar gameplay tree species to SeedThree presets.
 * @see https://github.com/SkyeShark/SeedThree
 *
 * Gorski Kotar (Dinaric Alps, Croatia) is dominated by European beech–fir forest,
 * with spruce plantations, Scots pine on rocky ridges, and oak/maple in warmer valleys.
 */
export type SeedThreePresetKey =
  | 'americanBeech'
  | 'whiteOak'
  | 'redMaple'
  | 'sweetgum'
  | 'douglasFir'
  | 'loblolly'
  | 'pine';

export type GorskiKotarTreeSpecies =
  | 'beech'
  | 'silverFir'
  | 'norwaySpruce'
  | 'sycamoreMaple'
  | 'norwayMaple'
  | 'ash'
  | 'wychElm'
  | 'lime'
  | 'hornbeam'
  | 'sessileOak'
  | 'scotsPine'
  | 'larch';

const SPECIES_TO_PRESET: Record<GorskiKotarTreeSpecies, SeedThreePresetKey> = {
  // Dominant Dinaric beech forests
  beech: 'americanBeech',
  hornbeam: 'americanBeech',
  lime: 'americanBeech',
  // Valley and slope oaks
  sessileOak: 'whiteOak',
  // Riparian / mixed maple–elm
  sycamoreMaple: 'redMaple',
  norwayMaple: 'redMaple',
  wychElm: 'redMaple',
  // Tall broadleaf canopy
  ash: 'sweetgum',
  // Native silver fir + deciduous European larch
  silverFir: 'douglasFir',
  larch: 'douglasFir',
  // Planted / managed Norway spruce
  norwaySpruce: 'loblolly',
  // Scots pine on karst ridges
  scotsPine: 'pine',
};

/** Scale multipliers tuned to match existing placement height profiles. */
const PRESET_SCALE: Partial<Record<SeedThreePresetKey, number>> = {
  americanBeech: 0.82,
  whiteOak: 0.88,
  redMaple: 0.78,
  sweetgum: 0.9,
  douglasFir: 0.72,
  loblolly: 0.68,
  pine: 0.74,
};

export function resolveSeedThreePreset(species: string): SeedThreePresetKey {
  return SPECIES_TO_PRESET[species as GorskiKotarTreeSpecies] ?? 'americanBeech';
}

export function seedThreeScaleForPreset(preset: SeedThreePresetKey, placementScale: number): number {
  const presetMul = PRESET_SCALE[preset] ?? 0.85;
  return placementScale * presetMul;
}

export const GORSKI_KOTAR_PRESETS: SeedThreePresetKey[] = [
  'americanBeech',
  'whiteOak',
  'redMaple',
  'sweetgum',
  'douglasFir',
  'loblolly',
  'pine',
];
