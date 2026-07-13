import * as THREE from 'three';
import type { FarmCrop, FarmFieldStage, FarmFieldState } from '../resources/types.ts';
import { bilinearPoint, type FarmFieldCorners } from './farmFieldMath.ts';

const GRID_STEPS = 10;
const FIELD_LIFT = 0.08;

function fieldColor(crop: FarmCrop, stage: FarmFieldStage): number {
  if (stage === 'ploughing') return 0x5c3b21;
  if (stage === 'sowing') return 0x7c5830;
  if (stage === 'harvesting') return 0xb38a31;
  if (crop === 'oats') return 0x9da653;
  if (crop === 'fallow') return 0x657440;
  return 0xa88c3f;
}

function createSurface(
  corners: FarmFieldCorners,
  getHeightAt: (x: number, z: number) => number,
  color: number,
  opacity: number,
): THREE.Mesh {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let v = 0; v <= GRID_STEPS; v++) {
    for (let u = 0; u <= GRID_STEPS; u++) {
      const point = bilinearPoint(corners, u / GRID_STEPS, v / GRID_STEPS);
      vertices.push(point.x, getHeightAt(point.x, point.z) + FIELD_LIFT, point.z);
    }
  }
  const stride = GRID_STEPS + 1;
  for (let v = 0; v < GRID_STEPS; v++) {
    for (let u = 0; u < GRID_STEPS; u++) {
      const a = v * stride + u;
      const b = a + 1;
      const d = (v + 1) * stride + u;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function createRows(
  corners: FarmFieldCorners,
  getHeightAt: (x: number, z: number) => number,
  color: number,
): THREE.LineSegments {
  const vertices: number[] = [];
  const rows = Math.max(3, Math.min(32, Math.floor(Math.hypot(corners[3].x - corners[0].x, corners[3].z - corners[0].z) / 1.4)));
  for (let row = 1; row < rows; row++) {
    const v = row / rows;
    for (let segment = 0; segment < GRID_STEPS; segment++) {
      for (const u of [segment / GRID_STEPS, (segment + 1) / GRID_STEPS]) {
        const point = bilinearPoint(corners, u, v);
        vertices.push(point.x, getHeightAt(point.x, point.z) + FIELD_LIFT + 0.035, point.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 }));
}

function createOutline(
  corners: FarmFieldCorners,
  getHeightAt: (x: number, z: number) => number,
  color: number,
): THREE.LineSegments {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < corners.length; index++) {
    for (const point of [corners[index], corners[(index + 1) % corners.length]]) {
      points.push(new THREE.Vector3(point.x, getHeightAt(point.x, point.z) + FIELD_LIFT + 0.06, point.z));
    }
  }
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
    for (const material of materials) material.dispose();
  });
  root.clear();
}

export class FarmFieldMarkers {
  private readonly root = new THREE.Group();
  private lastSignature = '';
  private readonly getHeightAt: (x: number, z: number) => number;

  constructor(
    parent: THREE.Group,
    getHeightAt: (x: number, z: number) => number,
  ) {
    this.getHeightAt = getHeightAt;
    this.root.name = 'Farm fields';
    parent.add(this.root);
  }

  syncFields(fields: Iterable<FarmFieldState>): void {
    const list = [...fields];
    const signature = list.map((field) => `${field.id}:${field.crop}:${field.stage}:${field.corners.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(';')}`).join('|');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    disposeObject(this.root);
    for (const field of list) {
      const corners = field.corners as FarmFieldCorners;
      const group = new THREE.Group();
      group.name = `Field ${field.id}`;
      const color = fieldColor(field.crop, field.stage);
      group.add(createSurface(corners, this.getHeightAt, color, 0.92));
      group.add(createRows(corners, this.getHeightAt, field.stage === 'growing' ? 0xd7c76a : 0x3f2b1d));
      group.add(createOutline(corners, this.getHeightAt, 0xd1b56b));
      this.root.add(group);
    }
  }

  dispose(): void {
    disposeObject(this.root);
    this.root.removeFromParent();
  }
}

export class FarmFieldPreview {
  readonly group = new THREE.Group();
  private readonly getHeightAt: (x: number, z: number) => number;

  constructor(getHeightAt: (x: number, z: number) => number) {
    this.getHeightAt = getHeightAt;
    this.group.name = 'Farm field preview';
  }

  show(corners: FarmFieldCorners | null, valid: boolean, crop: FarmCrop): void {
    disposeObject(this.group);
    if (!corners) return;
    const color = valid ? fieldColor(crop, 'growing') : 0xa43b2f;
    this.group.add(createSurface(corners, this.getHeightAt, color, 0.48));
    this.group.add(createOutline(corners, this.getHeightAt, valid ? 0xe5cf76 : 0xff5f4f));
  }

  dispose(): void {
    disposeObject(this.group);
    this.group.removeFromParent();
  }
}
