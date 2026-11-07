const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const fs=require('fs');
const RUNS='C:/Users/gamit/Documents/Codex/2026-10-26/https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page/outputs/m5-prototype/playtest/runs';
const mine=()=>fs.readdirSync(RUNS).filter(f=>f.startsWith('2026110')&&f.endsWith('.json')&&fs.readFileSync(RUNS+'/'+f,'utf8').includes('HeadlessChrome'));
// Pick each party scenario in turn (through the picker, as a player would) and see what the game tracks.
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const out=[];
for(const pick of [1,2,3]){const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto('http://127.0.0.1:8795/party');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:90000});await page.waitForSelector('#pt-pick button.sc');
 const label=await page.locator('#pt-pick button.sc').nth(pick).locator('b').innerText();
 await page.locator('#pt-pick button.sc').nth(pick).click();
 await page.getByRole('button',{name:'作戦開始'}).click();await page.waitForTimeout(3000);
 const st=await page.evaluate(()=>({tracked:__cleanHands.chances().filter(c=>c.tracked).map(c=>c.id),status:__cleanHands.chances().map(c=>c.id+':'+c.status),field:document.getElementById('field-status')?.textContent}));
 out.push({picked:label,badge:(await page.locator('#pt-badge').innerText()).split('\n')[1],...st});await page.close();}
console.log(JSON.stringify(out,null,1));await browser.close();for(const f of mine())fs.unlinkSync(RUNS+'/'+f);})();
