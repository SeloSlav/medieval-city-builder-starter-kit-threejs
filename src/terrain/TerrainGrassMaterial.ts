import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  attribute,
  float,
  max,
  mix,
  normalMap,
  pow,
  smoothstep,
  sub,
  texture,
  uv,
  vec3,
  vertexColor,
} from 'three/tsl';
import { grassCameraDistance, TERRAIN_DIRT_LOD } from '../grass/GrassLodConfig.ts';
import type { TextureSet } from '../roads/RoadTextureLoader.ts';
import type { TerrainBlendTextureSet } from '../roads/RoadTextureLoader.ts';

type TslNode = {
  add(value: TslNode): TslNode;
  div(value: TslNode): TslNode;
  mul(value: TslNode): TslNode;
  r: TslNode;
  g: TslNode;
  b: TslNode;
  rgb: TslNode;
  xyz: TslNode;
  x: TslNode;
  y: TslNode;
  z: TslNode;
};

function buildGrassBlendNodes(textures: TerrainBlendTextureSet) {
  const grassUv = uv() as TslNode;
  const weightsRaw = (vertexColor() as TslNode).xyz;
  const weightSum = max(weightsRaw.x.add(weightsRaw.y).add(weightsRaw.z), float(0.0001) as TslNode) as TslNode;
  const w = weightsRaw.div(weightSum);

  const meadowColor = texture(textures.meadow.albedo, grassUv) as TslNode;
  const denseColor = texture(textures.dense.albedo, grassUv) as TslNode;
  const dryColor = texture(textures.dry.albedo, grassUv) as TslNode;
  const colorNode = meadowColor.rgb
    .mul(w.x)
    .add(denseColor.rgb.mul(w.y))
    .add(dryColor.rgb.mul(w.z));

  const meadowNormal = texture(textures.meadow.normal, grassUv) as TslNode;
  const denseNormal = texture(textures.dense.normal, grassUv) as TslNode;
  const dryNormal = texture(textures.dry.normal, grassUv) as TslNode;
  const blendedNormalSample = meadowNormal.mul(w.x).add(denseNormal.mul(w.y)).add(dryNormal.mul(w.z));
  const normalNode = normalMap(blendedNormalSample);

  const meadowRoughness = (texture(textures.meadow.roughness, grassUv) as TslNode).r;
  const denseRoughness = (texture(textures.dense.roughness, grassUv) as TslNode).r;
  const dryRoughness = (texture(textures.dry.roughness, grassUv) as TslNode).r;
  const roughnessNode = meadowRoughness.mul(w.x).add(denseRoughness.mul(w.y)).add(dryRoughness.mul(w.z));

  const meadowAo = (texture(textures.meadow.ao!, grassUv) as TslNode).r;
  const denseAo = (texture(textures.dense.ao!, grassUv) as TslNode).r;
  const dryAo = (texture(textures.dry.ao!, grassUv) as TslNode).r;
  const aoNode = meadowAo.mul(w.x).add(denseAo.mul(w.y)).add(dryAo.mul(w.z));

  return { colorNode, normalNode, roughnessNode, aoNode, grassUv };
}

function buildMuddyRoadColorNode(textures: TextureSet, grassUv: TslNode): TslNode {
  const sample = texture(textures.albedo, grassUv) as TslNode;
  const luminance = sample.r
    .mul(float(0.299) as TslNode)
    .add(sample.g.mul(float(0.587) as TslNode))
    .add(sample.b.mul(float(0.114) as TslNode));
  const desaturated = mix(
    sample.rgb,
    vec3(luminance, luminance, luminance) as TslNode,
    float(0.34) as TslNode,
  ) as TslNode;
  const warmTint = desaturated.mul(vec3(0.72, 0.54, 0.38) as TslNode);
  return warmTint.mul(float(0.86) as TslNode);
}

function buildDirtGroundColorNode(textures: TextureSet, grassUv: TslNode): TslNode {
  const sample = texture(textures.albedo, grassUv) as TslNode;
  return sample.rgb.mul(vec3(0.52, 0.42, 0.3) as TslNode);
}

function applyCloseZoomDirtBlend(
  meadowColor: TslNode,
  dirtColor: TslNode,
  shoreBlend: TslNode,
  roadWear: TslNode,
): TslNode {
  const meadowWeight = pow(
    smoothstep(
      float(TERRAIN_DIRT_LOD.close) as TslNode,
      float(TERRAIN_DIRT_LOD.far) as TslNode,
      grassCameraDistance as unknown as TslNode,
    ) as TslNode,
    float(TERRAIN_DIRT_LOD.ease) as TslNode,
  ) as TslNode;
  const wornMask = max(shoreBlend, roadWear) as TslNode;
  const openGround = sub(float(1) as TslNode, wornMask) as TslNode;
  return mix(dirtColor, meadowColor, meadowWeight.mul(openGround)) as TslNode;
}

export function createTerrainGrassMaterial(textures: TerrainBlendTextureSet): MeshStandardNodeMaterial {
  const blendNodes = buildGrassBlendNodes(textures);
  const material = new MeshStandardNodeMaterial();
  material.name = 'Grass blend terrain';
  material.color.set(0xffffff);
  material.roughness = 1;
  material.metalness = 0;
  material.colorNode = blendNodes.colorNode;
  material.normalNode = blendNodes.normalNode;
  material.roughnessNode = blendNodes.roughnessNode;
  material.aoNode = blendNodes.aoNode;
  return material;
}

function buildTrampledWearColorNode(textures: TextureSet, grassUv: TslNode): TslNode {
  const sample = texture(textures.albedo, grassUv) as TslNode;
  const luminance = sample.r
    .mul(float(0.299) as TslNode)
    .add(sample.g.mul(float(0.587) as TslNode))
    .add(sample.b.mul(float(0.114) as TslNode));
  const desaturated = mix(
    sample.rgb,
    vec3(luminance, luminance, luminance) as TslNode,
    float(0.52) as TslNode,
  ) as TslNode;
  const wornTint = desaturated.mul(vec3(0.62, 0.58, 0.46) as TslNode);
  return wornTint.mul(float(0.78) as TslNode);
}

export function createTerrainGrassMaterialWithRiverShore(
  grassTextures: TerrainBlendTextureSet,
  roadTextures: TextureSet,
): MeshStandardNodeMaterial {
  const blendNodes = buildGrassBlendNodes(grassTextures);
  const mudColor = buildMuddyRoadColorNode(roadTextures, blendNodes.grassUv);
  const dirtColor = buildDirtGroundColorNode(roadTextures, blendNodes.grassUv);
  const wearColor = buildTrampledWearColorNode(roadTextures, blendNodes.grassUv);
  const shoreBlend = pow(attribute('shoreBlend', 'float') as TslNode, float(0.82) as TslNode) as TslNode;
  const roadWear = pow(attribute('roadWearBlend', 'float') as TslNode, float(0.78) as TslNode) as TslNode;
  const grassWithShore = mix(blendNodes.colorNode, mudColor, shoreBlend) as TslNode;
  const meadowWithWear = mix(grassWithShore, wearColor, roadWear) as TslNode;
  const colorNode = applyCloseZoomDirtBlend(meadowWithWear, dirtColor, shoreBlend, roadWear);

  const roadRoughness = (texture(roadTextures.roughness, blendNodes.grassUv) as TslNode).r;
  const muddyRoughness = mix(roadRoughness, float(0.58) as TslNode, float(0.42) as TslNode);
  const wornRoughness = mix(roadRoughness, float(0.72) as TslNode, float(0.38) as TslNode);
  const dirtRoughness = mix(roadRoughness, float(0.82) as TslNode, float(0.24) as TslNode);
  const roughnessWithShore = mix(blendNodes.roughnessNode, muddyRoughness, shoreBlend);
  const roughnessWithWear = mix(roughnessWithShore, wornRoughness, roadWear);
  const meadowRoughness = pow(
    smoothstep(
      float(TERRAIN_DIRT_LOD.close) as TslNode,
      float(TERRAIN_DIRT_LOD.far) as TslNode,
      grassCameraDistance as unknown as TslNode,
    ) as TslNode,
    float(TERRAIN_DIRT_LOD.ease) as TslNode,
  ) as TslNode;
  const openGround = sub(float(1) as TslNode, max(shoreBlend, roadWear) as TslNode) as TslNode;
  const roughnessNode = mix(dirtRoughness, roughnessWithWear, meadowRoughness.mul(openGround));

  const material = new MeshStandardNodeMaterial();
  material.name = 'Grass blend terrain with river shore';
  material.color.set(0xffffff);
  material.roughness = 1;
  material.metalness = 0;
  material.colorNode = colorNode;
  material.normalNode = blendNodes.normalNode;
  material.roughnessNode = roughnessNode;
  material.aoNode = blendNodes.aoNode;
  return material;
}
