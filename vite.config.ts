import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const seedThreeRoot = fileURLToPath(new URL('./vendor/seedthree', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'sky-cloud-3d/webgl': fileURLToPath(new URL('./vendor/sky-cloud-3d/SkyCloudMesh.webgl', import.meta.url)),
      'sky-cloud-3d': fileURLToPath(new URL('./vendor/sky-cloud-3d/SkyCloudMesh.js', import.meta.url)),
      '@seedthree': fileURLToPath(new URL('./vendor/seedthree/src', import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [seedThreeRoot],
    },
  },
});
