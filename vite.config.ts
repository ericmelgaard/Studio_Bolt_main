import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; BASE_PATH is set by the deploy workflow
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    {
      name: 'selective-public-copy',
      apply: 'build',
      writeBundle() {
        const publicDir = path.resolve(__dirname, 'public');
        const distDir = path.resolve(__dirname, 'dist');

        // Files to copy (exclude problematic files)
        const filesToCopy = [
          'manifest.json',
          'sw.js',
          'icon.png',
          'icon-192x192.png',
          'icon-512x512.png',
          'icon-512x512-maskable.png',
          'wandlogo.png',
          'wandlogo_192x192.png',
          'wandlogo_512x512.png',
          'dip_caramel.png',
          'dip_cheese.png',
          'dip_honeymustard.png',
          'dip_hotsalsacheese.png',
          'dip_marinara.png'
        ];

        filesToCopy.forEach(file => {
          const src = path.join(publicDir, file);
          const dest = path.join(distDir, file);
          try {
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
              console.log(`Copied ${file} to dist/`);
            }
          } catch (err) {
            console.warn(`Could not copy ${file}:`, err);
          }
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  publicDir: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'editor': ['react-quill'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: 'esbuild',
  },
});
