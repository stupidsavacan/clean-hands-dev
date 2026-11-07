import {createRequire} from 'node:module';import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js'),{chromium}=require('playwright');
const path=n=>fileURLToPath(new URL(n,import.meta.url)),map=JSON.parse(readFileSync(path('../app/src/data/party.json'),'utf8'));
const browser=await chromium.launch({executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',headless:true,args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const errors=[],results=[];
try{const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});await page.goto('http://127.0.0.1:8797/party-prototype.html');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady);await page.locator('#prep-go').click();await page.evaluate(()=>window.__cleanHands.inspectionPause());

const views=JSON.parse(readFileSync(path('party-v2-stage1-browser.json'),'utf8')).views.filter(v=>['V01','V02b','V08','V10','V11','V12','V13','V14'].includes(v[0]));
const photos=[];let previous=0;
await page.addStyleTag({content:'.modal,#overlay,#hud,#debug{visibility:hidden!important}'});
for(const t of [90,120,190,300,330,430,720,780,930,1020,1080,1200]){
 await page.evaluate(frames=>window.__cleanHands.inspectionStep([],frames),Math.round((t-previous)*60));previous=t;
 for(const [id,eye,target] of views){
  await page.evaluate(({eye,target})=>window.__cleanHands.inspectionCamera({x:eye[0],y:eye[1],z:eye[2]},{x:target[0],y:target[1],z:target[2]}),{eye,target});
  await page.waitForTimeout(20);const file='party-v2-stage2-'+id+'-'+t+'.png';await page.screenshot({path:path(file)});photos.push({id,time:t,file});
 }
}
writeFileSync(path('party-v2-stage2-browser.json'),JSON.stringify({errors,photos},null,2));console.log(JSON.stringify({errors,photos:photos.length}));
}finally{await browser.close();}
