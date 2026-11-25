import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Generates a build-stamped dist/sw.js precaching all Vite assets
 * so POS & Sale Invoices load offline without external npm dependencies.
 */
function offlineShellSwPlugin(): Plugin {
  const assetUrls = new Set<string>(['/', '/index.html', '/favicon.svg']);
  let outDir = path.resolve(__dirname, 'dist');

  return {
    name: 'sabir-erp-offline-sw',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (!fileName.endsWith('.map')) {
          assetUrls.add(`/${fileName}`);
        }
      }
    },
    closeBundle() {
      const publicSwPath = path.resolve(__dirname, 'public/sw.js');
      const distSwPath = path.resolve(outDir, 'sw.js');
      if (!fs.existsSync(publicSwPath) || !fs.existsSync(outDir)) return;

      const template = fs.readFileSync(publicSwPath, 'utf8');
      const stamped = template
        .replace("const CACHE_NAME = 'sabir-erp-shell-v1';", `const CACHE_NAME = 'sabir-erp-shell-${Date.now()}';`)
        .replace("const PRECACHE_URLS = ['/', '/index.html', '/favicon.svg'];", `const PRECACHE_URLS = ${JSON.stringify(Array.from(assetUrls))};`);

      fs.writeFileSync(distSwPath, stamped, 'utf8');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineShellSwPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
