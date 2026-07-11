import * as THREE from 'three';
import { backyardIconPosition } from './backyardPosition.ts';
import { createBackyardGardenMesh } from './backyardGardenMesh.ts';
import type { BackyardGardenState, BurgageZoneState, ResidenceState } from '../resources/types.ts';
import { disposeObject3D } from '../utils/dispose.ts';

type GardenSyncInput = {
  residences: Iterable<ResidenceState>;
  zones: Iterable<BurgageZoneState>;
  gardens: Map<string, BackyardGardenState>;
  getHeightAt: (x: number, z: number) => number;
};

export class BackyardGardenMarkers {
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Group>();

  constructor(parent: THREE.Group) {
    this.root.name = 'Backyard gardens';
    parent.add(this.root);
  }

  syncGardens(input: GardenSyncInput): void {
    const zonesById = new Map<string, BurgageZoneState>();
    for (const zone of input.zones) {
      zonesById.set(zone.id, zone);
    }

    const nextIds = new Set<string>();
    for (const residence of input.residences) {
      const garden = input.gardens.get(residence.id);
      if (!garden) continue;

      const zone = zonesById.get(residence.zoneId);
      if (!zone) continue;

      const position = backyardIconPosition(residence, zone);
      if (!position) continue;

      nextIds.add(residence.id);
      let marker = this.meshes.get(residence.id);
      if (!marker || marker.name !== `BackyardGarden:${garden.kind}`) {
        if (marker) {
          this.root.remove(marker);
          disposeObject3D(marker);
        }
        marker = createBackyardGardenMesh(garden.kind);
        this.root.add(marker);
        this.meshes.set(residence.id, marker);
      }

      const y = input.getHeightAt(position.x, position.z);
      marker.position.set(position.x, y, position.z);
      marker.rotation.y = residence.yaw;
    }

    for (const [id, marker] of this.meshes) {
      if (nextIds.has(id)) continue;
      this.root.remove(marker);
      disposeObject3D(marker);
      this.meshes.delete(id);
    }
  }

  dispose(): void {
    for (const marker of this.meshes.values()) {
      disposeObject3D(marker);
    }
    this.meshes.clear();
    this.root.removeFromParent();
  }
}
