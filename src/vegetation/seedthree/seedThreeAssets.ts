import * as THREE from 'three';
import { makeBarkMaterial } from '@seedthree/core/tree.js';
import { makeFoliageMaterial } from '@seedthree/core/leaf-cards.js';
import { seedThreeBarkUrl, seedThreeLeafUrl } from './seedThreeTextures.ts';

export type SeedThreeSpeciesPreset = {
  name: string;
  bark: string;
  leaf: string;
  foliage?: Record<string, unknown>;
  foliageType?: string;
  cactus?: boolean;
  thatchBark?: string;
  params?: Record<string, unknown>;
};

export type SeedThreeSpeciesAssets = {
  barkTexture: THREE.Texture | null;
  barkNormal: THREE.Texture | null;
  barkRoughness: THREE.Texture | null;
  leafTexture: THREE.Texture | null;
  leafTranslucency: THREE.Texture | null;
  leafNormal: THREE.Texture | null;
  leafRoughness: THREE.Texture | null;
  barkMat: THREE.Material;
  leafMat: THREE.Material;
  clusterMat: THREE.Material;
  leafCenter: THREE.Vector3;
  clusterCenter: THREE.Vector3;
};

const loader = new THREE.TextureLoader();
const assetCache = new Map<string, SeedThreeSpeciesAssets>();

async function loadTex(url: string | undefined, srgb: boolean): Promise<THREE.Texture | null> {
  if (!url) return null;
  const tex = await loader.loadAsync(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

async function loadOptional(url: string | undefined, srgb: boolean): Promise<THREE.Texture | null> {
  if (!url) return null;
  try {
    return await loadTex(url, srgb);
  } catch {
    return null;
  }
}

export async function loadSeedThreeSpeciesAssets(
  species: SeedThreeSpeciesPreset,
  maxAnisotropy: number,
): Promise<SeedThreeSpeciesAssets> {
  const cached = assetCache.get(species.name);
  if (cached) return cached;

  const base = species.bark.replace('_albedo.png', '');
  const leafBase = species.leaf.replace(/(_albedo)?\.png$/, '');

  const [
    barkTexture,
    barkNormal,
    barkRoughness,
    leafTexture,
    leafTranslucency,
    leafNormal,
    leafRoughness,
  ] = await Promise.all([
    loadTex(seedThreeBarkUrl(species.bark), true),
    loadOptional(seedThreeBarkUrl(`${base}_normal.png`), false),
    loadOptional(seedThreeBarkUrl(`${base}_roughness.png`), false),
    loadTex(seedThreeLeafUrl(species.leaf), true),
    loadOptional(seedThreeLeafUrl(`${leafBase}_translucency.png`), false),
    loadOptional(seedThreeLeafUrl(`${leafBase}_normal.png`), false),
    loadOptional(seedThreeLeafUrl(`${leafBase}_roughness.png`), false),
  ]);

  for (const tex of [barkTexture, barkNormal, barkRoughness, leafTexture, leafTranslucency, leafNormal, leafRoughness]) {
    if (tex) tex.anisotropy = maxAnisotropy;
  }

  const vendorAssets = {
    barkTexture,
    barkNormal,
    barkRoughness,
    leafTexture,
    leafTranslucency,
    leafNormal,
    leafRoughness,
  };

  const barkMat = makeBarkMaterial(vendorAssets);
  const leafFol = makeFoliageMaterial(vendorAssets, { ...species.foliage, mode: 'leaves' });
  const clusterFol = makeFoliageMaterial(vendorAssets, { ...species.foliage, mode: 'clusters' });

  const assets: SeedThreeSpeciesAssets = {
    ...vendorAssets,
    barkMat,
    leafMat: leafFol.material,
    clusterMat: clusterFol.material,
    leafCenter: leafFol.centerUniform.value as THREE.Vector3,
    clusterCenter: clusterFol.centerUniform.value as THREE.Vector3,
  };

  assetCache.set(species.name, assets);
  return assets;
}

export function disposeSeedThreeAssetCache(): void {
  for (const assets of assetCache.values()) {
    assets.barkTexture?.dispose();
    assets.barkNormal?.dispose();
    assets.barkRoughness?.dispose();
    assets.leafTexture?.dispose();
    assets.leafTranslucency?.dispose();
    assets.leafNormal?.dispose();
    assets.leafRoughness?.dispose();
    assets.barkMat.dispose();
    assets.leafMat.dispose();
    assets.clusterMat.dispose();
  }
  assetCache.clear();
}
