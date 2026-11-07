// Checks that F8 works while debugging (2026-11-02): the run is dropped on a debug switch, but a note taken then is
// saved to runs/<time>_debug.json with its picture and the last minute of events. Deletes its own files afterwards.
// Run with the playtest server on 8795: node investigation/claude-tools/pt-debug-memo.cjs
const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const fs=require('fs');
const RUNS='C:/Users/gamit/Documents/Codex/2026-10-26/https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page/outputs/m5-prototype/playtest/runs';
const mine=()=>fs.readdirSync(RUNS).filter(f=>f.endsWith('.json')&&fs.readFileSync(RUNS+'/'+f,'utf8').includes('HeadlessChrome'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:8795/');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:120000});await page.waitForSelector('#pt-pick button.sc');
await page.locator('#pt-pick button.sc').first().click();await page.getByRole('button',{name:'作戦開始'}).click();await page.waitForTimeout(3000);
const before=await page.locator('#pt-badge').innerText();
// A debug switch: the run is dropped.
await page.evaluate(()=>__cleanHands.eventBus().emit({type:'debug.cheat',time:0,id:'test'}));await page.waitForTimeout(800);
const debugBadge=await page.locator('#pt-badge').innerText();
await page.keyboard.press('F8');await page.waitForSelector('#pt-memo-text',{timeout:5000});const head=await page.locator('#pt-memo .head').innerText();
await page.fill('#pt-memo-text','デバッグ中のテストメモ');await page.keyboard.press('Enter');await page.waitForTimeout(2000);
const files=mine(),saved=files.map(f=>{const j=JSON.parse(fs.readFileSync(RUNS+'/'+f,'utf8'));return {f,debug:j.meta.debug,memos:(j.memos||[]).map(m=>({text:m.text,shot:m.shot,recent:m.recent?.length})),events:j.events.length,cheat:j.events.some(e=>e.type==='debug.cheat')};});
const shots=fs.readdirSync(RUNS).filter(f=>files.some(j=>f.startsWith(j.replace('.json','_memo'))));
console.log(JSON.stringify({before,debugBadge,head,saved,shots,errors},null,1));await browser.close();
for(const f of files){fs.unlinkSync(RUNS+'/'+f);for(const s of fs.readdirSync(RUNS).filter(s=>s.startsWith(f.replace('.json','_memo'))))fs.unlinkSync(RUNS+'/'+s);}})();
