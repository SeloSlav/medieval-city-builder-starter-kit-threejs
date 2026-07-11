import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose.ts';
import type { DeliveryTripState } from '../logistics/deliveryTrips.ts';
import { createDeliveryCartMesh } from '../logistics/deliveryCartMesh.ts';
import type { Terrain } from '../terrain/Terrain.ts';

const TICK_BLEND_SEC = 0.2;

type TripVisual = {
  mesh: THREE.Group;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  blend: number;
  yaw: number;
};

type DeliveryAgentRendererOptions = {
  terrain: Terrain;
  parent: THREE.Group;
};

export class DeliveryAgentRenderer {
  private readonly terrain: Terrain;
  private readonly group = new THREE.Group();
  private readonly visuals = new Map<string, TripVisual>();

  constructor(options: DeliveryAgentRendererOptions) {
    this.terrain = options.terrain;
    this.group.name = 'Delivery agents';
    options.parent.add(this.group);
  }

  syncTrips(trips: Iterable<DeliveryTripState>): void {
    const nextIds = new Set<string>();
    for (const trip of trips) {
      nextIds.add(trip.id);
      const existing = this.visuals.get(trip.id);
      if (existing) {
        const dx = trip.x - existing.toX;
        const dz = trip.z - existing.toZ;
        if (Math.hypot(dx, dz) > 0.05) {
          existing.yaw = Math.atan2(dx, dz);
        }
        existing.fromX = existing.toX;
        existing.fromZ = existing.toZ;
        existing.toX = trip.x;
        existing.toZ = trip.z;
        existing.blend = 0;
        this.ensureCartMesh(existing, trip);
        continue;
      }

      const mesh = createDeliveryCartMesh(trip.cargoKind);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      this.visuals.set(trip.id, {
        mesh,
        fromX: trip.x,
        fromZ: trip.z,
        toX: trip.x,
        toZ: trip.z,
        blend: 1,
        yaw: 0,
      });
    }

    for (const id of this.visuals.keys()) {
      if (nextIds.has(id)) continue;
      this.removeTrip(id);
    }
  }

  update(dt: number): void {
    for (const visual of this.visuals.values()) {
      visual.blend = Math.min(1, visual.blend + dt / TICK_BLEND_SEC);
      const t = smoothstep(visual.blend);
      const x = THREE.MathUtils.lerp(visual.fromX, visual.toX, t);
      const z = THREE.MathUtils.lerp(visual.fromZ, visual.toZ, t);
      const y = this.terrain.getHeightAt(x, z) + 0.05;
      visual.mesh.position.set(x, y, z);
      visual.mesh.rotation.y = visual.yaw;
    }
  }

  dispose(): void {
    for (const id of [...this.visuals.keys()]) {
      this.removeTrip(id);
    }
    this.group.removeFromParent();
  }

  private ensureCartMesh(visual: TripVisual, trip: DeliveryTripState): void {
    if (visual.mesh.name === `DeliveryCart:${trip.cargoKind}`) return;
    const replacement = createDeliveryCartMesh(trip.cargoKind);
    replacement.position.copy(visual.mesh.position);
    replacement.rotation.copy(visual.mesh.rotation);
    replacement.castShadow = true;
    this.group.remove(visual.mesh);
    disposeObject3D(visual.mesh);
    this.group.add(replacement);
    visual.mesh = replacement;
  }

  private removeTrip(id: string): void {
    const visual = this.visuals.get(id);
    if (!visual) return;
    disposeObject3D(visual.mesh);
    visual.mesh.removeFromParent();
    this.visuals.delete(id);
  }
}

function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
