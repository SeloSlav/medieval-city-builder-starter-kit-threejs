import * as THREE from 'three';
import type { BurgageLayoutResult } from './burgageLayout.ts';

const VALID_ZONE_COLOR = 0x8ec07c;
const INVALID_ZONE_COLOR = 0xd45d4a;
const PARCEL_LINE_COLOR = 0xc9b07f;
const HOUSE_COLOR = 0xd7b463;
const CORNER_COLOR = 0xf2e3b7;

export class BurgagePreview {
  readonly group = new THREE.Group();
  private readonly zoneLine: THREE.Line;
  private readonly parcelLines: THREE.LineSegments;
  private readonly houseMeshes: THREE.InstancedMesh;
  private readonly cornerMarkers: THREE.InstancedMesh;

  constructor() {
    this.group.name = 'Residence preview';

    const zoneGeometry = new THREE.BufferGeometry();
    this.zoneLine = new THREE.Line(
      zoneGeometry,
      new THREE.LineBasicMaterial({
        color: VALID_ZONE_COLOR,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    );
    this.zoneLine.renderOrder = 14;
    this.group.add(this.zoneLine);

    const parcelGeometry = new THREE.BufferGeometry();
    this.parcelLines = new THREE.LineSegments(
      parcelGeometry,
      new THREE.LineBasicMaterial({
        color: PARCEL_LINE_COLOR,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    this.parcelLines.renderOrder = 13;
    this.group.add(this.parcelLines);

    const houseGeometry = new THREE.PlaneGeometry(1, 1);
    houseGeometry.rotateX(-Math.PI * 0.5);
    this.houseMeshes = new THREE.InstancedMesh(
      houseGeometry,
      new THREE.MeshBasicMaterial({
        color: HOUSE_COLOR,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
      12,
    );
    this.houseMeshes.renderOrder = 15;
    this.group.add(this.houseMeshes);

    const cornerGeometry = new THREE.SphereGeometry(0.55, 10, 10);
    this.cornerMarkers = new THREE.InstancedMesh(
      cornerGeometry,
      new THREE.MeshBasicMaterial({
        color: CORNER_COLOR,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
      }),
      4,
    );
    this.cornerMarkers.renderOrder = 16;
    this.group.add(this.cornerMarkers);
  }

  update(
    corners: THREE.Vector3[],
    layout: BurgageLayoutResult | null,
    valid: boolean,
    getHeightAt: (x: number, z: number) => number,
  ): void {
    if (corners.length === 0) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    (this.zoneLine.material as THREE.LineBasicMaterial).color.setHex(valid ? VALID_ZONE_COLOR : INVALID_ZONE_COLOR);

    const placedCornerCount = Math.min(corners.length, 4);
    const cornerMatrix = new THREE.Matrix4();
    this.cornerMarkers.count = placedCornerCount;
    for (let i = 0; i < placedCornerCount; i++) {
      const corner = corners[i];
      const y = getHeightAt(corner.x, corner.z) + 0.35;
      cornerMatrix.identity();
      cornerMatrix.setPosition(corner.x, y, corner.z);
      this.cornerMarkers.setMatrixAt(i, cornerMatrix);
    }
    this.cornerMarkers.instanceMatrix.needsUpdate = placedCornerCount > 0;

    const lifted = corners.map((corner) => {
      const y = getHeightAt(corner.x, corner.z) + 0.18;
      return new THREE.Vector3(corner.x, y, corner.z);
    });

    if (lifted.length >= 2) {
      const loop = [...lifted];
      if (lifted.length === 4) loop.push(lifted[0].clone());
      this.zoneLine.geometry.dispose();
      this.zoneLine.geometry = new THREE.BufferGeometry().setFromPoints(loop);
    }

    const parcelPositions: number[] = [];
    if (layout) {
      for (const parcel of layout.parcels) {
        const poly = parcel.polygon.map((point) => {
          const y = getHeightAt(point.x, point.z) + 0.16;
          return new THREE.Vector3(point.x, y, point.z);
        });
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          parcelPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
    this.parcelLines.geometry.dispose();
    this.parcelLines.geometry = new THREE.BufferGeometry();
    if (parcelPositions.length > 0) {
      this.parcelLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(parcelPositions, 3));
    }

    const matrix = new THREE.Matrix4();
    const count = layout?.residences.length ?? 0;
    this.houseMeshes.count = count;
    for (let i = 0; i < count; i++) {
      const residence = layout!.residences[i];
      const y = getHeightAt(residence.x, residence.z) + 0.2;
      matrix.identity();
      matrix.makeRotationY(residence.yaw);
      matrix.setPosition(residence.x, y, residence.z);
      matrix.scale(new THREE.Vector3(5.2, 1, 6.2));
      this.houseMeshes.setMatrixAt(i, matrix);
    }
    this.houseMeshes.instanceMatrix.needsUpdate = count > 0;
  }

  clear(): void {
    this.group.visible = false;
    this.houseMeshes.count = 0;
    this.houseMeshes.instanceMatrix.needsUpdate = true;
    this.cornerMarkers.count = 0;
    this.cornerMarkers.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.zoneLine.geometry.dispose();
    (this.zoneLine.material as THREE.Material).dispose();
    this.parcelLines.geometry.dispose();
    (this.parcelLines.material as THREE.Material).dispose();
    this.houseMeshes.geometry.dispose();
    (this.houseMeshes.material as THREE.Material).dispose();
    this.cornerMarkers.geometry.dispose();
    (this.cornerMarkers.material as THREE.Material).dispose();
    this.group.clear();
  }
}
