import {defineConfig} from 'vite';
// 2026-11-06: the one-file mobile page (club and hotel in one file; mobile.ts picks one). Both games go in one bundle.
export default defineConfig({base:'./',build:{outDir:'dist-mobile',emptyOutDir:true,rollupOptions:{input:'mobile.html',output:{inlineDynamicImports:true}}}});
