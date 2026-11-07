import {permission,type Director,type Npc,type PlayerView} from './ai.ts';
import type {Position} from './world.ts';
import {segmentClear} from './sight.ts';
export type Checkpoint={id:string;label:string;x:number;y:number;z:number;normal:{x:number;z:number};width:number;zone:string;guardId:string};
// legality: illegal | suspicious | normal (items.json).
export type Item={legality:string;concealable:boolean;friskDetect?:boolean;allowedFor?:string[]};
export type M4Rules={changeSeconds:number;friskSeconds:number;friskValidSeconds:number;guardRadius:number;lootRadius:number;compromisedClearDistance:number;roleDisguise:Record<string,string>;uniformModels:Record<string,string>;uniformHides?:Record<string,string[]>;undressed?:{default:string;byModel:Record<string,string|null>};items:Record<string,Item>};
export type Clothes={id:string;disguise:string;pos:Position;npc?:Npc};
export type M4Action={id:number;kind:'change'|'frisk';elapsed:number;duration:number;start:Position;source?:Clothes;checkpoint?:Checkpoint;guard?:Npc};
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export class M4System{
 extraInventory?:()=>string[];
 disguise='suit';hasWire=true;elapsed=0;action:M4Action|null=null;notices:string[]=[];revision=0;private nextId=0;private held=new Set<string>();private witnesses=new Set<string>();
 readonly taken=new Set<string>();readonly clothes:Clothes[]=[];readonly stashes:{id:number;pos:Position}[]=[];readonly passes=new Map<string,{until:number;disguise:string;wire:boolean}>();
 // Where the agent last stood unseen after taking off each compromised outfit.
 readonly anchors=new Map<string,Position>();
 stats={changes:0,frisks:0,found:0,changeWitnesses:0,cleared:0};
 readonly director:Director;readonly checkpoints:Checkpoint[];readonly rules:M4Rules;
 constructor(director:Director,checkpoints:Checkpoint[],rules:M4Rules){this.director=director;this.checkpoints=checkpoints;this.rules=rules;}
 get locked(){return !!this.action;}
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 get label(){return this.director.rules.disguises[this.disguise]?.label??this.disguise;}
 get compromised(){return this.director.compromised.has(this.disguise);}
 inventory(){return [...(this.hasWire?['wire']:[]),...(this.extraInventory?.()??[])];}
 // Illegal items a frisk turns up. Nothing is taken away; the wire is never found.
 friskFinds(){return this.inventory().filter(id=>{const it=this.rules.items[id];return it?.legality==='illegal'&&it.friskDetect!==false;});}
 private clear(a:Position,b:Position){return Math.abs(a.y-b.y)<.35&&segmentClear(this.director.boxes,{...a,y:a.y+.6},{...b,y:b.y+.35});}
 source(p:Position){const bodies=this.director.npcs.filter(n=>n.life!=='active'&&n.bodyMode==='ground'&&n.fall>=1&&!this.taken.has(n.id)&&!n.reinforcement).map(n=>({id:n.id,disguise:n.outfit??this.rules.roleDisguise[n.role]??'suit',pos:n.pos,npc:n}));return [...bodies,...this.clothes].filter(c=>c.disguise!==this.disguise&&distance(c.pos,p)<this.rules.lootRadius&&this.clear(p,c.pos)).sort((a,b)=>distance(a.pos,p)-distance(b.pos,p))[0];}
 checkpoint(p:Position){return this.checkpoints.find(c=>Math.abs(p.y-c.y)<.35&&distance(c,p)<1.65);}
 attendant(c:Checkpoint){return this.director.npcs.find(n=>n.id===c.guardId&&n.active&&(!n.busy||n===this.action?.guard)&&['patrol','curious'].includes(n.state)&&Math.abs(n.pos.y-c.y)<.35&&distance(n.pos,c)<this.rules.guardRadius);}
 allowed(c:Checkpoint){return permission(this.director.rules,this.disguise,{id:c.id,label:c.label,floor:0,type:c.zone,minX:0,maxX:0,minZ:0,maxZ:0})!=='deny';}
 passed(c:Checkpoint){const pass=this.passes.get(c.id);return !!pass&&pass.until>this.elapsed&&pass.disguise===this.disguise&&pass.wire===this.hasWire;}
 wireStash(p:Position){return this.stashes.find(s=>distance(s.pos,p)<1.25&&this.clear(p,s.pos));}
 prompt(p:Position){if(this.action)return {text:this.action.kind==='change'?'T 着替えている…':'B 身体検査中…',progress:this.progress};
  const c=this.checkpoint(p);if(c&&this.attendant(c)&&!this.passed(c))return {text:this.allowed(c)?`B 長押し ${c.label}`:'この服では入れない。Tで制服を入手する。',progress:0};
  const source=this.source(p);if(source)return {text:`T 長押し ${this.director.rules.disguises[source.disguise]?.label??source.disguise}に着替える`,progress:0};
  if(this.wireStash(p)&&!this.hasWire)return {text:'H 預けたワイヤーを回収する',progress:0};return null;}
 cancel(){if(this.action?.guard)this.action.guard.busy=false;this.action=null;}
 step(dt:number,p:PlayerView,heading:number,keys:Set<string>,suppressed=false){this.elapsed+=dt;this.notices=[];const fresh=(k:string)=>!suppressed&&keys.has(k)&&!this.held.has(k),moving=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k));
  if(this.action){const a=this.action,key=a.kind==='change'?'KeyT':'KeyB';
   if(suppressed||!keys.has(key)||moving||distance(a.start,p)>.15||Math.abs(p.y-a.start.y)>.2||a.kind==='frisk'&&(!a.guard?.active||a.guard.state==='alert'||distance(a.guard.pos,p)>this.rules.guardRadius)||a.source?.npc&&(a.source.npc.active||a.source.npc.bodyMode!=='ground'))this.cancel();
   else{a.elapsed+=dt;if(a.kind==='change')this.witnessChange(p,a);if(a.elapsed>=a.duration){this.complete(a,p);this.cancel();}}}
  else if(fresh('KeyT')&&!moving){const source=this.source(p);if(source)this.action={id:++this.nextId,kind:'change',elapsed:0,duration:this.rules.changeSeconds,start:{...p},source};else this.notices.push('近くの倒れた人か、置いた服から着替えられます。');}
  else if(fresh('KeyB')&&!moving){const c=this.checkpoint(p),guard=c&&this.attendant(c);if(!c||!guard)this.notices.push('検査担当の警備員が近くにいません。');else if(distance(guard.pos,p)>1.65)this.notices.push('検査担当の警備員へもう少し近づいてください。');else if(!this.allowed(c))this.notices.push('今の服ではこの区画へ入れません。');else if(this.passed(c))this.notices.push('検査は済んでいます。');else{this.action={id:++this.nextId,kind:'frisk',elapsed:0,duration:this.rules.friskSeconds,start:{...p},checkpoint:c,guard};guard.busy=true;guard.speed=0;guard.heading=Math.atan2(p.x-guard.pos.x,p.z-guard.pos.z);}}
  else if(fresh('KeyH')){if(this.hasWire){const pos=this.director.world.move(p,Math.sin(heading)*.35,Math.cos(heading)*.35);this.stashes.push({id:++this.nextId,pos});this.hasWire=false;this.notices.push('ワイヤーを置いた。Hで回収できます。');}else{const stash=this.wireStash(p);if(stash){this.stashes.splice(this.stashes.indexOf(stash),1);this.hasWire=true;this.notices.push('ワイヤーを回収した。');}else this.notices.push('回収できるワイヤーが近くにありません。');}this.passes.clear();}
  this.releaseCompromised(p);
  this.held=new Set(keys);}
 // A blown outfit stays blown, even if another copy is picked up, until the agent has changed out of it and walked clearDistance unseen.
 private releaseCompromised(p:PlayerView){const seen=this.director.npcs.some(n=>n.active&&n.visibility>0);
  for(const d of [...this.director.compromised]){if(d===this.disguise){this.anchors.delete(d);continue;}const at=this.anchors.get(d);
   if(!at||seen){this.anchors.set(d,{x:p.x,y:p.y,z:p.z});continue;}
   if(distance(at,p)>=this.rules.compromisedClearDistance){this.director.compromised.delete(d);this.anchors.delete(d);this.stats.cleared++;this.notices.push(`${this.director.rules.disguises[d]?.label??d}の服は、もう警戒されていない。`);}}}
 private witnessChange(p:PlayerView,a:M4Action){for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive({...p,disguise:this.disguise},this.director.boxes,this.director.rules);if(!n.visibility)continue;const id=a.id+':'+n.id;if(this.witnesses.has(id))continue;this.witnesses.add(id);this.stats.changeWitnesses++;n.knownDisguises.add(a.source!.disguise);this.director.accuse(n,{...p,disguise:this.disguise});this.notices.push(`${n.label}に着替えを見られた！`);}}
 private complete(a:M4Action,p:PlayerView){if(a.kind==='frisk'){const found=this.friskFinds();this.stats.frisks++;
   if(found.length&&a.guard){this.stats.found++;this.director.accuse(a.guard,{...p,disguise:this.disguise});this.notices.push('検査で違法な物が見つかった！');return;}
   this.notices.push(this.hasWire?'検査を通過した。ワイヤーは見つからなかった。':'検査を通過した。');this.passes.set(a.checkpoint!.id,{until:this.elapsed+this.rules.friskValidSeconds,disguise:this.disguise,wire:this.hasWire});return;}
  const source=a.source!;if(source.npc)this.taken.add(source.npc.id);else{const i=this.clothes.findIndex(c=>c.id===source.id);if(i<0)return;this.clothes.splice(i,1);}
  this.clothes.push({id:'clothes-'+(++this.nextId),disguise:this.disguise,pos:{...p}});this.disguise=source.disguise;this.revision++;this.stats.changes++;this.passes.clear();this.notices.push(`${this.label}に着替えた。`);}
 constrain(from:Position,to:Position){for(const c of this.checkpoints){if(!this.attendant(c)||this.passed(c)||Math.abs(to.y-c.y)>.35)continue;const n=c.normal,a=(from.x-c.x)*n.x+(from.z-c.z)*n.z,b=(to.x-c.x)*n.x+(to.z-c.z)*n.z;
   if(a>=0&&b<0){const t=a/(a-b),x=from.x+(to.x-from.x)*t-c.x,z=from.z+(to.z-from.z)*t-c.z;if(Math.abs(-x*n.z+z*n.x)<c.width/2+.27)return from;}}
  return to;}
}
