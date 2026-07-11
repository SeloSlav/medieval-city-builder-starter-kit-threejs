import * as THREE from 'three';
import type { RiverField } from '../rivers/RiverField.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import { sampleHydrologyMapScore } from './sampleHydrology.ts';

const OVERLAY_RESOLUTION = 512;

export type HydrologyOverlayOptions = {
  terrain: Terrain;
  riverField: RiverField;
  parent: THREE.Object3D;
};

export class HydrologyOverlay {
  private readonly terrain: Terrain;
  private readonly mesh: THREE.Mesh;
  private visible = false;

  constructor(options: HydrologyOverlayOptions) {
    this.terrain = options.terrain;
    const { riverField } = options;
    const texture = createHydrologyTexture(riverField);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });

    // Match riverField world extent (full 1080m), not terrain.playable bounds (820m).
    const geometry = new THREE.PlaneGeometry(riverField.spanX, riverField.spanZ, 1, 1);
    geometry.rotateX(-Math.PI * 0.5);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Hydrology overlay';
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.mesh.position.set(
      riverField.startX + riverField.spanX * 0.5,
      0.35,
      riverField.startZ + riverField.spanZ * 0.5,
    );
    options.parent.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.mesh.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.map?.dispose();
      material.dispose();
    }
    this.mesh.removeFromParent();
  }

  getTerrainHeightAt(x: number, z: number): number {
    return this.terrain.getHeightAt(x, z) + 0.35;
  }
}

function createHydrologyTexture(riverField: RiverField): THREE.DataTexture {
  const resolution = OVERLAY_RESOLUTION;
  const data = new Uint8Array(resolution * resolution * 4);
  const { startX, startZ, spanX, spanZ } = riverField;

  for (let iz = 0; iz < resolution; iz++) {
    const z = startZ + (iz / (resolution - 1)) * spanZ;
    for (let ix = 0; ix < resolution; ix++) {
      const x = startX + (ix / (resolution - 1)) * spanX;
      const score = sampleHydrologyMapScore(riverField, x, z);
      const color = hydrologyColor(score);
      // PlaneGeometry UV v=0 maps to +Z after the X rotation — flip rows so minZ aligns with rivers.
      const dataRow = resolution - 1 - iz;
      const index = (dataRow * resolution + ix) * 4;
      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = Math.round(180 + score * 55);
    }
  }

  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function hydrologyColor(score: number): { r: number; g: number; b: number } {
  const dry = { r: 24, g: 34, b: 58 };
  const fair = { r: 38, g: 92, b: 148 };
  const rich = { r: 28, g: 132, b: 198 };
  const prime = { r: 72, g: 178, b: 228 };

  if (score < 0.33) return lerpColor(dry, fair, score / 0.33);
  if (score < 0.66) return lerpColor(fair, rich, (score - 0.33) / 0.33);
  return lerpColor(rich, prime, (score - 0.66) / 0.34);
}

function lerpColor(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(from.r + (to.r - from.r) * clamped),
    g: Math.round(from.g + (to.g - from.g) * clamped),
    b: Math.round(from.b + (to.b - from.b) * clamped),
  };
}
