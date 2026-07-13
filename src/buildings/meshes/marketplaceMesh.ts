import * as THREE from 'three';
import {
  addMesh,
  metalMaterial,
  stoneMaterial,
  tileMaterial,
  timberMaterial,
} from '../buildingMaterials.ts';
import { addTriangularGableWall } from '../meshPrimitives.ts';
import { addBarrel, addCrate } from './buildingMeshKit.ts';

function addMarketTable(group: THREE.Group, x: number, z: number, rotation = 0): void {
  const table = new THREE.Group();
  table.position.set(x, 0, z);
  table.rotation.y = rotation;
  addMesh(
    table,
    new THREE.BoxGeometry(2.0, 0.16, 0.86),
    timberMaterial('light'),
    new THREE.Vector3(0, 0.98, 0),
  );
  for (const px of [-0.72, 0.72]) {
    for (const pz of [-0.27, 0.27]) {
      addMesh(
        table,
        new THREE.BoxGeometry(0.13, 0.9, 0.13),
        timberMaterial('dark'),
        new THREE.Vector3(px, 0.48, pz),
      );
    }
  }
  group.add(table);
}

/** Open Croatian market loggia: a permanent civic roof, not a carnival tent. */
export function createMarketplaceMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Marketplace';
  const width = 7.55;
  const depth = 5.35;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const floorY = 0.24;
  const wallTop = 3.15;
  const ridgeHeight = 2.05;
  const pitch = Math.atan2(ridgeHeight, halfW);
  const slope = halfW / Math.cos(pitch) + 0.3;

  addMesh(
    group,
    new THREE.BoxGeometry(width + 0.55, floorY, depth + 0.55),
    stoneMaterial('light'),
    new THREE.Vector3(0, floorY * 0.5, 0),
  );
  for (const z of [-halfD + 0.28, halfD - 0.28]) {
    addMesh(
      group,
      new THREE.BoxGeometry(width - 0.3, 0.24, 0.42),
      stoneMaterial('mid'),
      new THREE.Vector3(0, 0.36, z),
    );
  }

  for (const x of [-halfW + 0.38, 0, halfW - 0.38]) {
    for (const z of [-halfD + 0.3, halfD - 0.3]) {
      addMesh(
        group,
        new THREE.BoxGeometry(0.28, wallTop - floorY, 0.28),
        timberMaterial('dark'),
        new THREE.Vector3(x, floorY + (wallTop - floorY) * 0.5, z),
      );
      addMesh(
        group,
        new THREE.BoxGeometry(0.5, 0.18, 0.5),
        stoneMaterial('light'),
        new THREE.Vector3(x, floorY + 0.09, z),
      );
    }
  }
  for (const z of [-halfD + 0.3, halfD - 0.3]) {
    addMesh(
      group,
      new THREE.BoxGeometry(width - 0.32, 0.2, 0.22),
      timberMaterial('weathered'),
      new THREE.Vector3(0, wallTop - 0.08, z),
    );
  }

  for (const side of [-1, 1] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(slope, 0.14, depth + 0.58),
      tileMaterial(side > 0 ? 0 : 1),
      new THREE.Vector3(side * halfW * 0.46, wallTop + ridgeHeight * 0.48, 0),
      new THREE.Euler(0, 0, side * -pitch),
    );
    for (let row = 0; row < 4; row++) {
      const t = (row + 0.5) / 4.8;
      addMesh(
        group,
        new THREE.BoxGeometry(0.07, 0.055, depth + 0.6),
        tileMaterial(row % 2 === 0 ? 0 : 1),
        new THREE.Vector3(side * halfW * (1 - t), wallTop + ridgeHeight * t + 0.02, 0),
        new THREE.Euler(0, 0, side * -pitch),
      );
    }
  }
  addMesh(
    group,
    new THREE.BoxGeometry(0.24, 0.18, depth + 0.72),
    tileMaterial(2),
    new THREE.Vector3(0, wallTop + ridgeHeight + 0.04, 0),
  );
  for (const zSign of [-1, 1] as const) {
    addTriangularGableWall(
      group,
      'z',
      zSign * (halfD - 0.05),
      halfW,
      wallTop,
      ridgeHeight,
      0.14,
      timberMaterial('weathered'),
    );
  }

  addMarketTable(group, -1.95, -0.65);
  addMarketTable(group, 1.15, -0.65);
  addMarketTable(group, -0.45, 1.15);
  addCrate(group, 2.65, 1.45, 0.86);
  addCrate(group, 2.8, 0.55, 0.72);
  addBarrel(group, -2.8, 1.45, 0.88);

  // A simple hanging steelyard gives the open loggia a strong trade silhouette.
  addMesh(
    group,
    new THREE.BoxGeometry(1.55, 0.08, 0.08),
    metalMaterial('iron'),
    new THREE.Vector3(0, 2.55, halfD - 0.22),
    new THREE.Euler(0, 0, 0.08),
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.022, 0.022, 0.72, 6),
    metalMaterial('iron'),
    new THREE.Vector3(0.48, 2.18, halfD - 0.22),
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.34, 0.28, 0.08, 12),
    metalMaterial('iron'),
    new THREE.Vector3(0.48, 1.8, halfD - 0.22),
  );
  return group;
}
