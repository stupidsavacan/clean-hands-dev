// Compare the club builds in foreground Chrome with the same recorder and camera positions.
// Run: node investigation/club-crowd-fix2-performance.mjs <stage2.html> <before.html> <first-fix.html> [<second-fix.html>]
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js'));
const {chromium}=require('playwright');
const versions=process.argv.slice(2).filter(a=>!a.startsWith('--'));
if(!versions.length)throw new Error('Specify one or more standalone club HTML files.');
const photo=process.argv.includes('--photo');
const weaponQa=process.argv.includes('--weapon-qa');
const profile=process.argv.includes('--profile');
const modes=process.argv.includes('--diagnose')?['normal','without-perceive-wrapper','without-occlusion','without-crowd']:['normal'];
const files=versions.map(path=>readFileSync(path,'utf8'));
const scripts=Object.fromEntries(['playtest.js','debug.js'].map(name=>['/'+name,readFileSync(join(root,'playtest',name),'utf8')]));
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(path.startsWith('/club/')){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const mode=url.searchParams.get('mode');
  res.end(files[Number(path.slice(6))].replace('</body>',
   `<script src="/playtest.js"></script><script src="/debug.js?mode=${mode}"></script></body>`));return;
 }
 if(scripts[path]){
  res.setHeader('Content-Type','text/javascript');
  const source=path==='/debug.js'&&url.searchParams.get('mode')==='without-perceive-wrapper'
   ?scripts[path].replace(/^   P\.perceive = function[\s\S]*?^   };$/m,'')
   :scripts[path];
  res.end(source);return;
 }
 // The recorder runs, but its requests never reach the server that stores human runs.
 res.setHeader('Content-Type','application/json');
 res.end(path==='/api/chances'?'{}':JSON.stringify({ok:true,acts:[],actors:{}}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--window-size=1540,920']});
 for(const [index,version] of versions.entries())for(const mode of modes){
  const page=await browser.newPage({viewport:null});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.bringToFront();
  // Ignore synthetic mouse deltas from pointer lock during the automated start.
  await page.addInitScript(()=>document.addEventListener('mousemove',event=>event.stopImmediatePropagation(),true));
  const nativeDpr=await page.evaluate(()=>devicePixelRatio);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:765,mobile:false,deviceScaleFactor:0});
  await page.goto(`http://127.0.0.1:${server.address().port}/club/${index}?test=crowd-qa&mode=${mode}${mode==='without-crowd'?'&crowd=0':''}`);
  await page.waitForFunction(()=>window.__cleanHands?.state().modelReady);
  await page.locator('#pt-pick [data-id="full"]').click();
  if(weaponQa)await page.locator('#prep-modal input[value="pistol_silenced"]').check();
  await page.locator('#prep-go').click();
  await page.evaluate(mode=>{
   window.__cleanHands.view(0,.3);
   if(mode==='without-occlusion')for(const n of window.__cleanHands.director().npcs)n.crowdOcclusion=undefined;
  },mode);
  if(weaponQa){
   await page.keyboard.down('w');
   await page.waitForFunction(()=>window.__cleanHands.state().position.z>=5.85);
   await page.keyboard.up('w');
   await page.keyboard.down('q');
   await page.waitForTimeout(800);
   await page.keyboard.up('q');
   await page.waitForFunction(()=>window.__cleanHands.combat().dropped.some(d=>d.id==='pistol_silenced'));
   await page.waitForFunction(()=>!window.__cleanHands.combat().dropped.some(d=>d.id==='pistol_silenced'));
   await page.keyboard.down('b');
   await page.waitForFunction(()=>window.__cleanHands.field().m4.passes.has('front_frisk'));
   await page.keyboard.up('b');
   await page.keyboard.down('w');
   await page.waitForFunction(()=>window.__cleanHands.state().position.z>=6.55);
   await page.keyboard.up('w');
   await page.keyboard.press('e');
   const result=await page.evaluate(()=>({position:window.__cleanHands.state().position,guns:window.__cleanHands.combat().guns}));
   if(result.guns.length||errors.length)throw new Error(JSON.stringify({result,errors}));
   console.log(JSON.stringify({version,weaponQa:true,...result,errors}));
   await page.close();
   continue;
  }
  for(const spot of photo?['panic']:modes.length>1?['entry']:['entry','floor']){
   if(spot!=='entry')await page.evaluate(()=>{
    const game=window.__cleanHands;
    game.teleport(22,17);
    game.inspectionCamera({x:22,y:1.65,z:17},{x:26,y:1.5,z:28});
   });
   if(photo){
    await page.evaluate(()=>window.__cleanHands.combatSystem().onGunshot({x:24,y:1.4,z:22},'loud'));
    await page.waitForTimeout(1900);
    await page.screenshot({path:join(root,'investigation','club-crowd-fix2-panic.png')});
    console.log(JSON.stringify({version,spot,crowd:await page.evaluate(()=>window.__cleanHands.crowd()),errors}));
    break;
   }
   if(profile){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
   const result=await page.evaluate(async duration=>{
    const game=window.__cleanHands,frames=[],gameFps=[],js=[],draws=[],triangles=[];
    await new Promise(resolve=>{
     let last=0,start=0,lastSecond=-1;
     function frame(t){
      if(!start)start=t;
      if(t-start>=2000){
       const info=game.performance(),second=Math.floor((t-start-2000)/1000);
       frames.push(t-last);js.push(info.jsFrameMs);draws.push(info.drawCalls);triangles.push(info.triangles);
       if(second!==lastSecond){lastSecond=second;gameFps.push(info.fps);}
      }
      last=t;
      if(t-start<duration)requestAnimationFrame(frame);else resolve();
     }
     requestAnimationFrame(frame);
    });
    const percentile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.floor((values.length-1)*p)];
    const gl=document.querySelector('#view').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
     renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),visible:document.visibilityState,userAgent:navigator.userAgent,
     paused:game.state().paused,crowd:game.crowd?.(),samples:frames.length,fps50:1000/percentile(frames,.50),fps05:1000/percentile(frames,.95),
     gameFps50:percentile(gameFps,.50),gameFps05:percentile(gameFps,.05),
     js50:percentile(js,.50),draws50:percentile(draws,.50),triangles50:percentile(triangles,.50)};
   },modes.length>1?10000:18000);
   if(profile){
    const {profile:cpu}=await cdp.send('Profiler.stop');
    const self=new Map();
    for(const {hitCount=0,callFrame:{functionName,url,lineNumber}} of cpu.nodes){
     const key=`${functionName} ${url.startsWith('http')?new URL(url).pathname:url}:${lineNumber+1}`;
     self.set(key,(self.get(key)??0)+hitCount);
    }
    result.profile=[...self].sort((a,b)=>b[1]-a[1]).slice(0,25);
   }
   if(result.paused||result.visible!=='visible'||result.dpr!==nativeDpr||result.viewport.join()!=='1440,765')throw new Error(JSON.stringify(result));
   console.log(JSON.stringify({version,mode,spot,...result,errors}));
  }
  await page.close();
 }
}finally{
 await browser?.close();
 server.close();
}
