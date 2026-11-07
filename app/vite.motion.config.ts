import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'../motions',emptyOutDir:true,rollupOptions:{input:'motion-lab.html'}}});