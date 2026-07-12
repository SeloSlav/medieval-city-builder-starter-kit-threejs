import * as THREE from 'three';
import { applyFoliageDoubleSideNormals } from '../scene/foliageDoubleSideNormals.ts';
import { chainMaterialShaderPatch } from '../scene/materialShaderPatch.ts';

const DIRECTIONAL_SHADOW_LINE =
  'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';

const DIRECTIONAL_SHADOW_WITH_FILTER = `
float treeShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
#ifdef USE_TREE_SHADOW_RECEIVE_FILTER
{
  float distToRoot = distance( vTreeWorldPos.xz, vTreeRoot );
  float ndotl = dot( directLight.direction, normal );
  float inFootprint = 1.0 - smoothstep( vCanopyRadius * 0.5, vCanopyRadius * 0.98, distToRoot );
  float upperBand = smoothstep( vTreeBaseY + vTreeHeight * 0.15, vTreeBaseY + vTreeHeight * 0.9, vTreeWorldPos.y );
  float sunLit = smoothstep( -0.1, 0.28, ndotl );
  treeShadow = mix( treeShadow, 1.0, inFootprint * upperBand * sunLit );
}
#endif
directLight.color *= treeShadow;`;

const VERTEX_DECL = `
attribute vec2 aTreeRoot;
attribute float aTreeBaseY;
attribute float aTreeHeight;
attribute float aCanopyRadius;
varying vec2 vTreeRoot;
varying float vTreeBaseY;
varying float vTreeHeight;
varying float vCanopyRadius;
varying vec3 vTreeWorldPos;
`;

const VERTEX_ASSIGN = `
vTreeRoot = aTreeRoot;
vTreeBaseY = aTreeBaseY;
vTreeHeight = aTreeHeight;
vCanopyRadius = aCanopyRadius;
vTreeWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
`;

const FRAGMENT_DECL = `
varying vec2 vTreeRoot;
varying float vTreeBaseY;
varying float vTreeHeight;
varying float vCanopyRadius;
varying vec3 vTreeWorldPos;
`;

const TREE_SHADOW_RECEIVE_FILTER_CACHE_KEY = 'tree-shadow-receive-filter-v2';

function patchTreeShadowReceiveFilterShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.defines ??= {};
  shader.defines.USE_TREE_SHADOW_RECEIVE_FILTER = '';

  shader.vertexShader = VERTEX_DECL + shader.vertexShader;
  shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader;

  if (!shader.vertexShader.includes(VERTEX_ASSIGN.trim())) {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_ASSIGN}`);
  }

  if (shader.fragmentShader.includes(DIRECTIONAL_SHADOW_LINE)) {
    shader.fragmentShader = shader.fragmentShader.replace(DIRECTIONAL_SHADOW_LINE, DIRECTIONAL_SHADOW_WITH_FILTER);
  }
}

export function applyTreeShadowReceiveFilter(material: THREE.MeshStandardMaterial): void {
  chainMaterialShaderPatch(material, TREE_SHADOW_RECEIVE_FILTER_CACHE_KEY, patchTreeShadowReceiveFilterShader);
}

/**
 * Applies forest canopy shader patches in the order required for onBeforeCompile chaining:
 * tree shadow filter first, then foliage double-side normals.
 */
export function applyForestFoliageMaterialPatches(
  material: THREE.MeshStandardMaterial,
  options: { enableTreeShadowFilter: boolean },
): void {
  if (options.enableTreeShadowFilter) applyTreeShadowReceiveFilter(material);
  applyFoliageDoubleSideNormals(material);
}

export function setTreeShadowInstanceAttributes(
  geometry: THREE.BufferGeometry,
  treeRoots: Float32Array,
  treeBaseYs: Float32Array,
  treeHeights: Float32Array,
  canopyRadii: Float32Array,
): void {
  geometry.setAttribute('aTreeRoot', new THREE.InstancedBufferAttribute(treeRoots, 2));
  geometry.setAttribute('aTreeBaseY', new THREE.InstancedBufferAttribute(treeBaseYs, 1));
  geometry.setAttribute('aTreeHeight', new THREE.InstancedBufferAttribute(treeHeights, 1));
  geometry.setAttribute('aCanopyRadius', new THREE.InstancedBufferAttribute(canopyRadii, 1));
}
