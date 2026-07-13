import type { Quarry } from '../../generated/types.ts';
import type { ResourceNodeState } from '../../resources/types.ts';

export function syncQuarries(rows: Iterable<Quarry>): Map<string, ResourceNodeState> {
  const quarries = new Map<string, ResourceNodeState>();
  for (const row of rows) {
    quarries.set(row.quarryId, {
      nodeId: row.quarryId,
      kind: 'quarry',
      resource: 'stone',
      remaining: row.remaining,
      maxYield: row.maxYield,
      x: row.x,
      z: row.z,
    });
  }
  return quarries;
}
