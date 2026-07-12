export type TreeYieldInput = {
  form: 'narrow' | 'broad' | 'young' | 'midstory';
  species: string;
  scale: number;
};

const FORM_BASE: Record<TreeYieldInput['form'], number> = {
  broad: 5.5,
  narrow: 4.2,
  midstory: 2.4,
  young: 1.2,
};

export function treeWoodYield(input: TreeYieldInput): number {
  const speciesMul = speciesYieldMultiplier(input.species);
  const yieldAmount = FORM_BASE[input.form] * input.scale * speciesMul;
  return Math.max(1, Math.round(yieldAmount));
}

function speciesYieldMultiplier(species: string): number {
  switch (species) {
    case 'sessileOak':
    case 'beech':
      return 1.15;
    case 'norwaySpruce':
    case 'scotsPine':
    case 'blackPine':
    case 'silverFir':
      return 1.05;
    case 'ash':
    case 'hornbeam':
      return 1;
    default:
      return 0.92;
  }
}
