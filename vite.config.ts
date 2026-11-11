import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {generateCatalogVariants} from './scripts/generate-catalog-variants.mjs';

/**
 * Generates the resized catalog images that grid tiles load (see
 * scripts/generate-catalog-variants.mjs) before any module is transformed, so the
 * glob in src/data/catalogImages.ts sees them. A build fails if this fails; the dev
 * server only warns, and tiles fall back to the original images.
 */
function catalogImageVariants(): Plugin {
  let run: Promise<void> | undefined;
  let isBuild = false;

  return {
    name: 'catalog-image-variants',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    buildStart() {
      run ??= generateCatalogVariants().then(
        ({generated, reused, removed}) => {
          if (generated || removed) {
            console.info(`[catalog-image-variants] ${generated} generated, ${reused} unchanged, ${removed} stale removed`);
          }
        },
        (error: unknown) => {
          if (isBuild) throw error;
          console.warn('[catalog-image-variants] Could not generate resized catalog images; tiles will load the originals.', error);
        },
      );
      return run;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [catalogImageVariants(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
