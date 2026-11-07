// The two lab stages (2026-11-04), built one at a time so each is a single bundle:
//   LAB=ai-lab npx vite build --config vite.labs.config.ts && node scripts/standalone-labs.mjs ai-lab
//   LAB=animation-lab ...                                    && node scripts/standalone-labs.mjs animation-lab
// The result is one self-contained html file next to club-prototype.html.
import {defineConfig} from 'vite';
const lab=process.env.LAB??'ai-lab';
export default defineConfig({base:'./',build:{outDir:'dist-'+lab,emptyOutDir:true,rollupOptions:{input:lab+'.html'}}});
