// Checks the 2026-11-02 AI/combat fix in the real hotel build (index.html served on 8796):
// no page errors, __cleanHands.aiDebug(), and a guard who finds a suit in a staff zone warns first, then arrests;
// leaving after the warning ends it. Run: node investigation/claude-tools/hotel-ai-check.cjs (static server on 8796).
const {createRequire}=require('module');const r=createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=r('playwright');const out=__dirname;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.goto('http://127.0.0.1:8796/index.html');await page.waitForFunction(()=>window.__cleanHands?.state().modelReady,null,{timeout:120000});
await page.getByRole('button',{name:'作戦開始'}).click();await page.waitForTimeout(2500);await page.mouse.click(640,400);await page.waitForTimeout(800);
const debug=await page.evaluate(()=>{const a=__cleanHands.aiDebug();return {npcs:a.npcs.length,sample:a.npcs.find(n=>n.npcId==='bodyguard_captain'),zoneAlert:a.zoneAlert,hotelAlert:a.hotelAlert,remaining:a.reinforcementRemaining};});
// A staff zone on the ground floor; a guard 4 m from its middle, facing it; the agent in a suit in the middle.
async function scene(leaveAfterWarn){return page.evaluate(async leave=>{const c=__cleanHands,d=c.director(),z=d.mission.zones.find(z=>z.id==='ZONE_staff_kitchen')??d.mission.zones.find(z=>z.type==='staff'&&z.floor===0);
 const g=d.npcs.find(n=>n.id==='guard_yard');let mx=0,mz=0;
 // Open floor: a nav node in the zone with another 4 m west of it from which the guard sees the agent fully.
 for(const q of d.nav.nodes){if(q.y>.5||q.x-4<z.minX+.5||q.x>z.maxX-.5||q.z<z.minZ+.5||q.z>z.maxZ-.5||d.world.blocked(q.x-4,0,q.z))continue;g.pos={x:q.x-4,y:0,z:q.z};g.heading=Math.PI/2;g.perceive({x:q.x,y:0,z:q.z,crouched:false,disguise:'suit'},d.boxes,d.rules);if(g.visibility===1){mx=q.x;mz=q.z;break;}}
 for(const n of d.npcs)if(n!==g&&n.guard&&Math.hypot(n.pos.x-mx,n.pos.z-mz)<25){n.pos={x:200,y:0,z:200};}
 g.scheduled=false;g.state='patrol';g.suspicion=0;g.arrest=false;g.cause='';g.pos={x:mx-4,y:0,z:mz};g.heading=Math.PI/2;g.route.splice(0,g.route.length,[mx-4,mz,600]);g.routeIndex=0;
 c.disguise('suit');c.teleport(mx,mz,0);const log=[];let warned=-1;
 for(let t=0;t<20;t+=.5){await new Promise(r=>setTimeout(r,500));const s=c.state();log.push(`${t.toFixed(1)} ${g.state}${g.arrest?'/arrest':''} ${Math.round(g.suspicion)} ${g.cause} vis=${g.visibility.toFixed(2)} d=${g.distance.toFixed(1)} g=(${g.pos.x.toFixed(1)},${g.pos.z.toFixed(1)}) p=(${s.position.x.toFixed(1)},${s.position.z.toFixed(1)}) over=${s.missionOver||''}`);
  if(warned<0&&g.state==='alert'&&!g.arrest)warned=t;if(leave&&warned>=0&&t>=warned+1&&!log.left){log.left=true;c.teleport(0,-30,0);log.push('-- left to the front drive');}
  if(s.missionOver)break;}
 return {zone:z.id,log,blown:[...d.compromised],over:c.state().missionOver};},leaveAfterWarn);}
const stay=await scene(false);
await page.screenshot({path:`${out}/hotel-ai-1-stay.png`});
// Restart for the second scene.
await page.keyboard.down('KeyR');await page.waitForTimeout(2600);await page.keyboard.up('KeyR');await page.waitForTimeout(1500);
const restarted=await page.evaluate(()=>__cleanHands.state().missionOver);
let leave=null;if(!restarted){leave=await scene(true);}
console.log(JSON.stringify({debug,stay,restarted,leave,errors},null,1));await browser.close();})();
