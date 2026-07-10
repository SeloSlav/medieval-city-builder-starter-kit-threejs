import type { QuarrySite } from '../quarries/QuarryLayout.ts';
import type { ForestCore } from '../props/forestField.ts';
import type { ResourceNodeDefinition } from './types.ts';
import {
  forestMaxYield,
  forestPickRadius,
  quarryMaxYield,
  quarryPickRadius,
} from './yields.ts';
import type { WorldLayout } from './WorldLayout.ts';

const REGISTRY_CELL_SIZE = 120;

export class WorldLayoutRegistry {
  readonly definitions: ReadonlyMap<string, ResourceNodeDefinition>;
  readonly definitionList: readonly ResourceNodeDefinition[];
  private readonly spatialBuckets: Map<string, ResourceNodeDefinition[]>;

  private constructor(definitions: ResourceNodeDefinition[]) {
    this.definitionList = definitions;
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
    this.spatialBuckets = buildSpatialBuckets(definitions);
  }

  static fromWorldLayout(layout: WorldLayout): WorldLayoutRegistry {
    const definitions: ResourceNodeDefinition[] = [];
    let largeIndex = 0;
    let smallIndex = 0;

    for (const site of layout.quarryLayout.sites) {
      const id = quarryNodeId(site, largeIndex, smallIndex);
      if (site.kind === 'large') largeIndex++;
      else smallIndex++;

      definitions.push({
        id,
        kind: 'quarry',
        resource: 'stone',
        x: site.x,
        z: site.z,
        label: site.kind === 'large' ? 'Large quarry' : 'Small quarry',
        maxYield: quarryMaxYield(site.kind),
        pickRadius: quarryPickRadius(site.radiusX, site.radiusZ),
        quarryKind: site.kind,
      });
    }

    layout.forestCores.forEach((core, index) => {
      definitions.push({
        id: `forest-core-${index}`,
        kind: 'forest',
        resource: 'wood',
        x: core.x,
        z: core.z,
        label: forestCoreLabel(core),
        maxYield: forestMaxYield(core),
        pickRadius: forestPickRadius(core.radiusX, core.radiusZ),
        forestStrength: core.strength,
      });
    });

    return new WorldLayoutRegistry(definitions);
  }

  getDefinition(nodeId: string): ResourceNodeDefinition | undefined {
    return this.definitions.get(nodeId);
  }

  findNearestDefinition(x: number, z: number, maxDistance?: number): ResourceNodeDefinition | null {
    let best: ResourceNodeDefinition | null = null;
    let bestScore = Infinity;

    for (const definition of this.candidateDefinitions(x, z)) {
      const distance = Math.hypot(x - definition.x, z - definition.z);
      if (distance > definition.pickRadius) continue;
      if (maxDistance != null && distance > maxDistance) continue;
      if (distance < bestScore) {
        bestScore = distance;
        best = definition;
      }
    }

    return best;
  }

  private candidateDefinitions(x: number, z: number): ResourceNodeDefinition[] {
    const cellX = Math.floor(x / REGISTRY_CELL_SIZE);
    const cellZ = Math.floor(z / REGISTRY_CELL_SIZE);
    const candidates: ResourceNodeDefinition[] = [];

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.spatialBuckets.get(spatialKey(cellX + dx, cellZ + dz));
        if (bucket) candidates.push(...bucket);
      }
    }

    return candidates.length > 0 ? candidates : [...this.definitionList];
  }
}

function quarryNodeId(site: QuarrySite, largeIndex: number, smallIndex: number): string {
  if (site.kind === 'large') return `quarry-large-${largeIndex}`;
  return `quarry-small-${smallIndex}`;
}

function forestCoreLabel(core: ForestCore): string {
  if (core.strength >= 0.82) return 'Dense woodland';
  if (core.strength >= 0.62) return 'Woodland pocket';
  return 'Sparse grove';
}

function spatialKey(cellX: number, cellZ: number): string {
  return `${cellX}:${cellZ}`;
}

function buildSpatialBuckets(definitions: ResourceNodeDefinition[]): Map<string, ResourceNodeDefinition[]> {
  const buckets = new Map<string, ResourceNodeDefinition[]>();
  for (const definition of definitions) {
    const cellX = Math.floor(definition.x / REGISTRY_CELL_SIZE);
    const cellZ = Math.floor(definition.z / REGISTRY_CELL_SIZE);
    const key = spatialKey(cellX, cellZ);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(definition);
    else buckets.set(key, [definition]);
  }
  return buckets;
}
