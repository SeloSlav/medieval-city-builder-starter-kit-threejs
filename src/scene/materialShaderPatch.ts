import * as THREE from 'three';

export type MaterialShaderPatch = (shader: THREE.WebGLProgramParametersWithUniforms) => void;

/** Chain a shader patch onto a material without clobbering prior onBeforeCompile hooks. */
export function chainMaterialShaderPatch(
  material: THREE.Material,
  cacheKeySuffix: string,
  patch: MaterialShaderPatch,
): void {
  const priorOnBeforeCompile = material.onBeforeCompile;
  const priorCacheKey = material.customProgramCacheKey;

  material.customProgramCacheKey = () => {
    const prior = priorCacheKey?.call(material) ?? '';
    return `${prior}${cacheKeySuffix}`;
  };

  material.onBeforeCompile = (shader, renderer) => {
    priorOnBeforeCompile?.call(material, shader, renderer);
    patch(shader);
  };
}
