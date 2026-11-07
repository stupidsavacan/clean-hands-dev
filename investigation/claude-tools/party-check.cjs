const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const out=__dirname;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.goto('http://127.0.0.1:8796/party-prototype.html');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:90000});
await page.screenshot({path:`${out}/p-0-briefing.png`});
await page.getByRole('button',{name:'作戦開始'}).click();await page.waitForTimeout(2500);await page.mouse.click(640,400);await page.waitForTimeout(800);
const api=await page.evaluate(()=>Object.keys(window.__cleanHands).sort());
const hotelApi=['director','teleport','view','state','clock','events','eventBus','timeScale','jumpTime','disguise','performance','combat','detection','detectionSystem','combatSystem','mission','score','chances','killLog'];
const missing=hotelApi.filter(k=>!api.includes(k));
const st=await page.evaluate(()=>{const c=__cleanHands;return {pos:c.state().position,clock:c.clock().time,npcs:c.director().npcs.length,moving:c.director().npcs.filter(n=>n.speed>.2).length};});
await page.waitForTimeout(5000);
const st2=await page.evaluate(()=>{const c=__cleanHands,d=c.director();return {moving:d.npcs.filter(n=>n.speed>.2).length,states:d.npcs.reduce((m,n)=>(m[n.state]=(m[n.state]||0)+1,m),{})};});
await page.screenshot({path:`${out}/p-1-start.png`});
// overhead view of the ballroom
await page.evaluate(()=>{const c=__cleanHands;c.disguise('waiter');c.teleport(-4,5,0);c.view(Math.PI,.55);});await page.waitForTimeout(1500);
await page.screenshot({path:`${out}/p-2-ballroom.png`});
console.log(JSON.stringify({missing,st,st2,errors},null,1));await browser.close();})();
