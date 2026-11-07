import type {Director,Npc,PlayerView} from '../ai.ts';
import type {M3System} from '../m3.ts';
import type {M4System} from '../m4.ts';
import type {MissionClock} from '../schedule.ts';
import type {MissionEvents} from '../events.ts';
import type {DetectionSystem} from '../detection.ts';
import {Chances,type ChancesData} from '../chances.ts';
import {judgeKill,markDead,type KillRecord} from '../kills.ts';
import {segmentClear} from '../sight.ts';
import type {Position} from '../world.ts';
import config from '../data/party-actions.json' with {type:'json'};
export class PartyChances{
 readonly director:Director;readonly m3:M3System;readonly m4:M4System;readonly clock:MissionClock;readonly events:MissionEvents;readonly chances:Chances;
 readonly flags=new Set<string>();readonly kills:KillRecord[]=[];private deaths=new Set<string>();private released=true;private lastDisguise='';private paperOverride=false;
 action:{id:string;elapsed:number;duration:number;start:Position;npc?:Npc}|null=null;poison=1;notices:string[]=[];reactionText='';reactionUntil=0;detection:DetectionSystem|null=null;illegal=()=>false;
 constructor(d:Director,m3:M3System,m4:M4System,c:MissionClock,e:MissionEvents,data:ChancesData){this.director=d;this.m3=m3;this.m4=m4;this.clock=c;this.events=e;this.chances=new Chances(data,e);for(const cl of config.clothes)m4.clothes.push(structuredClone(cl));m4.extraInventory=()=>this.poison?['poison_lethal']:[];e.on(event=>{if(event.type!=='dialogue.heard'||!event.id?.includes('_'))return;const base=event.id.split('_')[0];if(data[base]&&this.chances.states.get(base)?.status==='undiscovered')e.emit({...event,id:base});});}
 bindDetection(d:DetectionSystem){this.detection=d;}
 get locked(){return !!this.action;}get tampering(){return !!this.action;}get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 isRestricted(_p:Position){return false;}
 near(a:Position,b:Position,r=config.radius){return Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y)<r&&segmentClear(this.director.boxes,{...a,y:a.y+1.1},{...b,y:b.y+1.1});}
 inWindow(id:keyof typeof config.windows){return config.windows[id].some(([a,b])=>this.clock.time>=a&&this.clock.time<b);}
 available(p:PlayerView){return config.acts.find(a=>this.near(p,a.at)&&!this.flags.has(a.id)&&(a.id!=='chandelier'||this.detection?.held==='wrench')&&(a.id!=='release'||this.flags.has('chandelier'))&&(a.id!=='push'||this.flags.has('papers')&&this.inWindow('papers')&&this.director.npcs.some(n=>n.id==='host'&&n.active&&n.state==='patrol'&&!n.scheduleTarget&&this.near(n.pos,config.paperGoal,config.pushRadius)))&&(a.id!=='drink'||this.poison>0));}
 prompt(p:PlayerView,_heading=0){const a=this.action,spot=this.available(p);if(a)return {text:'E 仕掛けを操作中…',progress:this.progress};if(spot)return {text:'E 長押し '+spot.label,progress:0};const near=config.acts.find(a=>!this.flags.has(a.id)&&this.near(p,a.at));if(!near)return null;return {text:near.id==='chandelier'?'スパナを手に持つ必要がある':near.id==='drink'?'致死毒がない。地下のワイン庫で探す':near.id==='push'?(this.clock.time<740?'主人が窓辺へ来るのは11分30秒〜12分20秒':'次の窓辺の確認は27分〜27分40秒'):'先に吊り具を緩める',progress:0};}
 step(dt:number,p:PlayerView,_heading:number,keys:Set<string>,suppressed=false){this.notices=[];if(!keys.has('KeyE'))this.released=true;
 if(this.lastDisguise!==this.m4.disguise){this.lastDisguise=this.m4.disguise;this.events.emit({type:'disguise.changed',time:this.clock.elapsed,id:this.m4.disguise});}
 if(this.action){const a=this.action;if(suppressed||!keys.has('KeyE')||!this.near(p,a.start)||this.available(p)?.id!==a.id){this.action=null;return true;}a.elapsed+=dt;if(a.elapsed>=a.duration){this.complete(a.id,p);this.action=null;this.released=false;}return true;}
 const spot=this.available(p);if(!suppressed&&this.released&&keys.has('KeyE')&&spot){this.action={id:spot.id,elapsed:0,duration:config.durations[spot.id as keyof typeof config.durations],start:{x:p.x,y:p.y,z:p.z}};return true;}return false;}
 private complete(id:string,p:PlayerView){this.flags.add(id);this.events.emit({type:'flag.set',time:this.clock.elapsed,id});
 const host=this.director.npcs.find(n=>n.id==='host')!;
 if(id==='papers')this.notices.push('書類を窓辺へ移した。11分30秒か27分の主人を待つ。');
 if(id==='drink')this.poison--;
 if(id==='release')for(const n of this.director.npcs)if(n.active&&this.near(n.pos,config.chandelierArea,config.targetRadius))this.kill(n,'party_chandelier',p,true);
 if(id==='push'&&host.active&&this.near(host.pos,config.paperGoal,config.pushRadius)){this.kill(host,'party_push',p,true);host.fallOrigin={...host.pos};host.pos={...config.fall};}
 }
 private kill(n:Npc,method:string,p:PlayerView,exposed:boolean){const j=judgeKill(this.director,p,this.detection?.workingCameras??[],this.illegal(),[n.id],exposed);for(const id of j.cameras){const c=this.detection?.cameras.find(c=>c.id===id);if(c)this.detection!.record(c,'仕掛けの作動',p,this.clock.elapsed);}for(const id of j.witnesses){const w=this.director.npcs.find(n=>n.id===id)!;this.director.onSpotted?.(w);}markDead(n,method,j);this.kills.push({victim:n.id,method,time:this.clock.elapsed,position:{...n.pos},judgement:j});}
 afterAi(p:PlayerView){if(this.detection?.held==='poison_lethal'){this.detection.held='';this.poison++;this.notices.push('致死毒を1本しまった。');}
 const host=this.director.npcs.find(n=>n.id==='host')!;
 if(this.flags.has('papers')&&host.active&&this.inWindow('paperApproach')){host.scriptedGoal={...config.paperGoal};host.scriptedAction='read';host.scriptedHeading=Math.PI;this.paperOverride=true;}
 else if(this.paperOverride){host.scriptedGoal=null;host.scriptedAction='';host.scriptedHeading=null;this.paperOverride=false;}
 if(this.flags.has('drink')&&this.inWindow('drink')&&host.active&&host.state==='patrol'&&!host.scheduleTarget&&host.scheduleAction==='drink'&&this.near(host.pos,config.drinkAt,config.targetRadius))this.kill(host,'party_poison',p,false);
 for(const n of this.director.npcs)if(n.life==='dead'&&!this.deaths.has(n.id)){this.deaths.add(n.id);this.events.emit({type:'npc.killed',time:this.clock.elapsed,id:n.id,method:n.deathMethod,judgement:n.deathKind});}}
 chanceSnapshot(){const time=this.clock.time,loop=this.clock.rules.loop;return this.chances.snapshot(time,loop).map(state=>{const windows=config.windows[state.id as 'chandelier'|'papers'|'drink'],next=windows.find(([,end])=>time<end)??windows[0],wait=time>=windows[windows.length-1][1]?loop-time+next[0]:Math.max(0,next[0]-time),label=`${Math.floor(next[0]/60)}分${next[0]%60?next[0]%60+'秒':''}`;return {...state,window:[...next],waitSeconds:wait,step:state.status==='active'?state.step+`（次の時刻 ${label}）`:state.step};});}
 snapshot(){return {flags:[...this.flags],kills:this.kills,poison:this.poison,action:this.action};}
}


