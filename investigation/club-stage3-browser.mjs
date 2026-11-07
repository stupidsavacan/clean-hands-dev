// Four short stage-three visual checks and a recorder payload check.
// Run in m5-prototype: node investigation/club-stage3-browser.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js'));
const {chromium}=require('playwright');
const read=name=>readFileSync(join(root,name),'utf8');
const html=read('club-prototype.html').replace('</body>','<script src="/playtest.js"></script><script src="/debug.js"></script></body>');
const data=name=>read('app/src/data/club-'+name+'.json');
const stage=JSON.parse(data('stage3'));
const act=id=>stage.acts.find(a=>a.id===id);
const responses=new Map([
 ['/club',{body:html,contentType:'text/html; charset=utf-8'}],
 ...['playtest.js','debug.js'].map(name=>['/'+name,{body:read('playtest/'+name),contentType:'text/javascript; charset=utf-8'}]),
 ...['chances','actions','schedule'].map(name=>['/api/'+name,{body:data(name),contentType:'application/json'}]),
]);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const errors=[];
let saved;
try{
 const page=await browser.newPage({viewport:{width:1440,height:765}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://127.0.0.1:18796/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/run'&&req.method()==='POST')saved=req.postDataJSON();
  await route.fulfill(responses.get(url.pathname)??{json:{ok:true}});
 });
 async function start(){
  await page.goto('http://127.0.0.1:18796/club?test=crowd-qa');
  await page.waitForFunction(()=>window.__cleanHands?.state().modelReady);
  await page.locator('#pt-pick [data-id="full"]').click();
  await page.locator('#prep-go').click();
  await page.locator('#pt-badge .rec').waitFor();
 }
 async function photo(name){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:join(root,'investigation','club-stage3-'+name+'.png')});
 }
 async function drop(dark){
  await start();
  const state=await page.evaluate(({dark,light})=>{
   const game=window.__cleanHands;
   game.teleport(16,16);
   game.inspectionStep([],240);
   if(dark){
    game.disguise('technician');
    game.teleport(light.at.x,light.at.z,light.at.y);
    game.inspectionStep(['KeyE'],Math.ceil(light.seconds*60)+3);
   }
   game.teleport(22,2);
   game.disguise('suit');
   game.jumpTime(610);
   game.inspectionStep([],110*60+18);
   game.teleport(24.65,25);
   game.inspectionCamera({x:24.65,y:2.7,z:25.8},{x:25.2,y:1.35,z:32.4});
   return game.m53();
  },{dark,light:act('drop_lights')});
  assert.ok(state.flags.includes('drop_pressed'));
  assert.equal(state.blackout,dark);
  await photo(dark?'drop-dark':'drop-lit');
 }
 await drop(false);
 await drop(true);
 await start();
 const phone=act('meet_call'),note=act('meet_note');
 await page.evaluate(({phone,note})=>{
  const game=window.__cleanHands;
  game.disguise('manager');
  game.teleport(note.at.x,note.at.z,note.at.y);
  game.inspectionStep(['KeyE'],Math.ceil(note.seconds*60)+3);
  game.inspectionStep([],1);
  game.teleport(phone.at.x,phone.at.z,phone.at.y);
  game.inspectionCamera({x:15.65,y:1.67,z:32.4},{x:14.68,y:.85,z:32.15});
 },{phone,note});
 await photo('intercom');
 const meeting=await page.evaluate(phone=>{
  const game=window.__cleanHands;
  game.inspectionStep(['KeyE'],Math.ceil(phone.seconds*60)+3);
  game.teleport(22,2);
  game.disguise('suit');
  game.inspectionStep([],62*60);
  game.disguise('chef');
  game.teleport(8.3,37.1);
  game.inspectionCamera({x:8.3,y:1.75,z:37.1},{x:10,y:1.15,z:39});
  const d=game.director();
  return {flags:game.m53().flags,investor:d.npcs.find(n=>n.id==='investor').pos,escort:d.npcs.find(n=>n.id==='escort').pos};
 },phone);
 assert.ok(meeting.flags.includes('meet_call')&&meeting.flags.includes('meet_arrived'));
 await photo('dock');
 await page.waitForTimeout(5100);
 assert.equal(saved?.meta.test,'crowd-qa');
 const progress=saved.events.filter(e=>e.type==='chance.updated'||e.type==='flag.set'&&['meet_call','meet_arrived'].includes(e.id));
 assert.ok(progress.some(e=>e.type==='chance.updated'&&e.id==='meet'&&e.at));
 for(const id of ['meet_call','meet_arrived'])assert.ok(progress.some(e=>e.id===id&&e.at&&Number.isFinite(e.clock)));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({meeting,progress,errors},null,2));
}finally{
 await browser.close();
}
