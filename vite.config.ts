import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    if (id.includes('/vendor/seedthree/')) return 'seedthree-vendor';
    if (id.includes('/vendor/sky-cloud-3d/')) return 'sky-vendor';
    if (id.includes('/src/generated/')) return 'spacetime-generated';
    return undefined;
  }
  if (id.includes('/three/') || id.includes('\\three\\')) return 'three';
  if (id.includes('spacetimedb')) return 'spacetime';
  return undefined;
}

export default defineConfig({
  resolve: {
    alias: {
      'sky-cloud-3d/webgl': fileURLToPath(new URL('./vendor/sky-cloud-3d/SkyCloudMesh.webgl', import.meta.url)),
      'sky-cloud-3d': fileURLToPath(new URL('./vendor/sky-cloud-3d/SkyCloudMesh.js', import.meta.url)),
      '@seedthree': fileURLToPath(new URL('./vendor/seedthree/src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunk(id);
        },
      },
    },
  },
});
