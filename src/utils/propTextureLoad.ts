import * as THREE from 'three';

export type MossyRockTextureSet = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

async function loadPropTexture(
  loader: THREE.TextureLoader,
  url: string,
  maxAnisotropy: number,
  options?: { srgb?: boolean; anisotropyLimit?: number; wrapping?: THREE.Wrapping },
): Promise<THREE.Texture> {
  const texture = await loader.loadAsync(url);
  texture.wrapS = options?.wrapping ?? THREE.RepeatWrapping;
  texture.wrapT = options?.wrapping ?? THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  const limit = options?.anisotropyLimit ?? 16;
  texture.anisotropy = Math.max(1, Math.min(limit, maxAnisotropy));
  if (options?.srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export async function loadMossyRockTextures(maxAnisotropy: number): Promise<MossyRockTextureSet> {
  const loader = new THREE.TextureLoader();
  const base = '/assets/textures/props/mossy_rock';
  const [map, normalMap, roughnessMap] = await Promise.all([
    loadPropTexture(loader, `${base}/albedo.png`, maxAnisotropy, { srgb: true }),
    loadPropTexture(loader, `${base}/normal.png`, maxAnisotropy),
    loadPropTexture(loader, `${base}/roughness.png`, maxAnisotropy),
  ]);
  return { map, normalMap, roughnessMap };
}

export async function loadPineFoliageTextures(maxAnisotropy: number): Promise<{
  needleMap: THREE.Texture;
  needleRoughnessMap: THREE.Texture;
}> {
  const loader = new THREE.TextureLoader();
  const base = '/assets/textures/props/pine_foliage';
  const [needleMap, needleRoughnessMap] = await Promise.all([
    loadPropTexture(loader, `${base}/albedo.png`, maxAnisotropy, { srgb: true, anisotropyLimit: 4 }),
    loadPropTexture(loader, `${base}/roughness.png`, maxAnisotropy, { anisotropyLimit: 4 }),
  ]);
  return { needleMap, needleRoughnessMap };
}
