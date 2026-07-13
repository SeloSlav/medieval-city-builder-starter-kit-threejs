import * as THREE from 'three';
import { backyardGardenPlacement } from './backyardPosition.ts';
import {
  createBackyardGardenMesh,
  disposeBackyardGardenMesh,
} from './backyardGardenMesh.ts';
import type { BackyardGardenState, BurgageZoneState, ResidenceState } from '../resources/types.ts';
import { hashStringSeed } from '../utils/random.ts';
import type { BackyardPlantCatalog } from '../vegetation/seedthree/backyardPlantAssets.ts';

type GardenSyncInput = {
  residences: Iterable<ResidenceState>;
  zones: Iterable<BurgageZoneState>;
  gardens: Map<string, BackyardGardenState>;
  getHeightAt: (x: number, z: number) => number;
};

type BackyardGardenMarkerOptions = {
  maxAnisotropy?: number;
  useSeedThree?: boolean;
};

type ReplayableGardenSyncInput = Omit<GardenSyncInput, 'residences' | 'zones'> & {
  residences: ResidenceState[];
  zones: BurgageZoneState[];
};

export class BackyardGardenMarkers {
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Group>();
  private plants: BackyardPlantCatalog | null = null;
  private latestInput: ReplayableGardenSyncInput | null = null;
  private disposed = false;

  constructor(parent: THREE.Group, options: BackyardGardenMarkerOptions = {}) {
    this.root.name = 'Backyard gardens';
    parent.add(this.root);

    if (options.useSeedThree) {
      void import('../vegetation/seedthree/backyardPlantAssets.ts').then(
        ({ loadBackyardPlantCatalog }) => loadBackyardPlantCatalog(options.maxAnisotropy ?? 4),
      ).then(
        (plants) => {
          if (this.disposed) return;
          this.plants = plants;
          if (this.latestInput) this.syncReplayable(this.latestInput);
        },
        (error: unknown) => {
          console.warn('[SeedThree] backyard plant assets failed to load; retaining procedural fallbacks.', error);
        },
      );
    }
  }

  syncGardens(input: GardenSyncInput): void {
    const replayable: ReplayableGardenSyncInput = {
      ...input,
      residences: Array.from(input.residences),
      zones: Array.from(input.zones),
    };
    this.latestInput = replayable;
    this.syncReplayable(replayable);
  }

  private syncReplayable(input: ReplayableGardenSyncInput): void {
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

      const placement = backyardGardenPlacement(residence, zone);
      if (!placement) continue;

      nextIds.add(residence.id);
      let marker = this.meshes.get(residence.id);
      const visualKey = [
        garden.kind,
        placement.width.toFixed(2),
        placement.depth.toFixed(2),
        this.plants ? 'seedthree' : 'fallback',
      ].join(':');
      if (!marker || marker.userData.visualKey !== visualKey) {
        if (marker) {
          this.root.remove(marker);
          disposeBackyardGardenMesh(marker);
        }
        marker = createBackyardGardenMesh(garden.kind, {
          width: placement.width,
          depth: placement.depth,
          seed: hashStringSeed(residence.id),
          plants: this.plants,
        });
        marker.userData.visualKey = visualKey;
        this.root.add(marker);
        this.meshes.set(residence.id, marker);
      }

      const y = input.getHeightAt(placement.x, placement.z);
      marker.position.set(placement.x, y, placement.z);
      marker.rotation.y = residence.yaw;
    }

    for (const [id, marker] of this.meshes) {
      if (nextIds.has(id)) continue;
      this.root.remove(marker);
      disposeBackyardGardenMesh(marker);
      this.meshes.delete(id);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.latestInput = null;
    for (const marker of this.meshes.values()) {
      disposeBackyardGardenMesh(marker);
    }
    this.meshes.clear();
    this.root.removeFromParent();
  }
}
