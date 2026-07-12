import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose.ts';
import type { RoadNetwork } from '../roads/RoadNetwork.ts';
import type { ResidenceState } from '../resources/types.ts';
import { polylineLengthXZ, samplePolylineXZ, type PointXZ } from '../utils/pathGeometry.ts';
import { createVillagerMesh } from './villagerMesh.ts';
import {
  computeVillagerSlots,
  findNearestRoadEdgePath,
  pickIdleDuration,
  pickIdleOffset,
  pickVillagerAppearanceSeed,
  pickVillagerWalkPath,
  pickWalkSpeed,
  residenceDoorPosition,
} from './villagerPaths.ts';

type VillagerMode = 'idle' | 'walk';

type VillagerAgent = {
  id: string;
  residenceId: string;
  slotIndex: number;
  mesh: THREE.Group;
  mode: VillagerMode;
  path: PointXZ[];
  pathDistance: number;
  pathCursor: number;
  idleRemaining: number;
  walkSpeed: number;
  appearanceSeed: number;
  idleOffset: { x: number; z: number; yaw: number };
  pathSeed: number;
  idleDirty: boolean;
  nearestEdge: { path: PointXZ[]; distance: number } | null;
};

export type VillagerRendererOptions = {
  parent: THREE.Group;
  getHeightAt: (x: number, z: number) => number;
  getRoadDeckY?: (x: number, z: number) => number | null;
};

export class VillagerRenderer {
  private readonly group = new THREE.Group();
  private readonly getHeightAt: (x: number, z: number) => number;
  private readonly getRoadDeckY: ((x: number, z: number) => number | null) | null;
  private readonly agents = new Map<string, VillagerAgent>();
  private residences = new Map<string, ResidenceState>();
  private roadNetwork: RoadNetwork | null = null;

  constructor(options: VillagerRendererOptions) {
    this.getHeightAt = options.getHeightAt;
    this.getRoadDeckY = options.getRoadDeckY ?? null;
    this.group.name = 'Villagers';
    options.parent.add(this.group);
  }

  sync(options: {
    residences: Iterable<ResidenceState>;
    roadNetwork: RoadNetwork | null;
  }): void {
    this.residences = new Map([...options.residences].map((residence) => [residence.id, residence]));
    this.roadNetwork = options.roadNetwork;

    const slots = computeVillagerSlots([...this.residences.values()]);
    const nextIds = new Set<string>();

    for (const [residenceId, count] of slots) {
      const residence = this.residences.get(residenceId);
      if (!residence) continue;

      const nearestEdge = this.roadNetwork
        ? findNearestRoadEdgePath(this.roadNetwork, residence.x, residence.z)
        : null;

      for (let slotIndex = 0; slotIndex < count; slotIndex++) {
        const id = `${residenceId}:${slotIndex}`;
        nextIds.add(id);

        let agent = this.agents.get(id);
        if (!agent) {
          const appearanceSeed = pickVillagerAppearanceSeed(residenceId, slotIndex);
          agent = {
            id,
            residenceId,
            slotIndex,
            mesh: createVillagerMesh(appearanceSeed),
            mode: 'idle',
            path: [],
            pathDistance: 0,
            pathCursor: 0,
            idleRemaining: pickIdleDuration(appearanceSeed),
            walkSpeed: pickWalkSpeed(appearanceSeed),
            appearanceSeed,
            idleOffset: pickIdleOffset(residenceId, slotIndex),
            pathSeed: appearanceSeed ^ 0x85ebca6b,
            idleDirty: true,
            nearestEdge,
          };
          agent.mesh.castShadow = true;
          agent.mesh.receiveShadow = false;
          this.group.add(agent.mesh);
          this.agents.set(id, agent);
        } else {
          agent.nearestEdge = nearestEdge;
          agent.idleDirty = true;
        }
      }
    }

    for (const id of [...this.agents.keys()]) {
      if (nextIds.has(id)) continue;
      this.removeAgent(id);
    }

    for (const agent of this.agents.values()) {
      const residence = this.residences.get(agent.residenceId);
      if (!residence || agent.mode !== 'idle') continue;
      if (!agent.idleDirty) continue;
      this.placeIdle(agent, residence);
      agent.idleDirty = false;
    }
  }

  tick(dt: number): void {
    for (const agent of this.agents.values()) {
      const residence = this.residences.get(agent.residenceId);
      if (!residence || residence.abandoned || residence.population <= 0) continue;

      if (agent.mode === 'idle') {
        agent.idleRemaining -= dt;
        if (agent.idleRemaining <= 0) {
          this.tryBeginWalk(agent, residence);
        }
        continue;
      }

      agent.pathCursor += agent.walkSpeed * dt;
      if (agent.pathCursor >= agent.pathDistance) {
        this.resetToIdle(agent, residence);
        continue;
      }

      const sample = samplePolylineXZ(agent.path, agent.pathCursor);
      if (!sample) {
        this.resetToIdle(agent, residence);
        continue;
      }

      const y = this.resolveGroundY(sample.x, sample.z) + 0.02;
      agent.mesh.position.set(sample.x, y, sample.z);
      agent.mesh.rotation.y = sample.yaw;
    }
  }

  dispose(): void {
    for (const id of [...this.agents.keys()]) {
      this.removeAgent(id);
    }
    this.group.removeFromParent();
  }

  private tryBeginWalk(agent: VillagerAgent, residence: ResidenceState): void {
    if (!this.roadNetwork || this.roadNetwork.edges.size === 0) {
      agent.idleRemaining = pickIdleDuration(agent.pathSeed);
      return;
    }

    const path = pickVillagerWalkPath(
      residence,
      [...this.residences.values()],
      this.roadNetwork,
      agent.pathSeed,
      agent.nearestEdge,
    );
    agent.pathSeed = (agent.pathSeed * 1_664_525) ^ 0x7feb352d;

    const pathDistance = path ? polylineLengthXZ(path) : 0;
    if (!path || pathDistance < 4) {
      agent.idleRemaining = pickIdleDuration(agent.pathSeed);
      return;
    }

    agent.mode = 'walk';
    agent.path = path;
    agent.pathDistance = pathDistance;
    agent.pathCursor = 0;
    agent.idleDirty = false;
  }

  private resetToIdle(agent: VillagerAgent, residence: ResidenceState): void {
    agent.mode = 'idle';
    agent.path = [];
    agent.pathDistance = 0;
    agent.pathCursor = 0;
    agent.idleRemaining = pickIdleDuration(agent.pathSeed);
    agent.idleDirty = true;
    this.placeIdle(agent, residence);
    agent.idleDirty = false;
  }

  private placeIdle(agent: VillagerAgent, residence: ResidenceState): void {
    const door = residenceDoorPosition(residence);
    const sin = Math.sin(residence.yaw);
    const cos = Math.cos(residence.yaw);
    const offsetX = agent.idleOffset.x * cos - agent.idleOffset.z * sin;
    const offsetZ = agent.idleOffset.x * sin + agent.idleOffset.z * cos;
    const x = door.x + offsetX;
    const z = door.z + offsetZ;
    const y = this.resolveGroundY(x, z) + 0.02;
    agent.mesh.position.set(x, y, z);
    agent.mesh.rotation.y = residence.yaw + agent.idleOffset.yaw;
  }

  private resolveGroundY(x: number, z: number): number {
    const deckY = this.getRoadDeckY?.(x, z);
    if (deckY != null) return deckY;
    return this.getHeightAt(x, z);
  }

  private removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    disposeObject3D(agent.mesh);
    agent.mesh.removeFromParent();
    this.agents.delete(id);
  }
}
