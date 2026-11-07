import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js');
const {chromium}=require('playwright');
const baseline=process.argv[2];
if(!baseline)throw Error('Specify the stage-two standalone HTML path.');
const before=process.argv[3];
const photosOnly=process.argv.includes('--photos-only');
const current=new URL('../club-prototype.html',import.meta.url);
const output=name=>fileURLToPath(new URL(name,import.meta.url));
const browser=await chromium.launch({
 executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
 headless:true,args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist'],
});
const results=[],errors=[];
const photo=[
 ['entrance',[20,1.65,12],[22,2.3,27]],
 ['floor',[22,1.65,17],[26,1.5,28]],
 ['bar',[36,1.65,17.3],[40,1.5,23]],
 ['vip',[11.8,5.15,26],[25,1.1,24]],
];
function point([x,y,z]){return {x,y,z};}
try{
 const variants=before?[['stage2',0,baseline],['before',60,before],['after',60,null]]:[['stage2',0,baseline],['crowd',60,null],['stress',120,null]];
 for(const [version,count,local] of variants){
  if(photosOnly&&count!==60)continue;
  const page=await browser.newPage({viewport:{width:1080,height:810},deviceScaleFactor:2,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.bringToFront();
  await page.goto(local?pathToFileURL(local).href:current.href+'?crowd='+count);
  await page.waitForFunction(()=>window.__cleanHands?.state().modelReady);
  await page.locator('#prep-go').click();
  const roster=await page.evaluate(()=>({npcs:window.__cleanHands.director().npcs.length,crowd:window.__cleanHands.crowd?.().count??0}));
  if(roster.crowd!==count||roster.npcs!==34)throw Error(JSON.stringify(roster));
  for(const location of photosOnly?[]:['start','floor']){
   if(location==='floor')await page.evaluate(()=>{const a=window.__cleanHands;a.teleport(22,17);a.inspectionCamera({x:22,y:1.65,z:17},{x:26,y:1.5,z:28});});
   const measured=await page.evaluate(async()=>{
    const a=window.__cleanHands,frames=[],costs=[],calls=[],tris=[];
    await new Promise(resolve=>{let i=0,last=0;function sample(t){
     if(i>=120){const p=a.performance();frames.push(t-last);costs.push(p.jsFrameMs);calls.push(p.drawCalls);tris.push(p.triangles);}
     last=t;if(++i<480)requestAnimationFrame(sample);else resolve();
    }requestAnimationFrame(sample);});
    const stat=values=>{const sorted=values.toSorted((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,p50:sorted[180],p95:sorted[342]};};
    const gl=document.querySelector('#view').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {frames:stat(frames),js:stat(costs),calls:stat(calls),triangles:stat(tris),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'',buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight]};
   });
   const row={version,count,location,...measured};results.push(row);console.log(JSON.stringify(row));
  }
  if(count===60)for(const [name,eye,target] of photo){
   await page.evaluate(([e,t])=>{const a=window.__cleanHands;a.teleport(e.x,e.z,e.y-1.65);a.inspectionCamera(e,t);},[point(eye),point(target)]);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.screenshot({path:output((before?'club-crowd-fix-'+version:'club-crowd')+'-'+name+'.png'),scale:'css'});
  }
  await page.close();
 }
}finally{
 await browser.close();
 if(!photosOnly)writeFileSync(output(before?'club-crowd-fix-performance.json':'club-crowd-performance.json'),JSON.stringify({results,errors,photo,method:'1080x810 DPR2 touch, 120 warmup and 360 samples, Windows Chromium ANGLE D3D11'},null,2));
}
if(errors.length)throw Error(JSON.stringify(errors));
