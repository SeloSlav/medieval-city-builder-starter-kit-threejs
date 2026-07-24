import * as THREE from 'three';
import { loadSkyPerlinTexture } from '../sky/SkyCloudMesh.ts';
import { loadMossyRockTextures, type MossyRockTextureSet } from '../utils/propTextureLoad.ts';

export type SceneStartupTextures = {
  riverRock: MossyRockTextureSet;
  skyPerlin: THREE.Texture;
  ready?: Promise<void>;
};

const DEFAULT_MAX_ANISOTROPY = 8;

export function beginStartupTextureLoad(maxAnisotropy = DEFAULT_MAX_ANISOTROPY): Promise<SceneStartupTextures> {
  return Promise.all([
    loadMossyRockTextures(maxAnisotropy),
    loadSkyPerlinTexture(),
  ]).then(([riverRock, skyPerlin]) => ({ riverRock, skyPerlin }));
}

export function beginProgressiveStartupTextureLoad(
  maxAnisotropy = DEFAULT_MAX_ANISOTROPY,
): Promise<SceneStartupTextures> {
  const riverRock: MossyRockTextureSet = {
    map: placeholderTexture([95, 102, 91, 255], true),
    normalMap: placeholderTexture([128, 128, 255, 255], false),
    roughnessMap: placeholderTexture([235, 235, 235, 255], false),
  };
  const skyPerlin = placeholderTexture([128, 128, 128, 255], false);
  const textures: SceneStartupTextures = { riverRock, skyPerlin };
  textures.ready = beginStartupTextureLoad(maxAnisotropy)
    .then((loaded) => {
      hydrateTexture(riverRock.map, loaded.riverRock.map);
      hydrateTexture(riverRock.normalMap, loaded.riverRock.normalMap);
      hydrateTexture(riverRock.roughnessMap, loaded.riverRock.roughnessMap);
      hydrateTexture(skyPerlin, loaded.skyPerlin);
    });
  return Promise.resolve(textures);
}

export function applyMaxAnisotropy(textures: SceneStartupTextures, maxAnisotropy: number): void {
  const limit = Math.max(1, Math.min(16, maxAnisotropy));
  for (const texture of [textures.riverRock.map, textures.riverRock.normalMap, textures.riverRock.roughnessMap]) {
    texture.anisotropy = limit;
  }
}

function placeholderTexture(
  rgba: [number, number, number, number],
  srgb: boolean,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
    context.fillRect(0, 0, 1, 1);
  }
  const texture = new THREE.Texture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function hydrateTexture(target: THREE.Texture, source: THREE.Texture): void {
  target.copy(source);
  target.needsUpdate = true;
}
