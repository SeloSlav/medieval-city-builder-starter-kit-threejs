import * as THREE from 'three';
import type { RiverField } from '../rivers/RiverField.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import { sampleHydrologyScore } from './sampleHydrology.ts';

const OVERLAY_RESOLUTION = 256;

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
    const texture = createHydrologyTexture(options.riverField);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(
      options.terrain.bounds.maxX - options.terrain.bounds.minX,
      options.terrain.bounds.maxZ - options.terrain.bounds.minZ,
      1,
      1,
    );
    geometry.rotateX(-Math.PI * 0.5);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Hydrology overlay';
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.mesh.position.set(0, 0.35, 0);
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
  const bounds = {
    minX: riverField.startX,
    maxX: riverField.startX + riverField.spanX,
    minZ: riverField.startZ,
    maxZ: riverField.startZ + riverField.spanZ,
  };

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const x = bounds.minX + (ix / (resolution - 1)) * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + (iz / (resolution - 1)) * (bounds.maxZ - bounds.minZ);
      const score = sampleHydrologyScore(riverField, x, z);
      const color = hydrologyColor(score);
      const index = (iz * resolution + ix) * 4;
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
