// Party v2 (2026-11-03): the gossip starts when the agent comes within earshot and is heard from its first line; the
// map list shows where to listen; guests stand in circles. Pictures go next to this script.
// Run with a static server on 8797 at outputs/m5-prototype: node investigation/claude-tools/party-hints-check.cjs
const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const out=__dirname;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.goto('http://127.0.0.1:8797/party-prototype.html');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:120000});await page.locator('#prep-go').click();await page.waitForTimeout(1500);
const step=frames=>page.evaluate(f=>window.__cleanHands.inspectionStep([],f),frames);
// Far from the hall when the gossip window opens (2:00): nothing plays. Then walk in.
await page.evaluate(()=>{const a=window.__cleanHands;a.disguise('suit');a.jumpTime(125);a.teleport(25,4,0);});await step(240);
const far=await page.evaluate(()=>window.__cleanHands.dialogue());
await page.evaluate(()=>window.__cleanHands.teleport(24.5,14,0));const lines=[];for(let i=0;i<20;i++){await step(30);const d=await page.evaluate(()=>window.__cleanHands.dialogue());if(d.subtitle&&lines.at(-1)!==d.subtitle.speaker+'「'+d.subtitle.text+'」')lines.push(d.subtitle.speaker+'「'+d.subtitle.text+'」');if(i===3){await page.evaluate(()=>{const a=window.__cleanHands;a.view(Math.PI*.9,.2);});await page.waitForTimeout(200);await page.screenshot({path:`${out}/party-hint-hall.png`});}}
const heard=await page.evaluate(()=>({heard:window.__cleanHands.dialogue().heard,chances:window.__cleanHands.chances()}));
// The map list (Tab) with the two still undiscovered and their hints.
await page.keyboard.press('Tab');await page.waitForTimeout(400);const list=await page.evaluate(()=>[...document.querySelectorAll('#chance-list button')].map(b=>b.textContent));await page.screenshot({path:`${out}/party-hint-map.png`});await page.keyboard.press('Tab');
// Guests in the dining room and garden at 3:00.
await page.evaluate(()=>{const a=window.__cleanHands;a.jumpTime(200);a.teleport(42,8,0);a.view(Math.PI*.15,.35);});await step(300);await page.waitForTimeout(300);await page.screenshot({path:`${out}/party-guests-dining.png`});
await page.evaluate(()=>{const a=window.__cleanHands;a.teleport(36,34,0);a.view(Math.PI*.75,.35);});await step(60);await page.waitForTimeout(300);await page.screenshot({path:`${out}/party-guests-court.png`});
console.log(JSON.stringify({farPlaying:far.playing,lines,heard,list,errors},null,1));await browser.close();})();
