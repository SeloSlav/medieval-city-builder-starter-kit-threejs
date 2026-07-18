import { SceneManager } from '../scene/SceneManager.ts';
import { DEFAULT_WORLD_GENERATION_SETTINGS } from '../world/worldGenerationSettings.ts';

const root = document.querySelector<HTMLElement>('#app');
const status = document.querySelector<HTMLElement>('#status');
if (!root || !status) throw new Error('Missing terrain debug root.');

const scene = await SceneManager.create(root, DEFAULT_WORLD_GENERATION_SETTINGS, (progress) => {
  status.textContent = `${progress.label}: ${progress.detail ?? ''}`;
});
scene.resize();
scene.cameraTarget.set(0, scene.terrain.getHeightAt(0, 0), 0);
scene.camera.position.set(0, 240, 240);
scene.camera.lookAt(scene.cameraTarget);

const render = () => {
  scene.render(1 / 60, 340);
  requestAnimationFrame(render);
};
requestAnimationFrame(render);

await scene.finishVegetation();
scene.render(0, 340);
status.textContent = `${scene.rendererBackend}: terrain + forest ready`;
