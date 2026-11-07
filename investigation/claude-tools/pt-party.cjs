const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const fs=require('fs'),out=__dirname;
const RUNS='C:/Users/gamit/Documents/Codex/2026-10-26/https-claude-ai-artifact-xacywsdv65cc1xpspq147p-page/outputs/m5-prototype/playtest/runs';
const mine=()=>fs.readdirSync(RUNS).filter(f=>f.startsWith('2026110')&&f.endsWith('.json')&&fs.readFileSync(RUNS+'/'+f,'utf8').includes('HeadlessChrome'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const res={};const errors=[];
for(const [map,url] of [['party','http://127.0.0.1:8795/party'],['hotel','http://127.0.0.1:8795/']]){
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(map+': '+e));page.on('console',m=>{if(m.type()==='error')errors.push(map+' console: '+m.text());});
 await page.goto(url);await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:90000});
 await page.waitForSelector('#pt-pick button.sc');
 res[map]={picker:(await page.locator('#pt-pick').innerText()).slice(0,400)};
 await page.screenshot({path:`${out}/pt-${map}-picker.png`});
 // a chance scenario (second button) for the party, the full run for the hotel
 await page.locator('#pt-pick button.sc').nth(map==='party'?1:0).click();
 await page.getByRole('button',{name:'作戦開始'}).click();await page.waitForTimeout(2500);await page.mouse.click(640,400);await page.waitForTimeout(7000);
 res[map].badge=await page.locator('#pt-badge').innerText();
 res[map].files=mine();
 if(map==='party'){
  // debug panel: every tab renders, an act and a flag work
  await page.keyboard.press('F9');await page.waitForTimeout(300);
  for(const t of ['self','switch','events','people','move']){await page.locator(`#dbg [data-tab="${t}"]`).click();await page.waitForTimeout(150);const txt=await page.locator('#dbg .body').innerText();res[map]['tab_'+t]=txt.includes('読み込めませんでした')?'BROKEN':txt.length;await page.screenshot({path:`${out}/pt-party-${t}.png`});}
  await page.locator('#dbg [data-tab="events"]').click();
  await page.locator('#dbg [data-a="actGo"][data-id="papers"]').click();await page.waitForTimeout(150);
  await page.locator('#dbg [data-a="actDo"][data-id="papers"]').click();await page.waitForTimeout(150);
  res[map].afterAct=await page.evaluate(()=>({pos:__cleanHands.state().position,flags:[...__cleanHands.field().flags]}));
  await page.locator('#dbg [data-tab="move"]').click();await page.waitForTimeout(150);
  res[map].spots=await page.locator('#dbg [data-a="spot"]').count();
  await page.locator('#dbg [data-a="spot"]').last().click();await page.waitForTimeout(150);
  res[map].spotFoot=await page.locator('#dbg .foot').innerText();
  await page.keyboard.press('F9');await page.waitForTimeout(6000);
  res[map].filesAfterDebug=mine();res[map].badgeAfterDebug=await page.locator('#pt-badge').innerText();
 }
 await page.close();
}
console.log(JSON.stringify({res,errors},null,1));await browser.close();
for(const f of mine())fs.unlinkSync(RUNS+'/'+f);})();
