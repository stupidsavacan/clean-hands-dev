// Verify thrown props in the production hotel, without moving the player or removing bystanders.
// Trigger: playtest 2 fix 8; a landed coin survived retry.
// Run: node ../investigation/verify-playtest2-coins.mjs [http://127.0.0.1:8796/index.html]
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',headless:true,args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.argv[2]??'http://127.0.0.1:8796/index.html');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady);
 await page.screenshot({path:new URL('./playtest2-briefing.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.locator('#prep-go').click();await page.evaluate(()=>window.__cleanHands.view(0,.65));
 await page.keyboard.press('KeyG');await page.waitForFunction(()=>window.__cleanHands.state().coinProps.landed===1);
 await page.waitForTimeout(300);const before=await page.evaluate(()=>window.__cleanHands.state().coinProps);
 await page.screenshot({path:new URL('./playtest2-coin-landed.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.evaluate(()=>document.querySelector('#reset').click());await page.evaluate(()=>window.__cleanHands.view(0,.65));await page.waitForTimeout(200);
 const retry=await page.evaluate(()=>window.__cleanHands.state().coinProps);assert.deepEqual(retry,{flying:0,landed:0,ripples:0});
 await page.screenshot({path:new URL('./playtest2-coin-reset.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.keyboard.press('KeyG');await page.waitForFunction(()=>window.__cleanHands.state().coinProps.landed===1);
 await page.evaluate(()=>document.querySelector('#to-prep').click());const preparation=await page.evaluate(()=>({props:window.__cleanHands.state().coinProps,open:window.__cleanHands.mission().prepOpen}));
 assert.equal(preparation.open,true);assert.deepEqual(preparation.props,{flying:0,landed:0,ripples:0});assert.deepEqual(errors,[]);
 const result={url:page.url(),before,retry,preparation,errors};await writeFile(new URL('./playtest2-coin-browser.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
