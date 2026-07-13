import * as THREE from 'three';
import { buildTree } from '@seedthree/core/tree.js';
import { loadSeedThreeSpeciesAssets } from './seedThreeAssets.ts';
import { BACKYARD_PLANT_SPECIES, type BackyardPlantKind } from './backyardPlantPresets.ts';

export type BackyardPlantCatalog = {
  clone(kind: BackyardPlantKind, variant: number): THREE.LOD;
};

const VARIANT_COUNT: Record<BackyardPlantKind, number> = {
  apple: 3,
  cherry: 3,
  rose: 2,
};

const GARDEN_LOD_OPTIONS = {
  meshQuality: 0.72,
  lod1Dist: 20,
  lod2Dist: 42,
  lod1Pct: 52,
  lod2Pct: 20,
  lod1Density: 0.9,
  lod2Density: 0.72,
  lod2Prune: 0.18,
};

let catalogPromise: Promise<BackyardPlantCatalog> | null = null;

function markSharedPrototypeGeometry(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.backyardSharedGeometry = true;
  });
}

export function loadBackyardPlantCatalog(maxAnisotropy: number): Promise<BackyardPlantCatalog> {
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    const prototypes = new Map<BackyardPlantKind, THREE.LOD[]>();
    for (const kind of ['apple', 'cherry', 'rose'] as const) {
      const species = BACKYARD_PLANT_SPECIES[kind];
      const assets = await loadSeedThreeSpeciesAssets(species, maxAnisotropy);
      const variants: THREE.LOD[] = [];
      for (let variant = 0; variant < VARIANT_COUNT[kind]; variant++) {
        const { group } = buildTree(
          species,
          `backyard:${kind}:${variant}`,
          assets,
          GARDEN_LOD_OPTIONS,
        );
        group.name = `SeedThree ${kind} prototype ${variant + 1}`;
        markSharedPrototypeGeometry(group);
        variants.push(group);
      }
      prototypes.set(kind, variants);
    }

    return {
      clone(kind: BackyardPlantKind, variant: number): THREE.LOD {
        const variants = prototypes.get(kind);
        if (!variants?.length) throw new Error(`Missing backyard plant prototype: ${kind}`);
        const source = variants[Math.abs(variant) % variants.length]!;
        const clone = source.clone(true) as THREE.LOD;
        clone.name = `SeedThree backyard ${kind}`;
        markSharedPrototypeGeometry(clone);
        return clone;
      },
    };
  })().catch((error) => {
    catalogPromise = null;
    throw error;
  });

  return catalogPromise;
}
