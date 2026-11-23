import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? 'http://localhost:5174/' : '/plugins/federation-demo/',
  plugins: [
    react(),
    federation({
      name: 'federation-demo',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './App': './src/App.tsx',
      },
      shared: {
        react: { singleton: true },
        'react/': { singleton: true },
        'react-dom': { singleton: true },
        'react-dom/': { singleton: true },
        'react-router': { singleton: true },
        'react-router-dom': { singleton: true },
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    cors: true,
    origin: 'http://localhost:5174',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
