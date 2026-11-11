import {bounds,RADIUS,type Block,type CollisionWorld,type Position} from './world.ts';
import type {NavGrid} from './nav.ts';
import {invalidateSight,segmentClear,type Aabb} from './sight.ts';

export type DoorDef=Block&{label:string;startsClosed?:boolean;key?:string;pryable?:boolean;guardAccess?:boolean};
export type DoorState={def:DoorDef;closed:boolean;locked:boolean;box:Aabb};

export type GuardDoorRoute={door:DoorState;approach:Position;path:Position[]};

export class DoorSystem{
 readonly doors:DoorState[];
 private readonly world:CollisionWorld;
 private readonly boxes:Aabb[];
 private readonly soundBoxes:Aabb[]=[];
 private readonly guardClosures=new Map<DoorState,{remaining:number;relock:boolean}>();
 constructor(world:CollisionWorld,boxes:Aabb[],defs:readonly DoorDef[]){
  this.world=world;this.boxes=boxes;
  this.doors=defs.map(def=>({def,closed:false,locked:!!def.key,box:{...bounds(def),minY:def.y,maxY:def.y+def.h}}));
  this.reset();
 }
 reset(){this.guardClosures.clear();for(const door of this.doors){door.locked=!!door.def.key;this.setClosed(door,door.locked||!!door.def.startsClosed);}}
 near(p:Position){
  return this.doors.find(({def,box})=>Math.abs(p.y-def.y)<.4&&Math.hypot(p.x-def.x,p.z-def.z)<1.35&&
   // Keep the endpoint on the player's side of the door so the leaf itself does not block its interaction.
   segmentClear(this.boxes,{...p,y:p.y+1},{x:def.w<def.d?(p.x<def.x?box.minX-.02:box.maxX+.02):def.x,
    y:def.y+1,z:def.w<def.d?def.z:(p.z<def.z?box.minZ-.02:box.maxZ+.02)}));
 }
 /** Try an operable door when the ordinary walking grid cannot reach the destination. */
 guardRoute(nav:NavGrid,from:Position,to:Position):GuardDoorRoute|null{
  const route=(a:Position,b:Position)=>{
   if(nav.clear(a,b))return [b];
   const path=nav.find(a,b),end=path?.at(-1);
   return path&&end&&nav.clear(end,b)?[...path,b]:null;
  };
  for(const door of this.doors){
   if(!this.guardCanOpen(door))continue;
   const {x,y,z,w,d}=door.def;
   const offset=Math.min(w,d)/2+RADIUS+.18;
   const dx=w<d?offset:0,dz=w<d?0:offset;
   for(const side of [1,-1]){
    const approach={x:x+dx*side,y,z:z+dz*side},exit={x:x-dx*side,y,z:z-dz*side};
    const path=route(from,approach);
    if(path&&route(exit,to))return {door,approach,path};
   }
  }
  return null;
 }
 openForGuard(door:DoorState,at:Position){
  if(!this.guardCanOpen(door)||Math.abs(at.y-door.def.y)>.35
   ||Math.hypot(at.x-door.def.x,at.z-door.def.z)>1.35)return false;
  this.guardClosures.set(door,{remaining:2,relock:door.locked});
  door.locked=false;
  this.setClosed(door,false);
  return true;
 }
 get hasPendingClosure(){return this.guardClosures.size>0;}
 step(dt:number,occupants:readonly Position[]){
  for(const [door,close] of this.guardClosures){
   close.remaining-=dt;
   if(close.remaining>0||occupants.some(p=>this.blocks(door,p)))continue;
   door.locked=close.relock;
   this.setClosed(door,true);
  }
 }
 private guardCanOpen(door:DoorState){return door.closed&&(!door.locked||door.def.guardAccess===true);}
 soundClear(at:Position,listener:Position){
  return this.soundBoxes.length===0||segmentClear(this.soundBoxes,{...at,y:at.y+1},{...listener,y:listener.y+1});
 }
 action(door:DoorState,held:string,inventory:readonly string[]){
  const {def,locked,closed}=door;
  if(!locked)return closed?'開ける':'閉める';
  if(inventory.includes(def.key!))return '鍵で開ける';
  if(def.pryable&&held==='crowbar')return 'バールでこじ開ける';
  return '';
 }
 use(door:DoorState,held:string,inventory:readonly string[],occupants:readonly Position[]){
  const action=this.action(door,held,inventory);
  if(!action)return {opened:false,message:'鍵がかかっている。'};
  if(!door.closed&&occupants.some(p=>this.blocks(door,p)))return {opened:false,message:'扉の前がふさがっている。'};
  door.locked=this.guardClosures.get(door)?.relock??false;
  this.setClosed(door,!door.closed);
  return {opened:!door.closed,message:door.def.label+'を'+(door.closed?'閉めた。':action==='バールでこじ開ける'?'こじ開けた。':'開けた。')};
 }
 private blocks({box}:DoorState,p:Position){
  const x=p.x-Math.max(box.minX,Math.min(box.maxX,p.x)),z=p.z-Math.max(box.minZ,Math.min(box.maxZ,p.z));
  return p.y<box.maxY&&p.y+1.3>box.minY&&x*x+z*z<RADIUS*RADIUS;
 }
 private setClosed(door:DoorState,closed:boolean){
  if(door.closed===closed)return;
  door.closed=closed;
  if(closed)this.guardClosures.delete(door);
  this.world.setDynamic(door.def,closed);
  for(const boxes of [this.boxes,this.soundBoxes]){
   if(closed)boxes.push(door.box);
   else boxes.splice(boxes.indexOf(door.box),1);
   invalidateSight(boxes);
  }
 }
}
