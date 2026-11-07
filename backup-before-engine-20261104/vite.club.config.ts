import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'dist-club',emptyOutDir:true,rollupOptions:{input:'club.html'}}});
