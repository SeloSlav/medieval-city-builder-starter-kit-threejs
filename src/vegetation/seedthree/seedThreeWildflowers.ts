import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  attribute,
  cameraViewMatrix,
  float,
  mix,
  normalize,
  texture,
  uv,
  vec2,
  vec4,
} from 'three/tsl';
import { loadBitmapTexture } from '../../utils/textureLoad.ts';
import { createPinnedGrassWindPosition } from './seedThreeGrass.ts';

type TslNode = {
  a: TslNode;
  rgb: TslNode;
  w: TslNode;
  xyz: TslNode;
  add: (value: unknown) => TslNode;
  mul: (value: unknown) => TslNode;
};

const tsl = {
  attribute: attribute as (name: string, type: string) => TslNode,
  cameraViewMatrix: cameraViewMatrix as TslNode,
  float: float as (value: number) => TslNode,
  mix: mix as (a: unknown, b: unknown, amount: unknown) => TslNode,
  normalize: normalize as (value: unknown) => TslNode,
  texture: texture as (map: THREE.Texture, uvNode?: unknown) => TslNode,
  uv: uv as () => TslNode,
  vec2: vec2 as (...values: unknown[]) => TslNode,
  vec4: vec4 as (...values: unknown[]) => TslNode,
};

const STEM_COLORS = [new THREE.Color(0x405b32), new THREE.Color(0x526e3b)] as const;
const FLOWER_CARD_COLOR = new THREE.Color(0xffffff);
const WILDFLOWER_ATLAS_PATH =
  '/assets/textures/vegetation/wildflowers/gorski-kotar-wildflower-atlas.png';
export const WILDFLOWER_ATLAS_CELL_SCALE = [1 / 5, 1] as const;

type WildflowerVertex = {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  color: THREE.Color;
  uv: readonly [number, number];
  flowerMask: number;
  windWeight: number;
};

type WildflowerBuffers = {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  flowerMasks: number[];
  windWeights: number[];
  indices: number[];
};

export const SEEDTHREE_WILDFLOWER_VARIANTS = [
  {
    id: 'daisy-star-aster',
    label: 'Daisy star-aster',
    texturePath: '/assets/textures/vegetation/wildflowers/daisy-star-aster-head.png',
    atlasOffset: [0, 0],
  },
  {
    id: 'clusius-gentian',
    label: 'Clusius gentian',
    texturePath: '/assets/textures/vegetation/wildflowers/clusius-gentian-head.png',
    atlasOffset: [1 / 5, 0],
  },
  {
    id: 'grey-hawkbit',
    label: 'Grey hawkbit',
    texturePath: '/assets/textures/vegetation/wildflowers/grey-hawkbit-head.png',
    atlasOffset: [2 / 5, 0],
  },
  {
    id: 'bulbiferous-lily',
    label: 'Bulbiferous lily',
    texturePath: '/assets/textures/vegetation/wildflowers/bulbiferous-lily-head.png',
    atlasOffset: [3 / 5, 0],
  },
  {
    id: 'red-campion',
    label: 'Red campion',
    texturePath: '/assets/textures/vegetation/wildflowers/red-campion-head.png',
    atlasOffset: [4 / 5, 0],
  },
] as const;

let textureCache: THREE.Texture | null = null;

export async function loadSeedThreeWildflowerAtlas(
  maxAnisotropy: number,
): Promise<THREE.Texture> {
  if (textureCache) return textureCache;

  textureCache = await loadBitmapTexture(WILDFLOWER_ATLAS_PATH, maxAnisotropy, {
    srgb: true,
    anisotropyLimit: 4,
    wrapping: THREE.ClampToEdgeWrapping,
  });
  return textureCache;
}

export function createSeedThreeWildflowerGeometry(headScale: number): THREE.BufferGeometry {
  const buffers: WildflowerBuffers = {
    positions: [],
    normals: [],
    colors: [],
    uvs: [],
    flowerMasks: [],
    windWeights: [],
    indices: [],
  };
  const stalks = [
    { x: -0.16, z: 0.04, height: 0.78, leanX: -0.04, leanZ: 0.015, yaw: 0.25, bloomScale: 0.95 },
    { x: 0.08, z: -0.08, height: 0.96, leanX: 0.055, leanZ: -0.025, yaw: 2.2, bloomScale: 1.08 },
    { x: 0.2, z: 0.12, height: 0.68, leanX: 0.035, leanZ: 0.045, yaw: 4.35, bloomScale: 0.84 },
  ] as const;

  stalks.forEach((stalk, index) => {
    appendStalk(buffers, stalk, index);
    appendFlowerHeadCard(
      buffers,
      new THREE.Vector3(
        stalk.x + stalk.leanX,
        stalk.height,
        stalk.z + stalk.leanZ,
      ),
      stalk.yaw,
      0.13 * stalk.bloomScale * headScale,
    );
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(buffers.indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('flowerMask', new THREE.Float32BufferAttribute(buffers.flowerMasks, 1));
  geometry.setAttribute('windWeight', new THREE.Float32BufferAttribute(buffers.windWeights, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSeedThreeWildflowerMaterial(
  texture: THREE.Texture,
  label: string,
): THREE.Material {
  const material = new MeshStandardNodeMaterial();
  Object.assign(material, { map: texture });
  material.name = `SeedThree textured ${label}`;
  material.side = THREE.DoubleSide;
  material.alphaTest = 0.18;
  material.roughness = 0.88;
  material.metalness = 0;
  material.color.set(0xffffff);
  material.forceSinglePass = true;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;

  const baseColor = tsl.attribute('color', 'vec3');
  const flowerMask = tsl.attribute('flowerMask', 'float');
  const flowerAnchor = tsl.attribute('aAnchorPos', 'vec4');
  const atlasUv = tsl.uv()
    .mul(tsl.vec2(WILDFLOWER_ATLAS_CELL_SCALE[0], WILDFLOWER_ATLAS_CELL_SCALE[1]))
    .add(tsl.vec2(flowerAnchor.w, 0));
  const texel = tsl.texture(texture, atlasUv);
  // Alpha stays in colorNode so the material opacity still controls the
  // close-ground LOD fade applied by GrassBladeField.
  material.colorNode = tsl.mix(
    tsl.vec4(baseColor, tsl.float(1)),
    texel,
    flowerMask,
  );
  // A separate weight keeps every point of the head card attached to its stem
  // rather than bending the image according to its texture UV.
  material.positionNode = createPinnedGrassWindPosition('windWeight', 'vec4');
  const upView = tsl.cameraViewMatrix.mul(tsl.vec4(0, 1, 0, 0)).xyz;
  material.normalNode = tsl.normalize(upView);
  return material;
}

export function disposeSeedThreeWildflowerTextureCache(): void {
  if (!textureCache) return;
  textureCache.dispose();
  textureCache = null;
}

function appendStalk(
  buffers: WildflowerBuffers,
  stalk: {
    x: number;
    z: number;
    height: number;
    leanX: number;
    leanZ: number;
    yaw: number;
  },
  colorIndex: number,
): void {
  const root = new THREE.Vector3(stalk.x, 0, stalk.z);
  const tip = new THREE.Vector3(
    stalk.x + stalk.leanX,
    stalk.height,
    stalk.z + stalk.leanZ,
  );
  const width = 0.018;
  const stemColor = STEM_COLORS[colorIndex % STEM_COLORS.length]!;

  for (let plane = 0; plane < 2; plane++) {
    const angle = stalk.yaw + plane * Math.PI * 0.5;
    const side = new THREE.Vector3(
      Math.cos(angle) * width,
      0,
      Math.sin(angle) * width,
    );
    const normal = new THREE.Vector3(-Math.sin(angle), 0.25, Math.cos(angle)).normalize();
    appendQuad(buffers, [
      vertex(root.clone().sub(side), normal, stemColor, [0, 0], 0, 0),
      vertex(root.clone().add(side), normal, stemColor, [1, 0], 0, 0),
      vertex(
        tip.clone().add(side.clone().multiplyScalar(0.45)),
        normal,
        stemColor,
        [1, 1],
        0,
        1,
      ),
      vertex(
        tip.clone().sub(side.clone().multiplyScalar(0.45)),
        normal,
        stemColor,
        [0, 1],
        0,
        1,
      ),
    ]);
  }

  appendLeaf(buffers, root, tip, stalk.yaw + 0.8, 0.34, 0.2, stemColor);
  appendLeaf(
    buffers,
    root,
    tip,
    stalk.yaw + Math.PI + 0.35,
    0.53,
    0.16,
    STEM_COLORS[(colorIndex + 1) % STEM_COLORS.length]!,
  );
}

function appendLeaf(
  buffers: WildflowerBuffers,
  root: THREE.Vector3,
  tip: THREE.Vector3,
  yaw: number,
  heightFraction: number,
  length: number,
  color: THREE.Color,
): void {
  const stemPoint = root.clone().lerp(tip, heightFraction);
  const direction = new THREE.Vector3(
    Math.cos(yaw),
    0.28,
    Math.sin(yaw),
  ).normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(0.035);
  const leafTip = stemPoint.clone().addScaledVector(direction, length);
  const normal = new THREE.Vector3(0, 1, 0);
  const leafTipWeight = Math.min(1, heightFraction + 0.12);

  appendQuad(buffers, [
    vertex(stemPoint.clone().sub(side), normal, color, [0, 0], 0, heightFraction),
    vertex(stemPoint.clone().add(side), normal, color, [1, 0], 0, heightFraction),
    vertex(
      leafTip.clone().addScaledVector(side, 0.12),
      normal,
      color,
      [1, 1],
      0,
      leafTipWeight,
    ),
    vertex(
      leafTip.clone().addScaledVector(side, -0.12),
      normal,
      color,
      [0, 1],
      0,
      leafTipWeight,
    ),
  ]);
}

function appendFlowerHeadCard(
  buffers: WildflowerBuffers,
  center: THREE.Vector3,
  yaw: number,
  radius: number,
): void {
  const tiltDirection = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const normal = new THREE.Vector3(
    tiltDirection.x * 0.24,
    0.95,
    tiltDirection.z * 0.24,
  ).normalize();
  const axisU = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const axisV = new THREE.Vector3().crossVectors(normal, axisU).normalize();
  const halfSize = radius * 1.18;
  const liftedCenter = center.clone().addScaledVector(normal, 0.018);

  appendQuad(buffers, [
    vertex(
      liftedCenter.clone().addScaledVector(axisU, -halfSize).addScaledVector(axisV, -halfSize),
      normal,
      FLOWER_CARD_COLOR,
      [0, 0],
      1,
      1,
    ),
    vertex(
      liftedCenter.clone().addScaledVector(axisU, halfSize).addScaledVector(axisV, -halfSize),
      normal,
      FLOWER_CARD_COLOR,
      [1, 0],
      1,
      1,
    ),
    vertex(
      liftedCenter.clone().addScaledVector(axisU, halfSize).addScaledVector(axisV, halfSize),
      normal,
      FLOWER_CARD_COLOR,
      [1, 1],
      1,
      1,
    ),
    vertex(
      liftedCenter.clone().addScaledVector(axisU, -halfSize).addScaledVector(axisV, halfSize),
      normal,
      FLOWER_CARD_COLOR,
      [0, 1],
      1,
      1,
    ),
  ]);
}

function vertex(
  position: THREE.Vector3,
  normal: THREE.Vector3,
  color: THREE.Color,
  uv: readonly [number, number],
  flowerMask: number,
  windWeight: number,
): WildflowerVertex {
  return { position, normal, color, uv, flowerMask, windWeight };
}

function appendQuad(
  buffers: WildflowerBuffers,
  vertices: readonly WildflowerVertex[],
): void {
  const base = buffers.positions.length / 3;
  for (const item of vertices) appendVertex(buffers, item);
  buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function appendVertex(buffers: WildflowerBuffers, item: WildflowerVertex): void {
  buffers.positions.push(item.position.x, item.position.y, item.position.z);
  buffers.normals.push(item.normal.x, item.normal.y, item.normal.z);
  buffers.colors.push(item.color.r, item.color.g, item.color.b);
  buffers.uvs.push(item.uv[0], item.uv[1]);
  buffers.flowerMasks.push(item.flowerMask);
  buffers.windWeights.push(item.windWeight);
}
