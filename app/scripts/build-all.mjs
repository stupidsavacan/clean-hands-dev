// Build every page people open, one after another (2026-11-07):
//   npm run build:all              all of them
//   npm run build:all -- club ui-lab   only those
// Each target is a vite build followed by its standalone script (one self-contained html next to ROADMAP.md).
// A new page: add a row here; tests/project.test.ts checks every row's files exist.
import {spawnSync} from 'node:child_process';
export const TARGETS=[
 {name:'hotel',config:'vite.config.ts',standalone:'scripts/standalone.mjs',out:'index.html'},
 {name:'party',config:'vite.party.config.ts',standalone:'scripts/standalone-party.mjs',out:'party-prototype.html'},
 {name:'club',config:'vite.club.config.ts',standalone:'scripts/standalone-club.mjs',out:'club-prototype.html'},
 {name:'mobile',config:'vite.mobile.config.ts',standalone:'scripts/standalone-mobile.mjs',out:'clean-hands-mobile.html'},
 ...['ai-lab','animation-lab','item-lab','outfit-lab','ui-lab','map-lab','test-stage','observatory','observatory-trailer'].map(lab=>({name:lab,config:'vite.labs.config.ts',env:{LAB:lab},standalone:'scripts/standalone-labs.mjs',args:[lab],out:lab+'.html'})),
];
const run=(cmd,args,env)=>{const r=spawnSync(cmd,args,{stdio:['ignore','pipe','pipe'],shell:process.platform==='win32',env:{...process.env,...env},encoding:'utf8'});return {ok:r.status===0,out:(r.stdout??'')+(r.stderr??'')};};
if(process.argv[1]?.replace(/\\/g,'/').endsWith('scripts/build-all.mjs')){
 const pick=process.argv.slice(2),list=pick.length?TARGETS.filter(t=>pick.includes(t.name)):TARGETS;
 if(pick.length&&list.length!==pick.length){console.error('unknown target; known:',TARGETS.map(t=>t.name).join(' '));process.exit(1);}
 const check=run('npx',['tsc','--noEmit']);if(!check.ok){console.error(check.out);process.exit(1);}
 let failed=0;
 for(const t of list){const t0=Date.now(),b=run('npx',['vite','build','--config',t.config],t.env??{});
  if(!b.ok){failed++;console.error(`✖ ${t.name}: vite build failed\n${b.out.slice(-2000)}`);continue;}
  const s=run('node',[t.standalone,...(t.args??[])]);if(!s.ok){failed++;console.error(`✖ ${t.name}: ${t.standalone} failed\n${s.out.slice(-2000)}`);continue;}
  console.log(`✓ ${t.name} → ${t.out} (${((Date.now()-t0)/1000).toFixed(1)}s)`);}
 process.exit(failed?1:0);}
