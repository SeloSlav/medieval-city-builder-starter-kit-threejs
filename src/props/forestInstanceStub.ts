import * as THREE from 'three';
import type { MixedForestInstances } from './ForestManager.ts';
import type { ForestTreePlacement } from './forestPlacements.ts';

/** Minimal instanced meshes so ForestManager phase/clearance APIs keep working. */
export function createStubForestInstances(placements: ForestTreePlacement[]): MixedForestInstances {
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const stubGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const stubMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const count = Math.max(placements.length, 1);

  const makeStub = (name: string) => {
    const mesh = new THREE.InstancedMesh(stubGeometry, stubMaterial, count);
    mesh.name = name;
    mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, hidden);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };

  const trunkMesh = makeStub('SeedThree forest stub trunks');
  const coniferFoliageMesh = makeStub('SeedThree forest stub conifer foliage');
  const broadleafFoliageMesh = makeStub('SeedThree forest stub broadleaf foliage');
  const coniferShadowMesh = makeStub('SeedThree forest stub conifer shadows');
  const broadleafShadowMesh = makeStub('SeedThree forest stub broadleaf shadows');

  const group = new THREE.Group();
  group.name = 'Legacy forest instance stubs';

  return {
    group,
    trunkMesh,
    coniferFoliageMesh,
    broadleafFoliageMesh,
    coniferShadowMesh,
    broadleafShadowMesh,
    placements,
    coniferLayerCounts: placements.map(() => 0),
    broadleafLayerCounts: placements.map(() => 0),
    coniferStartIndex: placements.map(() => 0),
    broadleafStartIndex: placements.map(() => 0),
    trunkMatrices: placements.map(() => hidden.clone()),
    coniferFoliageMatrices: [],
    broadleafFoliageMatrices: [],
  };
}
