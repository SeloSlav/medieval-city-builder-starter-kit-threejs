import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  attribute,
  cameraViewMatrix,
  mix,
  normalize,
  vec4,
} from 'three/tsl';
import { createPinnedGrassWindPosition } from './seedThreeGrass.ts';

type TslNode = {
  mul: (value: unknown) => TslNode;
  xyz: TslNode;
};

const tsl = {
  attribute: attribute as (name: string, type: string) => TslNode,
  cameraViewMatrix: cameraViewMatrix as TslNode,
  mix: mix as (a: unknown, b: unknown, t: unknown) => TslNode,
  normalize: normalize as (value: unknown) => TslNode,
  vec4: vec4 as (...values: unknown[]) => TslNode,
};

const TAU = Math.PI * 2;
const STEM_COLORS = [new THREE.Color(0x405b32), new THREE.Color(0x526e3b)] as const;
const FLOWER_CENTER = new THREE.Color(0xc99431);
const PETAL_BASE = new THREE.Color(0xffffff);

/** Natural but legible versions of the five requested wildflower colors. */
export const SEEDTHREE_WILDFLOWER_COLORS = [
  0xf2efe3,
  0x9669bd,
  0xe7c63f,
  0xdf8436,
  0xc94b42,
] as const;

type GeometryBuffers = {
  positions: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
  flowerMasks: number[];
  indices: number[];
};

type Vertex = {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  color: THREE.Color;
  uv: readonly [number, number];
  flowerMask: number;
};

/**
 * A compact SeedThree-style procedural clump: crossed stems and leaves plus
 * three modeled flower heads. One shared geometry is instanced for the stream.
 */
export function createSeedThreeWildflowerGeometry(): THREE.BufferGeometry {
  const buffers: GeometryBuffers = {
    positions: [],
    normals: [],
    colors: [],
    uvs: [],
    flowerMasks: [],
    indices: [],
  };

  const stalks = [
    { x: -0.16, z: 0.04, height: 0.78, leanX: -0.04, leanZ: 0.015, yaw: 0.25, bloomScale: 0.95 },
    { x: 0.08, z: -0.08, height: 0.96, leanX: 0.055, leanZ: -0.025, yaw: 2.2, bloomScale: 1.08 },
    { x: 0.2, z: 0.12, height: 0.68, leanX: 0.035, leanZ: 0.045, yaw: 4.35, bloomScale: 0.84 },
  ] as const;

  stalks.forEach((stalk, index) => {
    appendStalk(buffers, stalk.x, stalk.z, stalk.height, stalk.leanX, stalk.leanZ, stalk.yaw, index);
    appendFlowerHead(
      buffers,
      new THREE.Vector3(stalk.x + stalk.leanX, stalk.height, stalk.z + stalk.leanZ),
      stalk.yaw,
      0.13 * stalk.bloomScale,
    );
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(buffers.indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('flowerMask', new THREE.Float32BufferAttribute(buffers.flowerMasks, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSeedThreeWildflowerMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  material.name = 'SeedThree streamed wildflowers';
  material.side = THREE.DoubleSide;
  material.roughness = 0.9;
  material.metalness = 0;
  material.color.set(0xffffff);
  material.forceSinglePass = true;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;

  const baseColor = tsl.attribute('color', 'vec3');
  const flowerColor = tsl.attribute('aFlowerColor', 'vec3');
  const flowerMask = tsl.attribute('flowerMask', 'float');
  material.colorNode = tsl.mix(baseColor, flowerColor, flowerMask);
  material.positionNode = createPinnedGrassWindPosition();

  const upView = tsl.cameraViewMatrix.mul(tsl.vec4(0, 1, 0, 0)).xyz;
  material.normalNode = tsl.normalize(upView);
  return material;
}

export function sampleSeedThreeWildflowerColor(
  paletteIndex: number,
  rng: () => number,
  out = new THREE.Color(),
): THREE.Color {
  const base = SEEDTHREE_WILDFLOWER_COLORS[
    Math.abs(Math.trunc(paletteIndex)) % SEEDTHREE_WILDFLOWER_COLORS.length
  ]!;
  return out
    .setHex(base)
    .offsetHSL((rng() - 0.5) * 0.018, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.07);
}

function appendStalk(
  buffers: GeometryBuffers,
  rootX: number,
  rootZ: number,
  height: number,
  leanX: number,
  leanZ: number,
  yaw: number,
  colorIndex: number,
): void {
  const root = new THREE.Vector3(rootX, 0, rootZ);
  const tip = new THREE.Vector3(rootX + leanX, height, rootZ + leanZ);
  const width = 0.018;
  const stemColor = STEM_COLORS[colorIndex % STEM_COLORS.length]!;

  for (let plane = 0; plane < 2; plane++) {
    const angle = yaw + plane * Math.PI * 0.5;
    const side = new THREE.Vector3(Math.cos(angle) * width, 0, Math.sin(angle) * width);
    const normal = new THREE.Vector3(-Math.sin(angle), 0.25, Math.cos(angle)).normalize();
    appendQuad(
      buffers,
      [
        vertex(root.clone().sub(side), normal, stemColor, [0, 0], 0),
        vertex(root.clone().add(side), normal, stemColor, [1, 0], 0),
        vertex(tip.clone().add(side.clone().multiplyScalar(0.45)), normal, stemColor, [1, 1], 0),
        vertex(tip.clone().sub(side.clone().multiplyScalar(0.45)), normal, stemColor, [0, 1], 0),
      ],
    );
  }

  appendLeaf(buffers, root, tip, yaw + 0.8, height * 0.34, 0.2, stemColor);
  appendLeaf(buffers, root, tip, yaw + Math.PI + 0.35, height * 0.53, 0.16, STEM_COLORS[(colorIndex + 1) % 2]!);
}

function appendLeaf(
  buffers: GeometryBuffers,
  root: THREE.Vector3,
  tip: THREE.Vector3,
  yaw: number,
  heightFraction: number,
  length: number,
  color: THREE.Color,
): void {
  const t = heightFraction / Math.max(tip.y, 0.001);
  const stemPoint = root.clone().lerp(tip, t);
  const direction = new THREE.Vector3(Math.cos(yaw), 0.28, Math.sin(yaw)).normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(0.035);
  const leafTip = stemPoint.clone().addScaledVector(direction, length);
  const normal = new THREE.Vector3(0, 1, 0);

  appendQuad(
    buffers,
    [
      vertex(stemPoint.clone().sub(side), normal, color, [0, heightFraction], 0),
      vertex(stemPoint.clone().add(side), normal, color, [1, heightFraction], 0),
      vertex(leafTip.clone().addScaledVector(side, 0.12), normal, color, [1, Math.min(1, heightFraction + 0.25)], 0),
      vertex(leafTip.clone().addScaledVector(side, -0.12), normal, color, [0, Math.min(1, heightFraction + 0.25)], 0),
    ],
  );
}

function appendFlowerHead(
  buffers: GeometryBuffers,
  center: THREE.Vector3,
  yaw: number,
  radius: number,
): void {
  const tiltDirection = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const normal = new THREE.Vector3(tiltDirection.x * 0.24, 0.95, tiltDirection.z * 0.24).normalize();
  const axisU = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const axisV = new THREE.Vector3().crossVectors(normal, axisU).normalize();
  const petalCount = 6;

  for (let petal = 0; petal < petalCount; petal++) {
    const angle = (petal / petalCount) * TAU;
    const direction = axisU.clone().multiplyScalar(Math.cos(angle)).addScaledVector(axisV, Math.sin(angle));
    const tangent = axisU.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(axisV, Math.cos(angle));
    const inner = center.clone().addScaledVector(direction, radius * 0.14).addScaledVector(normal, 0.008);
    const outer = center.clone().addScaledVector(direction, radius).addScaledVector(normal, 0.012);
    const halfInner = radius * 0.18;
    const halfOuter = radius * 0.31;
    appendQuad(
      buffers,
      [
        vertex(inner.clone().addScaledVector(tangent, -halfInner), normal, PETAL_BASE, [0, 1], 1),
        vertex(inner.clone().addScaledVector(tangent, halfInner), normal, PETAL_BASE, [1, 1], 1),
        vertex(outer.clone().addScaledVector(tangent, halfOuter), normal, PETAL_BASE, [1, 1], 1),
        vertex(outer.clone().addScaledVector(tangent, -halfOuter), normal, PETAL_BASE, [0, 1], 1),
      ],
    );
  }

  const centerRadius = radius * 0.3;
  const centerVertex = center.clone().addScaledVector(normal, 0.02);
  for (let segment = 0; segment < petalCount; segment++) {
    const a0 = (segment / petalCount) * TAU;
    const a1 = ((segment + 1) / petalCount) * TAU;
    appendTriangle(
      buffers,
      [
        vertex(centerVertex, normal, FLOWER_CENTER, [0.5, 1], 0),
        vertex(
          centerVertex.clone().addScaledVector(axisU, Math.cos(a0) * centerRadius).addScaledVector(axisV, Math.sin(a0) * centerRadius),
          normal,
          FLOWER_CENTER,
          [0, 1],
          0,
        ),
        vertex(
          centerVertex.clone().addScaledVector(axisU, Math.cos(a1) * centerRadius).addScaledVector(axisV, Math.sin(a1) * centerRadius),
          normal,
          FLOWER_CENTER,
          [1, 1],
          0,
        ),
      ],
    );
  }
}

function vertex(
  position: THREE.Vector3,
  normal: THREE.Vector3,
  color: THREE.Color,
  uv: readonly [number, number],
  flowerMask: number,
): Vertex {
  return { position, normal, color, uv, flowerMask };
}

function appendQuad(buffers: GeometryBuffers, vertices: readonly [Vertex, Vertex, Vertex, Vertex]): void {
  const base = buffers.positions.length / 3;
  vertices.forEach((item) => appendVertex(buffers, item));
  buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function appendTriangle(buffers: GeometryBuffers, vertices: readonly [Vertex, Vertex, Vertex]): void {
  const base = buffers.positions.length / 3;
  vertices.forEach((item) => appendVertex(buffers, item));
  buffers.indices.push(base, base + 1, base + 2);
}

function appendVertex(buffers: GeometryBuffers, item: Vertex): void {
  buffers.positions.push(item.position.x, item.position.y, item.position.z);
  buffers.normals.push(item.normal.x, item.normal.y, item.normal.z);
  buffers.colors.push(item.color.r, item.color.g, item.color.b);
  buffers.uvs.push(item.uv[0], item.uv[1]);
  buffers.flowerMasks.push(item.flowerMask);
}
