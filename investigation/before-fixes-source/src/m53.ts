import type {Director,Npc,PlayerView} from './ai.ts';
import {permission,zoneAt} from './ai.ts';
import type {M3System} from './m3.ts';
import type {M4System} from './m4.ts';
import type {MissionClock} from './schedule.ts';
import {Chances,type ChancesData} from './chances.ts';
import type {MissionEvents} from './events.ts';
import {judgeKill,markDead,type KillCamera,type KillRecord} from './kills.ts';
import {floorOf,inside,type Position,type Rect} from './world.ts';
import {segmentClear} from './sight.ts';
export type M53Rules={poisonDoses:number;interactRadius:number;talkSeconds:number;poisonSeconds:number;serveSeconds:number;inviteSeconds:number;pushSeconds:number;pushDistance:number;pushBackAngle:number;edgeRadius:number;cordonRadius:number;cordonSeconds:number;reactionRadius:number;privateRadius:number;facingRate:number;tastingWindow:number[];heldIllegal:boolean;fallSeconds:number;scriptedGraceSeconds:number};
export type Edge={id:string;floor:number;axis:string;fixed:number;from:number;to:number;outward:number[]};
export type M53Map={arrivalBoat:Position;barrel:{id:string;object:string;position:Position;approach:Position;label:string};glass:{position:Position;approach:Position;label:string};privatePlace:Position;cellar:Rect&{floor:number};pushEdges:Edge[]};
export type FieldAction={kind:'greet'|'poison'|'serve'|'invite'|'push';elapsed:number;duration:number;start:Position;npc?:Npc;edge?:Edge};
const distance=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
export class M53System{
 readonly director:Director;readonly m3:M3System;readonly m4:M4System;readonly clock:MissionClock;readonly events:MissionEvents;readonly rules:M53Rules;readonly map:M53Map;readonly cameras:KillCamera[];readonly chances:Chances;
 action:FieldAction|null=null;poison:number;cellarKey=false;shownIllegal:boolean;barrel:'ready'|'armed'|'fired'|'result'='ready';barrelCycle=-1;invited=false;notices:string[]=[];readonly kills:KillRecord[]=[];readonly cordons:{position:Position;until:number;victim:string}[]=[];
 reactionText='';reactionUntil=0;private held=new Set<string>();private lastDisguise='';private cellarEntered=false;private deaths=new Set<string>();private witnessed=new Set<string>();private graceUntil=0;
 constructor(d:Director,m3:M3System,m4:M4System,clock:MissionClock,events:MissionEvents,rules:M53Rules,map:M53Map,cameras:KillCamera[],chances:ChancesData){this.director=d;this.m3=m3;this.m4=m4;this.clock=clock;this.events=events;this.rules=rules;this.map=map;this.cameras=cameras;this.poison=rules.poisonDoses;this.shownIllegal=rules.heldIllegal;this.chances=new Chances(chances,events);m3.onAccidentFound=(body,n)=>this.accident(body,n);m4.extraInventory=()=>[...(this.poison>0?['poison_lethal']:[]),...(this.cellarKey?['cellar_key']:[])];}
 get locked(){return !!this.action;}
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 get wine(){return this.director.npcs.find(n=>n.id==='wine_merchant')!;}
 get tasting(){const t=this.clock.time;return t>=this.rules.tastingWindow[0]&&t<this.rules.tastingWindow[1];}
 get tampering(){return this.action?.kind==='poison';}
 clear(a:Position,b:Position){return Math.abs(a.y-b.y)<.35&&segmentClear(this.director.boxes,{...a,y:a.y+1.1},{...b,y:b.y+1.1});}
 near(a:Position,b:Position){return distance(a,b)<=this.rules.interactRadius&&this.clear(a,b);}
 isRestricted(p:Position){return this.cordons.some(c=>c.until>this.clock.elapsed&&Math.abs(c.position.y-p.y)<.5&&distance(p,c.position)<this.rules.cordonRadius);}
 private hasStaff(p:PlayerView){return permission(this.director.rules,this.m4.disguise,zoneAt(this.director.mission.zones,p.x,p.z,p.floor))==='allow';}
 private wineReady(){const n=this.wine;return n.active&&!n.busy&&n.state==='patrol'&&!n.scheduleTarget&&n.scheduleAction==='tasting'&&Math.abs(n.pos.y-this.map.glass.approach.y)<.3&&distance(n.pos,this.map.glass.approach)<=this.rules.interactRadius&&!this.invited;}
 pushTarget(p:Position,heading:number){void heading;for(const n of this.director.npcs){if(!n.active||n.busy||distance(p,n.pos)>this.rules.pushDistance||!this.clear(p,n.pos))continue;
  const d=distance(p,n.pos);if(d<.2||((p.x-n.pos.x)*Math.sin(n.heading)+(p.z-n.pos.z)*Math.cos(n.heading))/d>-Math.cos(this.rules.pushBackAngle*Math.PI/180))continue;
  const edge=this.map.pushEdges.find(e=>e.floor===floorOf(n.pos.y)&&Math.abs((e.axis==='x'?n.pos.z:n.pos.x)-e.fixed)<=this.rules.edgeRadius&&(e.axis==='x'?n.pos.x:n.pos.z)>=e.from&&(e.axis==='x'?n.pos.x:n.pos.z)<=e.to&&Math.sin(n.heading)*e.outward[0]+Math.cos(n.heading)*e.outward[1]>.5);
  if(edge)return {npc:n,edge};}return null;}
 prompt(p:PlayerView,heading:number){if(this.action)return {text:({greet:'J 給仕長に挨拶している',poison:'E 致死毒を仕込んでいる',serve:'E 最初の一杯を出している',invite:'J セラー奥へ誘っている',push:'P 突き落としている'}[this.action.kind])+'…',progress:this.progress};
  if(this.pushTarget(p,heading))return {text:'P 長押し 背後から突き落とす',progress:0};
  const head=this.director.npcs.find(n=>n.id==='head_waiter')!;
  if(!this.cellarKey&&this.m4.disguise==='sommelier'&&head.active&&!head.busy&&!this.director.compromised.has(this.m4.disguise)&&['patrol','curious','verify'].includes(head.state)&&this.near(p,head.pos))return {text:'J 長押し ソムリエとして挨拶する・鍵を受け取る',progress:0};
  if(this.near(p,this.map.barrel.approach)){if(this.barrel!=='ready')return {text:this.barrel==='armed'?'樽は準備済み。１９分からの最初の一杯を待つ。':'限定ワインの一杯は終了した',progress:0};if(this.clock.time>=this.rules.tastingWindow[0])return {text:'仕込み時間を過ぎた。次の周の１９分までに準備する。',progress:0};if(!this.hasStaff(p))return {text:'樽への仕込みにはスタッフの服が必要',progress:0};return {text:this.poison>0?'E 長押し 限定ワインの樽に致死毒を仕込む':'致死毒がない',progress:0};}
  if(this.m4.disguise==='sommelier'&&this.cellarKey&&this.wineReady()&&this.tasting&&this.near(p,this.map.glass.approach))return {text:this.poison>0?'E 長押し 毒入りの一杯を出す ／ J セラー奥へ誘う':'J 長押し セラー奥へ誘う',progress:0};
  return null;}
 private begin(kind:FieldAction['kind'],p:Position,npc?:Npc,edge?:Edge){const durations={greet:this.rules.talkSeconds,poison:this.rules.poisonSeconds,serve:this.rules.serveSeconds,invite:this.rules.inviteSeconds,push:this.rules.pushSeconds};this.witnessed.clear();this.action={kind,elapsed:0,duration:durations[kind],start:{...p},npc,edge};if(npc){npc.busy=true;npc.speed=0;if(kind==='greet'){npc.scriptedImmune=true;npc.face=0;if(npc.state==='verify'||npc.state==='curious')npc.state='patrol';}}}
 cancel(){if(this.action?.npc){this.action.npc.busy=false;this.action.npc.scriptedImmune=this.action.npc.id==='head_waiter'&&this.clock.elapsed<this.graceUntil;}this.action=null;}
 step(dt:number,p:PlayerView,heading:number,keys:Set<string>,suppressed=false){this.notices=[];const host=this.director.npcs.find(n=>n.id==='head_waiter')!;
  // The head waiter is expecting the sommelier, so he does not check that face until he has handed over the key.
  host.scriptedImmune=this.clock.elapsed<this.graceUntil||this.action?.kind==='greet'||this.m4.disguise==='sommelier'&&!this.cellarKey;
  if(this.lastDisguise!==this.m4.disguise){this.lastDisguise=this.m4.disguise;this.events.emit({type:'disguise.changed',time:this.clock.elapsed,id:this.m4.disguise});}
  const cellar=p.floor===this.map.cellar.floor&&inside(this.map.cellar,p.x,p.z)&&this.hasStaff(p);if(cellar&&!this.cellarEntered)this.events.emit({type:'cellar.entered',time:this.clock.elapsed});this.cellarEntered=cellar;
  if(!this.tasting&&this.invited){this.wine.scriptedGoal=null;this.wine.scriptedAction='';this.invited=false;}
  // An unconsumed armed barrel carries to the next round; a served barrel cannot kill twice.
  if(this.barrel==='result'&&this.clock.cycle!==this.barrelCycle)this.barrel='ready';
  const fresh=(key:string)=>!suppressed&&keys.has(key)&&!this.held.has(key),moving=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k));
  let usedE=false;
  if(this.action){const a=this.action,key=a.kind==='greet'||a.kind==='invite'?'KeyJ':a.kind==='push'?'KeyP':'KeyE';usedE=key==='KeyE';
   const invalid=suppressed||moving||!keys.has(key)||distance(p,a.start)>.15||Math.abs(p.y-a.start.y)>.2||a.npc&&(!a.npc.active||a.npc.state!=='patrol'||distance(p,a.npc.pos)>this.rules.interactRadius)||a.kind==='poison'&&(!this.hasStaff(p)||this.clock.time>=this.rules.tastingWindow[0])||['serve','invite'].includes(a.kind)&&(!this.tasting||this.m4.disguise!=='sommelier'||!this.cellarKey);
   if(invalid)this.cancel();else{a.elapsed+=dt;if(a.kind==='poison'||a.kind==='push')this.witness(p);if(a.elapsed>=a.duration){this.complete(a,p);this.cancel();}}
  }else if(!suppressed&&!moving&&(fresh('KeyP')||fresh('KeyJ')||fresh('KeyE'))){const prompt=this.prompt(p,heading)?.text??'';
   if(fresh('KeyP')){const target=this.pushTarget(p,heading);if(target)this.begin('push',p,target.npc,target.edge);}
   else if(fresh('KeyJ')&&prompt.includes('挨拶'))this.begin('greet',p,this.director.npcs.find(n=>n.id==='head_waiter'));
   else if(fresh('KeyJ')&&prompt.includes('誘'))this.begin('invite',p,this.wine);
   else if(fresh('KeyE')&&prompt.startsWith('E 長押し 限定')&&this.poison>0){this.begin('poison',p);usedE=true;}
   else if(fresh('KeyE')&&prompt.startsWith('E 長押し 毒')&&this.poison>0){this.begin('serve',p,this.wine);usedE=true;}
  }
  this.held=new Set(keys);return usedE;}
 afterAi(p:PlayerView){
  // Wait for the real first drinker to arrive, not just the wall-clock boundary.
  if(this.barrel==='armed'&&this.tasting&&this.wineReady()){this.barrel='fired';this.events.emit({type:'trap.fired',time:this.clock.elapsed,id:'wine_barrel'});this.kill(this.wine,'wine_barrel',p);this.barrel='result';this.barrelCycle=this.clock.cycle;}
  for(const n of this.director.npcs)if(n.life==='dead'&&!this.deaths.has(n.id)){this.deaths.add(n.id);const at=distance(n.pos,this.map.privatePlace)<=this.rules.privateRadius&&Math.abs(n.pos.y-this.map.privatePlace.y)<.5?'private_cellar':undefined;this.events.emit({type:'npc.killed',time:this.clock.elapsed,id:n.id,method:n.deathMethod,place:at,judgement:n.deathKind});}
 }
 private complete(a:FieldAction,p:PlayerView){const t=this.clock.elapsed;
  if(a.kind==='greet'){this.graceUntil=t+this.rules.scriptedGraceSeconds;this.cellarKey=true;this.events.emit({type:'npc.talked',time:t,id:'head_waiter'});this.events.emit({type:'item.picked',time:t,id:'cellar_key'});this.notices.push('給仕長「お待ちしていました。こちらがセラーの鍵です」');}
  else if(a.kind==='poison'){this.poison--;this.barrel='armed';this.barrelCycle=this.clock.cycle;this.events.emit({type:'item.used',time:t,id:'poison_lethal'});this.events.emit({type:'trap.armed',time:t,id:'wine_barrel'});this.notices.push('限定ワインに毒を仕込んだ。最初の一杯はワイン商だけに出される。');}
  else if(a.kind==='serve'){this.poison--;this.events.emit({type:'item.used',time:t,id:'poison_lethal'});this.kill(this.wine,'poison_glass',p);}
  else if(a.kind==='invite'){this.invited=true;this.wine.scriptedGoal={...this.map.privatePlace};this.wine.scriptedAction='drink';this.notices.push('ワイン商「特別な一本だね？ 奥で聞かせてもらおう」');}
  else if(a.kind==='push'&&a.npc){this.kill(a.npc,'push',p);const n=a.npc;n.fallOrigin={...n.pos};n.fallSeconds=this.rules.fallSeconds;const edge=a.edge!,target={x:n.pos.x+edge.outward[0]*this.rules.cordonRadius,y:0,z:n.pos.z+edge.outward[1]*this.rules.cordonRadius},index=this.director.nav.nearest(target);if(index>=0){const end=this.director.nav.nodes[index];n.pos={x:end.x,y:end.y,z:end.z};}}
 }
 private witness(p:PlayerView){for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive(p,this.director.boxes,this.director.rules);if(n.visibility&&!this.witnessed.has(n.id)){this.witnessed.add(n.id);this.director.accuse(n,p);}}}
 private kill(n:Npc,method:string,p:PlayerView){if(!n.active)return;const judgement=judgeKill(this.director,p,this.cameras,this.shownIllegal,[n.id],method==='push');markDead(n,method,judgement);this.kills.push({victim:n.id,method,time:this.clock.elapsed,position:{...n.pos},judgement});this.m3.stats.kills++;this.notices.push(`${n.label}を排除 · ${judgement.kind==='accident'?'事故':'殺人'}：${judgement.reasons.join('／')}`);}
 private accident(body:Npc,witness:Npc){this.cordons.push({position:{...body.pos},until:this.clock.elapsed+this.rules.cordonSeconds,victim:body.id});this.reactionText=`${witness.label}「事故だ！ 近づかないで！」`;this.reactionUntil=this.clock.elapsed+this.rules.talkSeconds;
  for(const n of this.director.npcs){if(!n.active||n.busy||['alert','search','report'].includes(n.state)||Math.abs(n.pos.y-body.pos.y)>.5||distance(n.pos,body.pos)>this.rules.reactionRadius)continue;const angle=Math.atan2(n.pos.x-body.pos.x,n.pos.z-body.pos.z),target={x:body.pos.x+Math.sin(angle)*this.rules.cordonRadius,y:body.pos.y,z:body.pos.z+Math.cos(angle)*this.rules.cordonRadius};const nearest=this.director.nav.nearest(target);if(nearest<0)continue;const node=this.director.nav.nodes[nearest];n.state='distracted';n.goal={x:node.x,y:node.y,z:node.z};n.arrived=false;n.timer=this.rules.cordonSeconds;}
 }
 snapshot(){return {poison:this.poison,cellarKey:this.cellarKey,shownIllegal:this.shownIllegal,barrel:this.barrel,invited:this.invited,action:this.action?{kind:this.action.kind,progress:this.progress}:null,chances:this.chances.snapshot(this.clock.time,this.clock.rules.loop),kills:this.kills.map(k=>({...k,position:{...k.position},judgement:{...k.judgement}})),cordons:this.cordons.filter(c=>c.until>this.clock.elapsed).map(c=>({...c,remaining:c.until-this.clock.elapsed}))};}
}
