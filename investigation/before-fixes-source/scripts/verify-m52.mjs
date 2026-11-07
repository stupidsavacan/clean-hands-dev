import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
// Uses the desktop's bundled Playwright; no production dependency is added.
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON??'C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const output=fileURLToPath(new URL('../../screenshots/',import.meta.url));mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const actionsOnly=process.argv.includes('--actions-only');
const report={config:{headless:true,viewport:[1280,800],dpr:1,npcs:120,args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']},gpu:null,fps:[],checks:[],errors};
try{
 await page.goto(process.env.M52_URL??'http://127.0.0.1:8772/');await page.locator('#cc-go').waitFor({timeout:60000});await page.locator('#cc-go').click();
 await page.waitForFunction(()=>window.__cleanHands?.state().modelReady&&!window.__cleanHands.state().creatorOpen);
 // Overhead keeps the same camera and workload across all floor/location measurements.
 await page.evaluate(()=>{const a=window.__cleanHands;a.director().caught=false;});
 await page.keyboard.press('v');await page.keyboard.press('v');
 if(await page.locator('#pause-modal.open').count())await page.locator('#resume').click();
 report.gpu=await page.evaluate(()=>{const gl=document.querySelector('#view').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(e.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),npcs:window.__cleanHands.director().npcs.length,dpr:devicePixelRatio};});
 assert.match(report.gpu.renderer,/D3D11/);assert.doesNotMatch(report.gpu.renderer,/SwiftShader|llvmpipe|software/i);assert.equal(report.gpu.npcs,120);
 if(actionsOnly)report.fps=JSON.parse(readFileSync(new URL('../../browser-results.json',import.meta.url),'utf8')).fps;
 const sites=[['開始地点',14.8,-30,0],['ロビー',2,-11,0],['プール',10,15,0],['テラス',38,7,0],['宴会場',-20,-16,3.5],['地下セラー',21,-7.6,-3.5],['ペントハウス',-28,-14,7],['ヘリポート',14,-11,7],['マリーナ',28,27,0],['浜辺',54,5,0],['駐車場',-30,-23.4,0]];
 for(let i=0;!actionsOnly&&i<sites.length;i++){
  const [name,x,z,y]=sites[i];await page.evaluate(([x,z,y,name])=>{const a=window.__cleanHands;a.disguise(['地下セラー','ペントハウス','ヘリポート','マリーナ','駐車場'].includes(name)?'bodyguard':'suit');a.teleport(x,z,y);},[x,z,y,name]);await page.waitForTimeout(1800);
  const sample=await page.evaluate(()=>new Promise(resolve=>{const frames=[],start=performance.now();let last=start;function next(t){frames.push(t-last);last=t;if(t-start<5000)requestAnimationFrame(next);else{const sorted=[...frames].sort((a,b)=>a-b);resolve({fps:+(frames.length*1000/(t-start)).toFixed(1),p95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(1),minOneSecondFps:Math.min(...Array.from({length:5},(_,i)=>{let elapsed=0,count=0;for(const frame of frames){elapsed+=frame;if(elapsed>=i*1000&&elapsed<(i+1)*1000)count++;}return count;})),seconds:+((t-start)/1000).toFixed(2),state:window.__cleanHands.state()});}}requestAnimationFrame(next);}));
  report.fps.push({place:name,fps:sample.fps,p95Ms:sample.p95Ms,minOneSecondFps:sample.minOneSecondFps,seconds:sample.seconds,frozen:sample.state.paused||sample.state.creatorOpen||!!sample.state.missionOver});
  await page.screenshot({path:output+`m52-${String(i+1).padStart(2,'0')}.png`});console.log(name,sample.fps,'fps');
 }
 const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});console.log(name,pass);assert.ok(pass,name);};
 check('clock advances in live frames',await page.evaluate(()=>window.__cleanHands.clock().elapsed>0));
 await page.locator('#pause').click();await page.waitForTimeout(300);const pausedAt=await page.evaluate(()=>window.__cleanHands.clock().elapsed);await page.waitForTimeout(600);check('pause freezes mission time',await page.evaluate(t=>window.__cleanHands.state().paused&&window.__cleanHands.clock().elapsed===t,pausedAt));await page.locator('#resume').click();
 await page.keyboard.press('Tab');await page.waitForTimeout(300);check('map lists all three target schedules',await page.locator('#target-schedules b').count()===3);await page.screenshot({path:output+'m52-target-plans.png'});const mapAt=await page.evaluate(()=>window.__cleanHands.clock().elapsed);await page.waitForTimeout(300);check('map freezes mission time',await page.evaluate(t=>window.__cleanHands.clock().elapsed===t,mapAt));await page.keyboard.press('Tab');
 await page.locator('#debug summary').click();await page.locator('#time-rate').selectOption('4');const fastAt=await page.evaluate(()=>window.__cleanHands.clock().elapsed);await page.waitForTimeout(2000);const advance=await page.evaluate(t=>window.__cleanHands.clock().elapsed-t,fastAt);check('four-times speed in live frames',advance>6.5&&advance<10,{seconds:advance});
 await page.locator('#time-rate').selectOption('1');await page.locator('#debug summary').click();
 // The same live fixed loop moves the actors after each jump; no actor positions are assigned.
 await page.evaluate(()=>{const a=window.__cleanHands;a.disguise('suit');a.teleport(38,5,0);a.timeScale(4);a.jumpTime(360);});
 const aStart=await page.evaluate(()=>({...window.__cleanHands.director().npcs.find(n=>n.id==='wine_merchant').pos}));
 await page.waitForFunction(()=>window.__cleanHands.schedule().find(s=>s.id==='wine_merchant').phase==='acting',{},{timeout:30000});
 const aPhoto=await page.evaluate(()=>window.__cleanHands.schedule().find(s=>s.id==='wine_merchant'));
 check('A physically reaches the terrace and performs photo',aPhoto.action==='photo'&&Math.hypot(aPhoto.position.x-40,aPhoto.position.z-7)<1&&Math.hypot(aPhoto.position.x-aStart.x,aPhoto.position.z-aStart.z)>5,aPhoto);await page.screenshot({path:output+'m52-A-photo.png'});
 await page.evaluate(()=>{const a=window.__cleanHands;a.disguise('bodyguard');a.teleport(28,33.6,0);a.jumpTime(600);});
 await page.waitForFunction(()=>{const s=window.__cleanHands.schedule().find(s=>s.id==='wine_merchant');return s.phase==='acting'&&s.action==='tour';},{},{timeout:30000});
 check('A boards the yacht deck through the gangway',await page.evaluate(()=>{const p=window.__cleanHands.schedule().find(s=>s.id==='wine_merchant').position;return p.z>31&&p.x>18&&p.x<38;}));await page.screenshot({path:output+'m52-A-yacht.png'});
 await page.evaluate(()=>window.__cleanHands.disguise('suit'));
 await page.evaluate(()=>{const a=window.__cleanHands;a.teleport(-22,-12,3.5);a.jumpTime(300);});
 await page.waitForFunction(()=>{const s=window.__cleanHands.schedule().find(s=>s.id==='lawyer');return s.phase==='acting'&&s.action==='speech';},{},{timeout:30000});
 check('B speaks in the banquet hall',await page.evaluate(()=>Math.abs(window.__cleanHands.schedule().find(s=>s.id==='lawyer').position.y-3.5)<.1));await page.screenshot({path:output+'m52-B-speech.png'});
 await page.evaluate(()=>{const a=window.__cleanHands;a.disguise('bodyguard');a.teleport(-23,0,7);a.jumpTime(420);});
 await page.waitForFunction(()=>{const s=window.__cleanHands.schedule().find(s=>s.id==='investor');return s.phase==='acting'&&s.action==='phone';},{},{timeout:30000});
 await page.waitForFunction(()=>window.__cleanHands.dialogue().subtitle?.id==='investor_helicopter',{},{timeout:30000});await page.screenshot({path:output+'m52-C-phone-subtitle.png'});
 check('C phone subtitles complete and are recorded as heard',await page.waitForFunction(()=>window.__cleanHands.dialogue().heard.includes('investor_helicopter'),{},{timeout:30000}).then(()=>true));
 await page.evaluate(()=>{const a=window.__cleanHands;a.teleport(-24,-6,7);a.jumpTime(660);});
 await page.waitForFunction(()=>{const s=window.__cleanHands.schedule().find(s=>s.id==='investor');return s.phase==='acting'&&s.action==='massage';},{},{timeout:30000});
 await page.waitForFunction(()=>{const s=window.__cleanHands.schedule().find(s=>s.id==='masseuse');return s.phase==='acting'&&s.action==='massage_work';},{},{timeout:30000});check('C receives massage beside the scheduled therapist',await page.evaluate(()=>{const s=window.__cleanHands.schedule(),c=s.find(s=>s.id==='investor'),m=s.find(s=>s.id==='masseuse');return Math.abs(c.position.y-m.position.y)<.1&&Math.hypot(c.position.x-m.position.x,c.position.z-m.position.z)<3;}));await page.screenshot({path:output+'m52-C-massage.png'});
 // Trigger an existing individual AI interruption, then restore patrol to exercise resume.
 await page.evaluate(()=>{const n=window.__cleanHands.director().npcs.find(n=>n.id==='wine_merchant');n.state='curious';n.timer=100;});await page.waitForTimeout(200);
 check('individual suspicion suspends schedule',await page.evaluate(()=>window.__cleanHands.schedule().find(s=>s.id==='wine_merchant').phase==='paused'));
 await page.evaluate(()=>{const a=window.__cleanHands,n=a.director().npcs.find(n=>n.id==='wine_merchant');a.jumpTime(920);n.state='patrol';n.suspicion=0;});await page.waitForTimeout(200);
 check('calm resumes current time slot',await page.evaluate(()=>window.__cleanHands.schedule().find(s=>s.id==='wine_merchant').place==='pool_side'));
 await page.evaluate(()=>window.__cleanHands.hotel().level=2);await page.waitForTimeout(200);check('hotel alert 2 stops subtitles',await page.evaluate(()=>window.__cleanHands.dialogue().subtitle===null));await page.screenshot({path:output+'m52-alert-stops-dialogue.png'});
 await page.evaluate(()=>{const a=window.__cleanHands;a.hotel().level=0;a.timeScale(1);a.jumpTime(1800);});await page.waitForTimeout(200);check('second loop restarts plans and clock',await page.evaluate(()=>window.__cleanHands.clock().cycle===1&&window.__cleanHands.schedule().filter(s=>['wine_merchant','lawyer','investor'].includes(s.id)).every(s=>s.slot===0)));await page.screenshot({path:output+'m52-second-loop.png'});
 writeFileSync(new URL('../../browser-results.json',import.meta.url),JSON.stringify(report,null,2));
 assert.equal(errors.length,0,errors.join('\n'));for(const f of report.fps){assert.ok(f.fps>=30,`${f.place}: ${f.fps}fps`);assert.ok(f.minOneSecondFps>=30,`${f.place}: minimum 1s ${f.minOneSecondFps}fps`);assert.equal(f.frozen,false,`${f.place} is frozen`);}
}finally{writeFileSync(new URL('../../browser-results.json',import.meta.url),JSON.stringify(report,null,2));await browser.close();}
