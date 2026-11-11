import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {keyApiPlugin} from './vite-plugin-key-api';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), keyApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/wingo': {
          target: 'https://draw.ar-lottery01.com',
          changeOrigin: true,
          rewrite: () => '/WinGo/WinGo_1M/GetHistoryIssuePage.json',
          secure: false,
        },
      },
    },
  };
});
