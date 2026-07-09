import * as THREE from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RiverField } from './RiverField.ts';

const Y_OFFSET = 0.048;
const BANK_WIDTH = 6.5;
const INNER_MARGIN = 0.2;

type ShoreNode = {
  ix: number;
  iz: number;
  x: number;
  z: number;
  outwardX: number;
  outwardZ: number;
};

export function createRiverBankMeshes(
  terrain: Terrain,
  riverField: RiverField,
  material: MeshStandardNodeMaterial,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'River banks';

  const mesh = buildShorePatchMesh(terrain, riverField, material);
  mesh.name = 'River bank shore';
  mesh.renderOrder = 9;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  group.add(mesh);

  return group;
}

function buildShorePatchMesh(
  terrain: Terrain,
  riverField: RiverField,
  material: MeshStandardNodeMaterial,
): THREE.Mesh {
  const shoreNodes = collectShoreNodes(riverField);
  const cellStep = (riverField.stepX + riverField.stepZ) * 0.5;
  const patchHalf = cellStep * 0.52;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const node of shoreNodes.values()) {
    const outward = new THREE.Vector3(node.outwardX, 0, node.outwardZ).normalize();
    const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
    const innerLeft = new THREE.Vector3(node.x, 0, node.z)
      .addScaledVector(outward, INNER_MARGIN)
      .addScaledVector(tangent, patchHalf);
    const innerRight = new THREE.Vector3(node.x, 0, node.z)
      .addScaledVector(outward, INNER_MARGIN)
      .addScaledVector(tangent, -patchHalf);
    const outerLeft = innerLeft.clone().addScaledVector(outward, BANK_WIDTH);
    const outerRight = innerRight.clone().addScaledVector(outward, BANK_WIDTH);

    pushOutOfWater(innerLeft, outward, riverField);
    pushOutOfWater(innerRight, outward, riverField);
    pushOutOfWater(outerLeft, outward, riverField);
    pushOutOfWater(outerRight, outward, riverField);

    if (riverField.isRenderedWetAt(outerLeft.x, outerLeft.z)) continue;
    if (riverField.isRenderedWetAt(outerRight.x, outerRight.z)) continue;

    const verts = [innerLeft, innerRight, outerLeft, outerRight];
    const base = positions.length / 3;
    for (const p of verts) {
      p.y = terrain.getHeightAt(p.x, p.z) + Y_OFFSET;
      positions.push(p.x, p.y, p.z);
    }

    uvs.push(1, 0, 1, 1, 0, 0, 0, 1);

    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  return createMesh(positions, uvs, indices, material);
}

function collectShoreNodes(riverField: RiverField): Map<number, ShoreNode> {
  const { resolution, startX, startZ, stepX, stepZ } = riverField;
  const nodes = new Map<number, ShoreNode>();

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      if (riverField.isRenderedWetAtGrid(ix, iz)) continue;

      let outwardX = 0;
      let outwardZ = 0;
      let wetNeighbors = 0;
      const neighborDirs: Array<[number, number, number, number]> = [
        [1, 0, -1, 0],
        [-1, 0, 1, 0],
        [0, 1, 0, -1],
        [0, -1, 0, 1],
      ];

      for (const [dx, dz, ox, oz] of neighborDirs) {
        if (!riverField.isRenderedWetAtGrid(ix + dx, iz + dz)) continue;
        outwardX += ox;
        outwardZ += oz;
        wetNeighbors += 1;
      }
      if (wetNeighbors === 0) continue;

      const len = Math.hypot(outwardX, outwardZ) || 1;
      nodes.set(nodeKey(ix, iz, resolution), {
        ix,
        iz,
        x: startX + ix * stepX,
        z: startZ + iz * stepZ,
        outwardX: outwardX / len,
        outwardZ: outwardZ / len,
      });
    }
  }

  return nodes;
}

function pushOutOfWater(
  pos: THREE.Vector3,
  outward: THREE.Vector3,
  riverField: RiverField,
): void {
  for (let step = 0; step < 8 && riverField.isRenderedWetAt(pos.x, pos.z); step++) {
    pos.addScaledVector(outward, 0.42);
  }
}

function createMesh(
  positions: number[],
  uvs: number[],
  indices: number[],
  material: MeshStandardNodeMaterial,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

function nodeKey(ix: number, iz: number, resolution: number): number {
  return iz * resolution + ix;
}
