import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'../combat-motions',emptyOutDir:true,rollupOptions:{input:'combat-lab.html'}}});
