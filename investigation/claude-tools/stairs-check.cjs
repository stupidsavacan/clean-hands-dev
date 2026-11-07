// Pictures of the agent walking and running up and down the grand stairs (2026-11-02 leg fix), and page errors.
// Run with a static server on 8796 at outputs/m5-prototype: node investigation/claude-tools/stairs-check.cjs
const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const out=__dirname;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.goto('http://127.0.0.1:8796/index.html');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:120000});
await page.getByRole('button',{name:'作戦開始'}).click();await page.waitForTimeout(2500);await page.mouse.click(640,400);await page.waitForTimeout(500);
const shots=[];
for(const [name,from,yaw,run] of [['walk-up',{x:8,y:0,z:-3},Math.PI,false],['run-up',{x:8,y:0,z:-3},Math.PI,true],['walk-down',{x:8,y:3.5,z:-13},0,false]]){
 await page.evaluate(([f,y])=>{const c=__cleanHands;c.disguise('guard');c.teleport(f.x,f.z,f.y);c.view(y,.15);},[from,yaw]);await page.waitForTimeout(400);
 if(run)await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 for(let i=0;i<3;i++){await page.waitForTimeout(run?380:700);const p=await page.evaluate(()=>__cleanHands.state().position);const f=`${out}/stairs-${name}-${i}.png`;await page.screenshot({path:f});shots.push({f:f.split(/[\\/]/).pop(),y:+p.y.toFixed(2),z:+p.z.toFixed(2)});}
 await page.keyboard.up('KeyW');if(run)await page.keyboard.up('ShiftLeft');await page.waitForTimeout(300);}
console.log(JSON.stringify({shots,errors},null,1));await browser.close();})();
