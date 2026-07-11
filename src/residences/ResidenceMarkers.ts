import * as THREE from 'three';
import { addTriangularGableWall } from '../buildings/meshPrimitives.ts';
import { addLogPile } from '../buildings/logPile.ts';
import { createResidenceShadowProxy } from '../buildings/buildingShadowProxy.ts';
import {
  addMesh,
  residenceFacadeMaterial,
  residenceRoofMaterial,
  stoneMaterial,
  timberMaterial,
} from '../buildings/buildingMaterials.ts';
import { areBuildingShadowsEnabled } from '../scene/shadowPreference.ts';
import { ChimneySmokeEmitter } from './ResidenceChimneySmoke.ts';
import { pickResidenceAppearance } from './residenceAppearance.ts';
import { getNeedStock } from './residenceNeedState.ts';
import type { ResidenceState } from '../resources/types.ts';
import { MAIN_HOUSE_DEPTH, MAIN_HOUSE_WIDTH } from './burgageLayout.ts';
import { RESIDENCE_FIREWOOD_CAPACITY } from '../generated/gameBalance.ts';
import { hashStringSeed } from '../utils/random.ts';

const WINDOW_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x2a3540,
  roughness: 0.35,
  metalness: 0.05,
  emissive: 0x1a2530,
  emissiveIntensity: 0.15,
});

const WINDOW_GLOW_EMISSIVE = 0xffc060;
const WINDOW_GLOW_COLOR = 0x4a3820;
const WINDOW_DARK_EMISSIVE = 0x1a2530;
const WINDOW_DARK_COLOR = 0x2a3540;

function createWindowMaterial(): THREE.MeshStandardMaterial {
  return WINDOW_MATERIAL.clone();
}

export function applyResidenceWindowGlow(
  material: THREE.MeshStandardMaterial,
  eveningGlow: number,
  occupied: boolean,
): void {
  const amount = occupied ? eveningGlow : eveningGlow * 0.06;
  material.color.setHex(lerpColor(WINDOW_DARK_COLOR, WINDOW_GLOW_COLOR, amount));
  material.emissive.setHex(lerpColor(WINDOW_DARK_EMISSIVE, WINDOW_GLOW_EMISSIVE, amount));
  material.emissiveIntensity = 0.12 + amount * 1.15;
}

function lerpColor(a: number, b: number, t: number): number {
  const mix = Math.min(1, Math.max(0, t));
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * mix);
  const g = Math.round(ag + (bg - ag) * mix);
  const bl = Math.round(ab + (bb - ab) * mix);
  return (r << 16) | (g << 8) | bl;
}

const WINDOW_DEPTH = 0.1;
const WINDOW_FRAME_DEPTH = 0.05;
const WINDOW_FRAME_PAD = 0.14;

type WindowFace = 'front' | 'left' | 'right';

function addWindow(
  group: THREE.Group,
  windowMaterial: THREE.MeshStandardMaterial,
  face: WindowFace,
  along: number,
  y: number,
  width: number,
  height: number,
  halfW: number,
  halfD: number,
): void {
  if (face === 'front') {
    const z = halfD - 0.1;
    addMesh(
      group,
      new THREE.BoxGeometry(width, height, WINDOW_DEPTH),
      windowMaterial,
      new THREE.Vector3(along, y, z),
    );
    addMesh(
      group,
      new THREE.BoxGeometry(width + WINDOW_FRAME_PAD, height + WINDOW_FRAME_PAD, WINDOW_FRAME_DEPTH),
      timberMaterial('dark'),
      new THREE.Vector3(along, y, z - 0.03),
    );
    return;
  }

  const x = face === 'left' ? -(halfW - 0.1) : halfW - 0.1;
  const frameOffsetX = face === 'left' ? 0.03 : -0.03;
  addMesh(
    group,
    new THREE.BoxGeometry(WINDOW_DEPTH, height, width),
    windowMaterial,
    new THREE.Vector3(x, y, along),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(WINDOW_FRAME_DEPTH, height + WINDOW_FRAME_PAD, width + WINDOW_FRAME_PAD),
    timberMaterial('dark'),
    new THREE.Vector3(x + frameOffsetX, y, along),
  );
}

export function createResidenceMesh(seed = 0): THREE.Group {
  const { facade, roof } = pickResidenceAppearance(seed);
  const wallMaterial = residenceFacadeMaterial(facade);
  const roofSurfaceMaterial = residenceRoofMaterial(roof);

  const group = new THREE.Group();
  group.name = 'Residence';
  const windowMaterial = createWindowMaterial();
  group.userData.windowMaterial = windowMaterial;

  const width = MAIN_HOUSE_WIDTH;
  const depth = MAIN_HOUSE_DEPTH;
  const stoneHeight = 0.95;
  const storeyHeight = 2.55;
  const wallHeight = storeyHeight * 2;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const wallTop = stoneHeight + wallHeight;
  const ridgeHeight = 2.85;
  const roofPitch = Math.atan2(ridgeHeight, halfW);
  const slopeLen = halfW / Math.cos(roofPitch) + 0.22;
  const frontZ = halfD - 0.1;

  addMesh(
    group,
    new THREE.BoxGeometry(width + 0.34, stoneHeight, depth + 0.34),
    stoneMaterial('light'),
    new THREE.Vector3(0, stoneHeight * 0.5, 0),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(width + 0.08, 0.14, depth + 0.08),
    stoneMaterial('mortar'),
    new THREE.Vector3(0, stoneHeight + 0.07, 0),
  );

  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.36, wallHeight + 0.1, 0.36),
      stoneMaterial('mid'),
      new THREE.Vector3(sx * (halfW - 0.12), stoneHeight + (wallHeight + 0.1) * 0.5, sz * (halfD - 0.12)),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.28, wallHeight, depth - 0.28),
    wallMaterial,
    new THREE.Vector3(0, stoneHeight + wallHeight * 0.5, 0),
  );

  const floorY = stoneHeight + storeyHeight;
  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.34, 0.12, depth - 0.34),
    timberMaterial('dark'),
    new THREE.Vector3(0, floorY, 0),
  );

  addWindow(group, windowMaterial, 'front', -1.55, stoneHeight + storeyHeight * 0.55, 1.05, 1.35, halfW, halfD);
  addWindow(group, windowMaterial, 'front', 1.55, stoneHeight + storeyHeight * 0.55, 1.05, 1.35, halfW, halfD);
  addWindow(group, windowMaterial, 'front', -1.55, stoneHeight + storeyHeight + storeyHeight * 0.55, 1.0, 1.25, halfW, halfD);
  addWindow(group, windowMaterial, 'front', 1.55, stoneHeight + storeyHeight + storeyHeight * 0.55, 1.0, 1.25, halfW, halfD);
  addWindow(group, windowMaterial, 'left', 0, stoneHeight + storeyHeight * 0.55, 1.2, 1.2, halfW, halfD);
  addWindow(group, windowMaterial, 'left', 0, stoneHeight + storeyHeight + storeyHeight * 0.5, 1.15, 1.15, halfW, halfD);
  addWindow(group, windowMaterial, 'right', 0, stoneHeight + storeyHeight * 0.55, 1.2, 1.2, halfW, halfD);
  addWindow(group, windowMaterial, 'right', 0, stoneHeight + storeyHeight + storeyHeight * 0.5, 1.15, 1.15, halfW, halfD);

  const doorWidth = 1.2;
  const doorHeight = 2.1;
  addMesh(
    group,
    new THREE.BoxGeometry(doorWidth, doorHeight, 0.14),
    timberMaterial('dark'),
    new THREE.Vector3(0, stoneHeight + doorHeight * 0.5, frontZ),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(doorWidth + 0.18, doorHeight + 0.12, 0.08),
    timberMaterial('weathered'),
    new THREE.Vector3(0, stoneHeight + doorHeight * 0.5 + 0.06, frontZ - 0.04),
  );

  addMesh(
    group,
    new THREE.BoxGeometry(width - 0.5, 0.14, depth - 0.5),
    timberMaterial('light'),
    new THREE.Vector3(0, wallTop - 0.06, 0),
  );

  addMesh(
    group,
    new THREE.BoxGeometry(0.16, 0.16, depth - 0.2),
    timberMaterial('dark'),
    new THREE.Vector3(0, wallTop + ridgeHeight, 0),
  );

  for (const side of [-1, 1] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(slopeLen, 0.13, depth + 0.36),
      roofSurfaceMaterial,
      new THREE.Vector3(side * halfW * 0.46, wallTop + ridgeHeight * 0.48, 0),
      new THREE.Euler(0, 0, side * -roofPitch),
    );
  }

  const gableWallThickness = 0.18;
  for (const zSign of [-1, 1] as const) {
    addTriangularGableWall(
      group,
      'z',
      zSign * (halfD - 0.08),
      halfW,
      wallTop,
      ridgeHeight,
      gableWallThickness,
      wallMaterial,
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(0.82, 2.6, 0.82),
    stoneMaterial('mid'),
    new THREE.Vector3(halfW - 1.25, wallTop + 1.15, -halfD + 1.35),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.92, 0.2, 0.92),
    stoneMaterial('light'),
    new THREE.Vector3(halfW - 1.25, wallTop + 2.55, -halfD + 1.35),
  );

  const chimneyEmitter = new THREE.Object3D();
  chimneyEmitter.name = 'ChimneyEmitter';
  chimneyEmitter.position.set(halfW - 1.25, wallTop + 2.7, -halfD + 1.35);
  group.add(chimneyEmitter);

  const firewoodPile = new THREE.Group();
  firewoodPile.name = 'FirewoodPile';
  firewoodPile.visible = false;
  group.add(firewoodPile);
  addLogPile(firewoodPile, -halfW + 1.35, -halfD - 1.05, 0, 4, 2.1, 0.19);

  return group;
}

const PREVIEW_OPACITY = 0.72;

export function createResidencePreviewMesh(seed = 0): THREE.Group {
  const mesh = createResidenceMesh(seed);
  mesh.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const source = child.material;
    if (Array.isArray(source)) return;
    const material = source.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.transparent = true;
      material.opacity = PREVIEW_OPACITY;
      material.depthWrite = false;
    }
    child.material = material;
    child.renderOrder = 15;
  });
  mesh.frustumCulled = false;
  return mesh;
}

export class ResidenceMarkers {
  private readonly root: THREE.Group;
  private readonly meshes = new Map<string, THREE.Group>();
  private readonly smokeEmitters = new Map<string, ChimneySmokeEmitter>();
  private readonly smokeActive = new Map<string, boolean>();
  private readonly residenceOccupied = new Map<string, boolean>();
  private chimneySmokeAllowed = true;
  private eveningWindowGlow = 0;

  constructor(parent: THREE.Group) {
    this.root = new THREE.Group();
    this.root.name = 'Residences';
    parent.add(this.root);
  }

  setChimneySmokeAllowed(allowed: boolean): void {
    this.chimneySmokeAllowed = allowed;
    for (const [id, emitter] of this.smokeEmitters) {
      emitter.setActive(this.smokeActive.get(id) ?? false);
    }
  }

  setEveningWindowGlow(glow: number): void {
    this.eveningWindowGlow = glow;
    this.applyWindowGlow();
  }

  private applyWindowGlow(): void {
    for (const [id, marker] of this.meshes) {
      const material = marker.userData.windowMaterial as THREE.MeshStandardMaterial | undefined;
      if (!material) continue;
      applyResidenceWindowGlow(
        material,
        this.eveningWindowGlow,
        this.residenceOccupied.get(id) ?? false,
      );
    }
  }

  tick(dt: number): void {
    for (const [id, emitter] of this.smokeEmitters) {
      emitter.setActive(this.smokeActive.get(id) ?? false);
      emitter.tick(dt);
    }
  }

  syncResidences(
    residences: Iterable<ResidenceState>,
    getHeightAt: (x: number, z: number) => number,
  ): void {
    const nextIds = new Set<string>();
    for (const residence of residences) {
      nextIds.add(residence.id);
      let marker = this.meshes.get(residence.id);
      if (!marker) {
        const appearanceSeed = hashStringSeed(residence.id);
        marker = createResidenceMesh(appearanceSeed);
        const shadowProxy = createResidenceShadowProxy();
        shadowProxy.castShadow = areBuildingShadowsEnabled();
        marker.add(shadowProxy);
        this.root.add(marker);
        this.meshes.set(residence.id, marker);

        const chimneyEmitter = marker.getObjectByName('ChimneyEmitter');
        if (chimneyEmitter) {
          this.smokeEmitters.set(residence.id, new ChimneySmokeEmitter(chimneyEmitter, appearanceSeed));
        }
      }
      const y = getHeightAt(residence.x, residence.z);
      marker.position.set(residence.x, y, residence.z);
      marker.rotation.y = residence.yaw;
      this.smokeActive.set(
        residence.id,
        this.chimneySmokeAllowed
          && !residence.abandoned
          && residence.population > 0
          && getNeedStock(residence.needs, 'firewood') > 0,
      );
      this.residenceOccupied.set(
        residence.id,
        !residence.abandoned && residence.population > 0,
      );
      this.applyWindowGlowForResidence(marker, residence.id);
      syncFirewoodPile(marker, getNeedStock(residence.needs, 'firewood'));
      if (!marker.getObjectByName('Building shadow proxy')) {
        const shadowProxy = createResidenceShadowProxy();
        shadowProxy.castShadow = areBuildingShadowsEnabled();
        marker.add(shadowProxy);
      }
    }

    for (const [id, marker] of this.meshes) {
      if (nextIds.has(id)) continue;
      this.root.remove(marker);
      disposeGroup(marker);
      this.meshes.delete(id);
      this.smokeEmitters.get(id)?.dispose();
      this.smokeEmitters.delete(id);
      this.smokeActive.delete(id);
      this.residenceOccupied.delete(id);
    }
  }

  private applyWindowGlowForResidence(marker: THREE.Group, residenceId: string): void {
    const material = marker.userData.windowMaterial as THREE.MeshStandardMaterial | undefined;
    if (!material) return;
    applyResidenceWindowGlow(
      material,
      this.eveningWindowGlow,
      this.residenceOccupied.get(residenceId) ?? false,
    );
  }

  dispose(): void {
    for (const emitter of this.smokeEmitters.values()) {
      emitter.dispose();
    }
    this.smokeEmitters.clear();
    this.smokeActive.clear();
    this.residenceOccupied.clear();
    for (const marker of this.meshes.values()) {
      disposeGroup(marker);
    }
    this.meshes.clear();
    this.root.removeFromParent();
  }
}

function syncFirewoodPile(marker: THREE.Group, firewoodStock: number): void {
  const pile = marker.getObjectByName('FirewoodPile');
  if (!(pile instanceof THREE.Group)) return;

  if (firewoodStock <= 0.05) {
    pile.visible = false;
    return;
  }

  pile.visible = true;
  const fill = Math.min(1, firewoodStock / RESIDENCE_FIREWOOD_CAPACITY);
  const scale = 0.42 + fill * 0.58;
  pile.scale.setScalar(scale);
}

function disposeGroup(group: THREE.Group): void {
  const disposedMaterials = new Set<THREE.Material>();
  const windowMaterial = group.userData.windowMaterial as THREE.Material | undefined;
  if (windowMaterial) {
    windowMaterial.dispose();
    disposedMaterials.add(windowMaterial);
  }
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      const entries = Array.isArray(material) ? material : [material];
      for (const entry of entries) {
        if (disposedMaterials.has(entry)) continue;
        entry.dispose();
        disposedMaterials.add(entry);
      }
    }
  });
}
