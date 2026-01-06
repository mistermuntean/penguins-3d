import { defineConfig } from 'vite';

export default defineConfig({
  base: '/penguins-3d/', // Base URL for GitHub Pages (repo name)
  build: {
    outDir: 'dist'
  }
});
