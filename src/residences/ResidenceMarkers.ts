import * as THREE from 'three';
import { addMesh, shingleMaterial, stoneMaterial, timberMaterial } from '../buildings/buildingMaterials.ts';

export function createResidenceMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Residence';

  const width = 5.2;
  const depth = 6.2;
  const wallHeight = 3.1;
  const roofRise = 2.2;

  addMesh(
    group,
    new THREE.BoxGeometry(width, 0.28, depth),
    stoneMaterial('mid'),
    new THREE.Vector3(0, 0.14, 0),
  );

  addMesh(
    group,
    new THREE.BoxGeometry(width * 0.94, wallHeight, depth * 0.94),
    timberMaterial('mid'),
    new THREE.Vector3(0, 0.28 + wallHeight * 0.5, 0),
  );

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-width * 0.52, 0);
  roofShape.lineTo(0, roofRise);
  roofShape.lineTo(width * 0.52, 0);
  roofShape.closePath();
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: depth * 0.98, bevelEnabled: false });
  roofGeometry.rotateY(Math.PI * 0.5);
  roofGeometry.translate(0, wallHeight + 0.28, 0);
  addMesh(group, roofGeometry, shingleMaterial(), new THREE.Vector3(0, 0, 0));

  addMesh(
    group,
    new THREE.BoxGeometry(1.1, 2.0, 0.16),
    timberMaterial('dark'),
    new THREE.Vector3(0, 1.35, depth * 0.47),
  );

  return group;
}

export class ResidenceMarkers {
  private readonly root: THREE.Group;
  private readonly meshes = new Map<string, THREE.Group>();

  constructor(parent: THREE.Group) {
    this.root = new THREE.Group();
    this.root.name = 'Residences';
    parent.add(this.root);
  }

  syncResidences(
    residences: Iterable<{
      id: string;
      x: number;
      z: number;
      yaw: number;
    }>,
    getHeightAt: (x: number, z: number) => number,
  ): void {
    const nextIds = new Set<string>();
    for (const residence of residences) {
      nextIds.add(residence.id);
      let marker = this.meshes.get(residence.id);
      if (!marker) {
        marker = createResidenceMesh();
        this.root.add(marker);
        this.meshes.set(residence.id, marker);
      }
      const y = getHeightAt(residence.x, residence.z);
      marker.position.set(residence.x, y, residence.z);
      marker.rotation.y = residence.yaw;
    }

    for (const [id, marker] of this.meshes) {
      if (nextIds.has(id)) continue;
      this.root.remove(marker);
      disposeGroup(marker);
      this.meshes.delete(id);
    }
  }

  dispose(): void {
    for (const marker of this.meshes.values()) {
      disposeGroup(marker);
    }
    this.meshes.clear();
    this.root.removeFromParent();
  }
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
  });
}
