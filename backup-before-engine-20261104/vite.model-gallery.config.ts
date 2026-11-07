import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'../model-gallery',emptyOutDir:true,rollupOptions:{input:'model-gallery.html'}}});
