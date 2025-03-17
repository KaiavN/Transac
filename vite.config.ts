import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import themePlugin from '@replit/vite-plugin-shadcn-theme-json';

// ESM-compatible path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export configuration as a function that receives environment configuration
export default defineConfig((configEnv) => {
  const { command, mode } = configEnv;
  const custom: Record<string, any> = {}; // Initialize custom config if needed
  return {
    // Application root - points to your React app entry
    root: path.resolve(__dirname, 'client'),

    // Plugins clearly ordered
    plugins: [
      react(),
      runtimeErrorOverlay(),
      themePlugin(),
    ],

    // Aliases precisely defined to simplify module resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },

    // Build options defined clearly
    build: {
      outDir: path.resolve(__dirname, 'dist/public'),
      emptyOutDir: true, // cleans output directory on each build
      sourcemap: mode === 'development', // enable source maps during development
      rollupOptions: {
        output: {
          // Further output configuration can go here if needed
        },
      },
    },

    // Clear development server setup
    server: {
      port: 5173,  // explicitly defined frontend port
      open: true,  // automatically open the browser upon server start
      strictPort: true, // fail if port is already in use
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // targets your Express API backend
          changeOrigin: true,              // handles CORS/origin correctly
          secure: false,                   // disables SSL verification for proxied requests
        },
      },
    },

    // Spread in any additional custom configuration passed as the third argument
    ...custom,
  };
});