import * as THREE from 'three';
import type { TerrainBounds } from '../terrain/Terrain.ts';

const SHADOW_CORNER = new THREE.Vector3();
const SHADOW_VIEW = new THREE.Vector3();
const SHADOW_TARGET = new THREE.Vector3();
const SHADOW_VIEW_FORWARD = new THREE.Vector3();
const SHADOW_SUN_OFFSET = new THREE.Vector3();

/** Max instanced pine height at largest scale and broad form. */
const MAX_TREE_HEIGHT = 48;
/** Broad-tree canopy can extend this far past its trunk on XZ. */
const MAX_CANOPY_RADIUS = 12;
const LIGHT_DISTANCE = 180;
const DEPTH_PAD = 30;
const MIN_VIEW_SHADOW_EXTENT = 72;

type FitDirectionalShadowOptions = {
  bounds: TerrainBounds;
  sunOffsetDir: THREE.Vector3;
  maxHeight?: number;
  horizontalMargin?: number;
  padding?: number;
};

export function computeViewShadowBounds(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  viewDistance: number,
  padding = 1.3,
): TerrainBounds {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const halfHeight = Math.tan(fovRad * 0.5) * viewDistance;
  const halfWidth = halfHeight * camera.aspect;
  const extentX = Math.max(MIN_VIEW_SHADOW_EXTENT, halfWidth * padding);
  const extentZ = Math.max(MIN_VIEW_SHADOW_EXTENT, halfHeight * padding);
  return {
    minX: target.x - extentX,
    maxX: target.x + extentX,
    minZ: target.z - extentZ,
    maxZ: target.z + extentZ,
  };
}

export function intersectTerrainBounds(a: TerrainBounds, b: TerrainBounds): TerrainBounds {
  return {
    minX: Math.max(a.minX, b.minX),
    maxX: Math.min(a.maxX, b.maxX),
    minZ: Math.max(a.minZ, b.minZ),
    maxZ: Math.min(a.maxZ, b.maxZ),
  };
}

type ViewBounds = {
  minCamX: number;
  maxCamX: number;
  minCamY: number;
  maxCamY: number;
  minCamZ: number;
  maxCamZ: number;
};

export function fitDirectionalLightShadow(
  light: THREE.DirectionalLight,
  options: FitDirectionalShadowOptions,
): void {
  const {
    bounds,
    sunOffsetDir,
    maxHeight = MAX_TREE_HEIGHT,
    horizontalMargin = MAX_CANOPY_RADIUS,
    padding = 0.08,
  } = options;
  const minX = bounds.minX - horizontalMargin;
  const maxX = bounds.maxX + horizontalMargin;
  const minZ = bounds.minZ - horizontalMargin;
  const maxZ = bounds.maxZ + horizontalMargin;
  const sampleCoords = buildShadowSampleCoords(minX, maxX, minZ, maxZ, maxHeight);
  const normalizedSunOffset = SHADOW_SUN_OFFSET.copy(sunOffsetDir).normalize();

  SHADOW_TARGET.set((bounds.minX + bounds.maxX) * 0.5, 0, (bounds.minZ + bounds.maxZ) * 0.5);
  light.target.position.copy(SHADOW_TARGET);
  syncLightPosition(light, SHADOW_TARGET, normalizedSunOffset);

  const shadowCam = light.shadow.camera;
  syncShadowCameraFromLight(light, shadowCam);

  let viewBounds = measureViewBounds(shadowCam, sampleCoords);
  if (viewBounds.maxCamZ > -1) {
    light.target.getWorldPosition(SHADOW_VIEW_FORWARD);
    SHADOW_VIEW_FORWARD.sub(shadowCam.position).normalize();
    SHADOW_TARGET.copy(light.target.position).addScaledVector(
      SHADOW_VIEW_FORWARD,
      -(viewBounds.maxCamZ + DEPTH_PAD),
    );
    light.target.position.copy(SHADOW_TARGET);
    syncLightPosition(light, SHADOW_TARGET, normalizedSunOffset);
    syncShadowCameraFromLight(light, shadowCam);
    viewBounds = measureViewBounds(shadowCam, sampleCoords);
  }

  const frustumWidth = viewBounds.maxCamX - viewBounds.minCamX;
  const frustumHeight = viewBounds.maxCamY - viewBounds.minCamY;
  const padX = frustumWidth * padding;
  const padY = frustumHeight * padding;

  shadowCam.left = viewBounds.minCamX - padX;
  shadowCam.right = viewBounds.maxCamX + padX;
  shadowCam.top = viewBounds.maxCamY + padY;
  shadowCam.bottom = viewBounds.minCamY - padY;
  shadowCam.near = Math.max(0.1, -viewBounds.maxCamZ - DEPTH_PAD);
  shadowCam.far = -viewBounds.minCamZ + DEPTH_PAD;
  snapDirectionalShadowFrustumToTexels(light, shadowCam);
  shadowCam.updateProjectionMatrix();
}

/** Prevent shadow swimming when the ortho frustum recenters on pan/zoom. */
function snapDirectionalShadowFrustumToTexels(
  light: THREE.DirectionalLight,
  shadowCam: THREE.OrthographicCamera,
): void {
  const mapSize = light.shadow.mapSize.width;
  const width = shadowCam.right - shadowCam.left;
  const height = shadowCam.top - shadowCam.bottom;
  if (!(mapSize > 0 && width > 0 && height > 0)) return;

  const texelW = width / mapSize;
  const texelH = height / mapSize;
  const centerX = (shadowCam.left + shadowCam.right) * 0.5;
  const centerY = (shadowCam.bottom + shadowCam.top) * 0.5;
  const snappedX = Math.round(centerX / texelW) * texelW;
  const snappedY = Math.round(centerY / texelH) * texelH;
  const halfW = width * 0.5;
  const halfH = height * 0.5;

  shadowCam.left = snappedX - halfW;
  shadowCam.right = snappedX + halfW;
  shadowCam.bottom = snappedY - halfH;
  shadowCam.top = snappedY + halfH;
}

function buildShadowSampleCoords(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  maxHeight: number,
): Array<[number, number, number]> {
  const sampleCoords: Array<[number, number, number]> = [
    [minX, 0, minZ],
    [minX, 0, maxZ],
    [minX, maxHeight, minZ],
    [minX, maxHeight, maxZ],
    [maxX, 0, minZ],
    [maxX, 0, maxZ],
    [maxX, maxHeight, minZ],
    [maxX, maxHeight, maxZ],
  ];

  const edgeSteps = 6;
  for (let i = 0; i <= edgeSteps; i++) {
    const t = i / edgeSteps;
    const x = THREE.MathUtils.lerp(minX, maxX, t);
    const z = THREE.MathUtils.lerp(minZ, maxZ, t);
    sampleCoords.push([x, 0, minZ], [x, maxHeight, minZ], [x, 0, maxZ], [x, maxHeight, maxZ]);
    sampleCoords.push([minX, 0, z], [minX, maxHeight, z], [maxX, 0, z], [maxX, maxHeight, z]);
  }

  return sampleCoords;
}

function syncLightPosition(
  light: THREE.DirectionalLight,
  target: THREE.Vector3,
  sunOffsetDir: THREE.Vector3,
): void {
  light.position.copy(target).addScaledVector(sunOffsetDir, LIGHT_DISTANCE);
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
}

/** Re-align the shadow ortho camera after the sun light pose changes. */
export function updateDirectionalShadowCameraMatrices(light: THREE.DirectionalLight): void {
  syncShadowCameraFromLight(light, light.shadow.camera);
  light.shadow.needsUpdate = true;
}

function syncShadowCameraFromLight(
  light: THREE.DirectionalLight,
  shadowCam: THREE.OrthographicCamera,
): void {
  shadowCam.position.setFromMatrixPosition(light.matrixWorld);
  light.target.getWorldPosition(SHADOW_TARGET);
  shadowCam.lookAt(SHADOW_TARGET);
  shadowCam.updateMatrixWorld();
}

function measureViewBounds(
  shadowCam: THREE.OrthographicCamera,
  sampleCoords: Array<[number, number, number]>,
): ViewBounds {
  let minCamX = Infinity;
  let maxCamX = -Infinity;
  let minCamY = Infinity;
  let maxCamY = -Infinity;
  let minCamZ = Infinity;
  let maxCamZ = -Infinity;

  for (const [x, y, z] of sampleCoords) {
    SHADOW_CORNER.set(x, y, z);
    SHADOW_VIEW.copy(SHADOW_CORNER).applyMatrix4(shadowCam.matrixWorldInverse);
    minCamX = Math.min(minCamX, SHADOW_VIEW.x);
    maxCamX = Math.max(maxCamX, SHADOW_VIEW.x);
    minCamY = Math.min(minCamY, SHADOW_VIEW.y);
    maxCamY = Math.max(maxCamY, SHADOW_VIEW.y);
    minCamZ = Math.min(minCamZ, SHADOW_VIEW.z);
    maxCamZ = Math.max(maxCamZ, SHADOW_VIEW.z);
  }

  return { minCamX, maxCamX, minCamY, maxCamY, minCamZ, maxCamZ };
}
