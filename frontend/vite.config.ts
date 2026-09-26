import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  // Subcaminho de publicação. No GitHub Pages o site fica em /<repositório>/ —
  // o workflow define BASE_PATH; localmente é a raiz.
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5173,
    strictPort: false, // usa próxima porta disponível se 5173 estiver ocupada
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@ufly/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // O Vite 8 usa Rolldown, que aceita manualChunks APENAS como função —
        // o formato de objeto ({ nome: [pacotes] }) falha com
        // "manualChunks is not a function" e derruba o build de produção.
        manualChunks(id) {
          if (/node_modules[\\/]recharts[\\/]/.test(id)) return 'recharts';
          if (/node_modules[\\/]@azure[\\/]msal-/.test(id)) return 'msal';
          return undefined;
        },
      },
    },
  },
});
