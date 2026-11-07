import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON??'C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const report={url:new URL('../../clean-hands-m5.8-pc-fixes.html',import.meta.url).href,errors};
try{await page.goto(report.url);await page.locator('#prep-go').waitFor({state:'visible',timeout:60000});report.briefingVisible=true;await page.screenshot({path:fileURLToPath(new URL('../../investigation/fixes-briefing.png',import.meta.url))});
 await page.locator('#prep-go').click();await page.waitForFunction(()=>{const a=window.__cleanHands,s=a?.state();return s?.modelReady&&!a.mission().prepOpen&&!s.creatorOpen&&!s.missionOver;},{},{timeout:60000});
 await page.waitForTimeout(2000);report.state=await page.evaluate(()=>window.__cleanHands.state());report.mission=await page.evaluate(()=>window.__cleanHands.mission());report.npcs=await page.evaluate(()=>window.__cleanHands.director().npcs.length);
 assert.equal(report.npcs,120);assert.equal(report.mission.prepOpen,false);assert.equal(report.mission.phase,'targets');
 await page.screenshot({path:fileURLToPath(new URL('../../investigation/fixes-playing.png',import.meta.url))});
 assert.deepEqual(errors,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=String(e);throw e;}finally{writeFileSync(new URL('../../investigation/browser-fixes.json',import.meta.url),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,errors:report.errors,npcs:report.npcs,failure:report.failure}));}
