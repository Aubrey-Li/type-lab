import { defineConfig } from 'vite';

// GitHub Pages serves the site under /type-lab/ (the workflow sets PAGES_BASE);
// locally it is served from the root.
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
});
