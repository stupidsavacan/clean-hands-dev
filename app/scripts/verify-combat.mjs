// Real-rig check of the M5.5 gunplay motions in the combat lab: sweeps every actor × motion (standing and walking)
// at 101 moments, records the worst hand-to-grip IK error and console errors, and saves proof screenshots.
// Serve the outputs folder first (the lab is ../combat-motions/index.html), then: node scripts/verify-combat.mjs
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON??'C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=fileURLToPath(new URL('../../combat-motions/proof/',import.meta.url));mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(process.env.COMBAT_URL??'http://127.0.0.1:8768/m5-prototype/combat-motions/index.html');await page.waitForFunction(()=>window.__combat?.ready(),null,{timeout:60000});
const hands=await page.evaluate(()=>{const out={};for(const w of ['agent','guard','bodyguard','response'])for(const k of ['draw','holster','aim','fire','reload','hit','cover','coverAim'])for(const walk of k==='hit'||k.startsWith('cover')?[false]:[false,true]){let worst=0,at=0;for(let i=0;i<=100;i++){const e=window.__combat.show(w,k,i/100,walk,1);if(e>worst){worst=e;at=i/100;}}out[`${w} ${k}${walk?' walk':''}`]={worstCm:+(worst*100).toFixed(2),at};}return out;});
const shots=[['agent','draw',.3,false],['agent','aim',0,false],['agent','aim',0,true],['agent','fire',.18,false],['agent','reload',.12,false],['agent','reload',.44,false],['agent','reload',.85,false],['agent','hit',.22,false],['agent','cover',0,false],['agent','coverAim',1,false],
 ['guard','aim',0,false],['bodyguard','draw',0,false],['bodyguard','aim',0,false],['bodyguard','reload',.44,false],['bodyguard','cover',0,false],['response','aim',0,false],['response','aim',0,true],['response','fire',.18,false],['response','coverAim',1,false],['guest','flee',.25,false],['guest','duck',1,false]];
for(const [w,k,t,walk] of shots)for(const [name,angle] of [['35',1.0],['side',1.5708]]){await page.evaluate(([w,k,t,walk,a])=>window.__combat.show(w,k,t,walk,a),[w,k,t,walk,angle]);await page.waitForTimeout(150);await page.screenshot({path:`${out}${w}-${k}-${t}${walk?'-walk':''}-${name}.png`,clip:{x:0,y:52,width:900,height:560}});}
const worst=Math.max(...Object.values(hands).map(v=>v.worstCm));
writeFileSync(fileURLToPath(new URL('../../combat-motions/verify.json',import.meta.url)),JSON.stringify({worstHandErrorCm:worst,hands,consoleErrors:errors,shots:shots.length*2},null,1));
console.log(`combinations ${Object.keys(hands).length}, worst hand error ${worst} cm, console errors ${errors.length}`);
await browser.close();if(worst>2.5||errors.length)process.exitCode=1;
