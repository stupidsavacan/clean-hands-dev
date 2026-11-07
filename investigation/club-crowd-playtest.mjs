import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const {chromium}=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js')('playwright');
const browser=await chromium.launch({executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',headless:true,args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1080,height:810}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.CLUB_TEST_URL ?? 'http://127.0.0.1:8795')+'/club?test=crowd-qa'+(process.argv.includes('--indoor')?'&spawn=24,22':''));
 await page.locator('button.sc[data-id="full"]').click();
 await page.waitForFunction(()=>window.__cleanHands?.state().modelReady);
 if(process.argv.includes('--draw'))await page.locator('input[name="pistol"][value="pistol_silenced"]').check();
 const vision=process.argv.includes('--vision');
 const save=page.waitForResponse(r=>r.url().endsWith('/api/run')&&r.ok()&&(vision ? (rows=>rows?.some(row=>row.kind==='sight'&&row.people.length)&&rows?.some(row=>row.kind==='sight'&&row.blocked.length))(r.request().postDataJSON().telemetry) : r.request().postDataJSON().telemetry?.some(row=>row.kind===(process.argv.includes('--draw')?'draw':'sight'))));
 await page.locator('#prep-go').click();
 await page.locator('#pt-badge').getByText(/REC/).waitFor();
 if(vision){
  await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.up('KeyW');
 } else if(process.argv.includes('--draw')){
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(400);
  if(process.argv.includes('--indoor'))await page.keyboard.press('Space');
  await page.keyboard.press('KeyQ');
 } else {
  // Move and frisk through the game's usual keyboard bindings.
  await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyB');await page.waitForTimeout(5000);await page.keyboard.up('KeyB');
  await page.keyboard.down('KeyW');await page.waitForTimeout(4500);await page.keyboard.up('KeyW');
 }
 const response=await save;
 const run=response.request().postDataJSON();
 assert.equal(run.meta.test,'crowd-qa');assert.match(run.meta.id,/_club-full$/);
 await page.keyboard.press('F9');
 await page.locator('#dbg').waitFor({timeout:4000});
 await page.goto('about:blank');
 const saved=new URL('../playtest/runs/'+run.meta.id+'.json',import.meta.url);
 let closed=false;
 for(let i=0;i<30;i++){
  if(JSON.parse(readFileSync(saved,'utf8')).end?.why==='page closed'){closed=true;break;}
  await delay(100);
 }
 assert.ok(closed,'Page close was not saved');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({id:run.meta.id,rows:run.telemetry.length,seen:run.telemetry.find(r=>r.kind==='sight'&&r.people.length),blocked:run.telemetry.find(r=>r.kind==='sight'&&r.blocked.length),examples:run.telemetry.filter(r=>r.kind==='action'||r.reason==='crowd_scream').slice(0,3)}));
}finally{await browser.close();}
