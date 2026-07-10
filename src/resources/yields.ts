import type { QuarryKind } from '../quarries/QuarryLayout.ts';
import type { ForestCore } from '../props/forestField.ts';
import type { ResourceKind } from './types.ts';

const LARGE_QUARRY_YIELD = 800;
const SMALL_QUARRY_YIELD = 350;

export function quarryMaxYield(kind: QuarryKind): number {
  switch (kind) {
    case 'large':
      return LARGE_QUARRY_YIELD;
    case 'small':
      return SMALL_QUARRY_YIELD;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

export function quarryPickRadius(radiusX: number, radiusZ: number): number {
  return Math.max(radiusX, radiusZ) * 0.88;
}

export function forestMaxYield(core: ForestCore): number {
  const area = Math.PI * core.radiusX * core.radiusZ;
  const estimate = area * core.strength * 0.14;
  return Math.round(Math.min(280, Math.max(40, estimate)));
}

export function forestPickRadius(radiusX: number, radiusZ: number): number {
  return Math.max(radiusX, radiusZ) * 0.72;
}

export function formatResourceAmount(kind: ResourceKind, amount: number): string {
  switch (kind) {
    case 'stone':
      return `${Math.round(amount)} stone`;
    case 'wood':
      return `${Math.round(amount)} wood`;
    case 'water':
      return amount > 0 ? 'Fresh water access' : 'No water stored';
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}
