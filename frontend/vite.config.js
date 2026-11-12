import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vendor groups split out of the entry chunk (all but react/router/motion load lazily). Each entry lists package-name prefixes
// matched against the module path below node_modules.
const VENDOR_CHUNKS = {
  'vendor-react': ['react', 'react-dom', 'scheduler', 'react-is', 'use-sync-external-store'],
  'vendor-router': ['react-router', 'react-router-dom'],
  'vendor-charts': ['recharts', 'd3-', 'victory-vendor', 'decimal.js-light', 'es-toolkit', 'immer', 'reselect', 'redux', 'react-redux', '@reduxjs'],
  // three core only: grouping @react-three separately makes Rollup hoist a side-effect
  // import of three into the entry chunk, so r3f/drei stay with the lazy hero chunk.
  'vendor-three': ['three'],
  'vendor-leaflet': ['leaflet', 'react-leaflet', '@react-leaflet'],
  'vendor-firebase': ['firebase', '@firebase', 'idb'],
  'vendor-motion': ['framer-motion', 'motion-dom', 'motion-utils'],
};

function vendorChunk(id) {
  const index = id.lastIndexOf('node_modules/');
  if (index === -1) return undefined;
  const pkgPath = id.slice(index + 'node_modules/'.length);
  for (const [chunk, prefixes] of Object.entries(VENDOR_CHUNKS)) {
    if (prefixes.some((p) => (p.endsWith('-') ? pkgPath.startsWith(p) : pkgPath === p || pkgPath.startsWith(`${p}/`)))) {
      return chunk;
    }
  }
  return undefined;
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
});
