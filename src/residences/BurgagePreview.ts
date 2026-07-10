import * as THREE from 'three';
import type { BurgageLayoutResult } from './burgageLayout.ts';
import { getParcelDividerSegments, MAIN_HOUSE_DEPTH, MAIN_HOUSE_WIDTH } from './burgageLayout.ts';

const VALID_ZONE_COLOR = 0x8ec07c;
const INVALID_ZONE_COLOR = 0xd45d4a;
const VALID_ZONE_FILL = 0x8ec07c;
const INVALID_ZONE_FILL = 0xd45d4a;
const PARCEL_FILL_COLOR = 0xc9b07f;
const PARCEL_LINE_COLOR = 0xe8d4a8;
const DIVIDER_LINE_COLOR = 0xf2e3b7;
const CORNER_COLOR = 0xf2e3b7;
const HOUSE_PREVIEW_COLOR = 0xd7b463;
const MAX_PARCEL_FILLS = 12;
const MAX_HOUSE_PREVIEWS = 12;

function writeTriangleFan(
  geometry: THREE.BufferGeometry,
  points: THREE.Vector3[],
  getHeightAt: (x: number, z: number) => number,
  lift: number,
): boolean {
  if (points.length < 3) return false;

  const vertices = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    vertices[i * 3] = point.x;
    vertices[i * 3 + 1] = getHeightAt(point.x, point.z) + lift;
    vertices[i * 3 + 2] = point.z;
  }

  const indices: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    indices.push(0, i, i + 1);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return true;
}

function writeLineLoop(geometry: THREE.BufferGeometry, points: THREE.Vector3[]): void {
  if (points.length < 2) {
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return;
  }
  geometry.setFromPoints(points);
}

function writeDashedLoop(geometry: THREE.BufferGeometry, points: THREE.Vector3[]): void {
  if (points.length < 2) {
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return;
  }
  geometry.setFromPoints(points);
  const line = new THREE.Line(geometry);
  const distances = line.computeLineDistances();
  const lineDistance = distances.geometry.getAttribute('lineDistance');
  if (lineDistance) {
    geometry.setAttribute('lineDistance', lineDistance);
  }
}

function writeLineSegments(geometry: THREE.BufferGeometry, positions: number[]): void {
  if (positions.length === 0) {
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return;
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function cornersSignature(corners: THREE.Vector3[]): string {
  return corners.map((corner) => `${corner.x.toFixed(2)},${corner.z.toFixed(2)}`).join('|');
}

function layoutSignature(layout: BurgageLayoutResult | null): string {
  if (!layout) return 'none';
  return [
    layout.plotCount,
    layout.parcels.map((parcel) => parcel.polygon.map((point) => `${point.x.toFixed(2)},${point.z.toFixed(2)}`).join(':')).join('|'),
    layout.residences.map((residence) => `${residence.x.toFixed(2)},${residence.z.toFixed(2)},${residence.yaw.toFixed(3)}`).join('|'),
  ].join(';');
}

export class BurgagePreview {
  readonly group = new THREE.Group();
  private readonly zoneLine: THREE.Line;
  private readonly zoneLineSolid: THREE.LineBasicMaterial;
  private readonly zoneLineDashed: THREE.LineDashedMaterial;
  private readonly zoneFill: THREE.Mesh;
  private readonly parcelFillMeshes: THREE.Mesh[];
  private readonly parcelFillMaterial: THREE.MeshBasicMaterial;
  private readonly parcelLines: THREE.LineSegments;
  private readonly dividerLines: THREE.LineSegments;
  private readonly cornerMarkers: THREE.InstancedMesh;
  private readonly houseMeshes: THREE.InstancedMesh;
  private lastSignature = '';
  private readonly cornerMatrix = new THREE.Matrix4();
  private readonly houseMatrix = new THREE.Matrix4();
  private readonly houseScale = new THREE.Vector3(MAIN_HOUSE_WIDTH, 5.4, MAIN_HOUSE_DEPTH);

  constructor() {
    this.group.name = 'Residence preview';

    this.zoneLineSolid = new THREE.LineBasicMaterial({
      color: VALID_ZONE_COLOR,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    this.zoneLineDashed = new THREE.LineDashedMaterial({
      color: VALID_ZONE_COLOR,
      transparent: true,
      opacity: 0.95,
      dashSize: 2.4,
      gapSize: 1.4,
      depthTest: false,
    });
    this.zoneLine = new THREE.Line(
      new THREE.BufferGeometry(),
      this.zoneLineDashed,
    );
    this.zoneLine.renderOrder = 14;
    this.group.add(this.zoneLine);

    this.zoneFill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: VALID_ZONE_FILL,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.zoneFill.renderOrder = 12;
    this.group.add(this.zoneFill);

    this.parcelFillMaterial = new THREE.MeshBasicMaterial({
      color: PARCEL_FILL_COLOR,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    this.parcelFillMeshes = [];
    for (let i = 0; i < MAX_PARCEL_FILLS; i++) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.parcelFillMaterial);
      mesh.renderOrder = 12;
      mesh.visible = false;
      this.parcelFillMeshes.push(mesh);
      this.group.add(mesh);
    }

    this.parcelLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: PARCEL_LINE_COLOR,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    this.parcelLines.renderOrder = 13;
    this.group.add(this.parcelLines);

    this.dividerLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: DIVIDER_LINE_COLOR,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      }),
    );
    this.dividerLines.renderOrder = 13;
    this.group.add(this.dividerLines);

    const cornerGeometry = new THREE.SphereGeometry(0.55, 8, 8);
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

    const houseGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.houseMeshes = new THREE.InstancedMesh(
      houseGeometry,
      new THREE.MeshBasicMaterial({
        color: HOUSE_PREVIEW_COLOR,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        depthTest: false,
      }),
      MAX_HOUSE_PREVIEWS,
    );
    this.houseMeshes.renderOrder = 15;
    this.group.add(this.houseMeshes);
  }

  update(
    corners: THREE.Vector3[],
    layout: BurgageLayoutResult | null,
    valid: boolean,
    getHeightAt: (x: number, z: number) => number,
    placing = false,
  ): void {
    if (corners.length === 0) {
      this.clear();
      return;
    }

    const signature = `${cornersSignature(corners)}|${valid ? 1 : 0}|${layoutSignature(layout)}|${placing ? 1 : 0}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.group.visible = true;
    const edgeColor = valid ? VALID_ZONE_COLOR : INVALID_ZONE_COLOR;
    const fillColor = valid ? VALID_ZONE_FILL : INVALID_ZONE_FILL;
    const outlineMaterial = placing ? this.zoneLineDashed : this.zoneLineSolid;
    this.zoneLine.material = outlineMaterial;
    outlineMaterial.color.setHex(edgeColor);
    (this.zoneFill.material as THREE.MeshBasicMaterial).color.setHex(fillColor);

    const placedCornerCount = Math.min(corners.length, 4);
    this.cornerMarkers.count = placedCornerCount;
    for (let i = 0; i < placedCornerCount; i++) {
      const corner = corners[i];
      const y = getHeightAt(corner.x, corner.z) + 0.35;
      this.cornerMatrix.identity();
      this.cornerMatrix.setPosition(corner.x, y, corner.z);
      this.cornerMarkers.setMatrixAt(i, this.cornerMatrix);
    }
    this.cornerMarkers.instanceMatrix.needsUpdate = placedCornerCount > 0;

    const lifted = corners.map((corner) => {
      const y = getHeightAt(corner.x, corner.z) + 0.2;
      return new THREE.Vector3(corner.x, y, corner.z);
    });

    if (lifted.length >= 2) {
      const loop = [...lifted];
      if (lifted.length >= 4) loop.push(lifted[0]);
      if (placing) {
        writeDashedLoop(this.zoneLine.geometry, loop);
      } else {
        writeLineLoop(this.zoneLine.geometry, loop);
      }
    } else {
      writeLineLoop(this.zoneLine.geometry, []);
    }

    const hasFill = writeTriangleFan(this.zoneFill.geometry, corners, getHeightAt, 0.14);
    this.zoneFill.visible = hasFill;

    const parcelPositions: number[] = [];
    const dividerPositions: number[] = [];
    let parcelFillCount = 0;

    if (layout) {
      for (const parcel of layout.parcels) {
        const poly = parcel.polygon.map((point) => new THREE.Vector3(point.x, 0, point.z));
        if (parcelFillCount < MAX_PARCEL_FILLS) {
          const mesh = this.parcelFillMeshes[parcelFillCount];
          const filled = writeTriangleFan(mesh.geometry, poly, getHeightAt, 0.16);
          mesh.visible = filled;
          parcelFillCount += 1;
        }

        const outline = poly.map((point) => {
          const y = getHeightAt(point.x, point.z) + 0.18;
          return new THREE.Vector3(point.x, y, point.z);
        });
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i];
          const b = outline[(i + 1) % outline.length];
          parcelPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }

      for (const [start, end] of getParcelDividerSegments(layout)) {
        const aY = getHeightAt(start.x, start.z) + 0.2;
        const bY = getHeightAt(end.x, end.z) + 0.2;
        dividerPositions.push(start.x, aY, start.z, end.x, bY, end.z);
      }
    }

    for (let i = parcelFillCount; i < MAX_PARCEL_FILLS; i++) {
      this.parcelFillMeshes[i].visible = false;
    }

    writeLineSegments(this.parcelLines.geometry, parcelPositions);
    writeLineSegments(this.dividerLines.geometry, dividerPositions);

    const houseCount = layout?.residences.length ?? 0;
    this.houseMeshes.count = houseCount;
    for (let i = 0; i < houseCount; i++) {
      const residence = layout!.residences[i];
      const y = getHeightAt(residence.x, residence.z) + this.houseScale.y * 0.5;
      this.houseMatrix.identity();
      this.houseMatrix.makeRotationY(residence.yaw);
      this.houseMatrix.setPosition(residence.x, y, residence.z);
      this.houseMatrix.scale(this.houseScale);
      this.houseMeshes.setMatrixAt(i, this.houseMatrix);
    }
    this.houseMeshes.instanceMatrix.needsUpdate = houseCount > 0;
  }

  clear(): void {
    this.lastSignature = '';
    this.group.visible = false;
    this.cornerMarkers.count = 0;
    this.cornerMarkers.instanceMatrix.needsUpdate = true;
    this.zoneFill.visible = false;
    this.houseMeshes.count = 0;
    this.houseMeshes.instanceMatrix.needsUpdate = true;
    for (const mesh of this.parcelFillMeshes) {
      mesh.visible = false;
    }
  }

  dispose(): void {
    this.zoneLine.geometry.dispose();
    this.zoneLineSolid.dispose();
    this.zoneLineDashed.dispose();
    this.zoneFill.geometry.dispose();
    (this.zoneFill.material as THREE.Material).dispose();
    for (const mesh of this.parcelFillMeshes) {
      mesh.geometry.dispose();
    }
    this.parcelFillMaterial.dispose();
    this.parcelLines.geometry.dispose();
    (this.parcelLines.material as THREE.Material).dispose();
    this.dividerLines.geometry.dispose();
    (this.dividerLines.material as THREE.Material).dispose();
    this.cornerMarkers.geometry.dispose();
    (this.cornerMarkers.material as THREE.Material).dispose();
    this.houseMeshes.geometry.dispose();
    (this.houseMeshes.material as THREE.Material).dispose();
    this.group.clear();
  }
}
