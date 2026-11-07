import type { Director, PlayerView } from '../ai.ts';
import { segmentClear } from '../sight.ts';
import type { Position } from '../world.ts';

type Point = { x:number; z:number; heading:number; phase:number; speed:number; height:number; pose:string; seat:boolean };
export type CrowdPlace = { id:string; zone:string; x:number; z:number; width:number; depth:number; floor:number; count:number; pose:string; points:Point[] };
export type CrowdData = {
 places:CrowdPlace[]; ghostWitness:boolean; hear:number; see:number; calm:number; guardHear:number;
 sight:{touch:number;frontDot:number;floorTolerance:number};
 occlusion:{density:number;depth:number;bottom:number;top:number};
 blend:{radius:number;people:number};
};
export type Extra = Point & { home:Point; place:CrowdPlace; y:number; crouch:boolean };
type Cluster = { place:CrowdPlace; people:Extra[]; until:number; started:number; origin:Position|null };
type Reaction = (id:string,action:string,reason:string,sense:'sight'|'sound',distance:number,at:Position)=>void;
const distance=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

export class ClubCrowd {
 readonly clusters:Cluster[];
 readonly people:Extra[];
 changed=false;
 floorSightScale=1;
 reaction?:Reaction;
 // A cluster screamed (the VIP lockdown listens: config.vip.lockdown.screamRadius).
 onPanic?:(at:Position,time:number)=>void;
 witnessed?: (id:string)=>void;
 private next=0;
 private readonly director:Director;
 readonly data:CrowdData;
 constructor(director:Director,data:CrowdData,multiplier:number){
  this.director=director;this.data=data;
  this.clusters=data.places.map(place=>({place,until:0,started:0,origin:null,
   people:place.points.slice(0,place.count*multiplier).map(home=>({...home,home,place,y:place.floor*3.5,crouch:false}))}));
  this.people=this.clusters.flatMap(c=>c.people);
 }
 private sees(person:Extra,p:PlayerView){
  const x=p.x-person.x,z=p.z-person.z,d=Math.hypot(x,z);
  const {touch,frontDot,floorTolerance}=this.data.sight;
  return Math.abs(p.y-person.y)<floorTolerance&&d<=this.data.see*(person.place.zone==='C'?this.floorSightScale:1)&&
   (d<touch||x*Math.sin(person.heading)+z*Math.cos(person.heading)>=d*frontDot)&&
   segmentClear(this.director.boxes,{...person,y:person.y+(person.crouch?.88:1.57)},{...p,y:p.y+(p.crouched?.82:1.3)});
 }
 sight(p:PlayerView){
  const places:string[]=[];let visible=0;
  for(const c of this.clusters){
   const n=c.people.reduce((sum,person)=>sum+Number(this.sees(person,p)),0);
   if(n){places.push(c.place.id);visible+=n;}
  }
  return {visible,places};
 }
 blends(p:Position){
  const {radius,people}=this.data.blend;
  return this.clusters.some(c=>!c.origin&&Math.abs(p.y-c.place.floor*3.5)<.5&&
   c.people.filter(n=>Math.abs(n.x-p.x)<radius&&Math.abs(n.z-p.z)<radius&&Math.hypot(n.x-p.x,n.z-p.z)<radius).length>=people);
 }
 occludes=(a:Position,b:Position)=>{
  const length=Math.hypot(b.x-a.x,b.z-a.z);
  const {density,depth,bottom,top}=this.data.occlusion;
  if(length<=depth)return;
  const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);
  const y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
  for(const c of this.clusters){
   const p=c.place,y=p.floor*3.5;
   if(c.origin||c.people.length/(p.width*p.depth)<density||y0>y+top||y1<y+bottom)continue;
   const left=p.x-p.width/2,right=p.x+p.width/2,front=p.z-p.depth/2,back=p.z+p.depth/2;
   if(x1<left||x0>right||z1<front||z0>back)continue;
   let low=0,high=1;
   for(const [s,t,min,max] of [[a.x,b.x,left,right],[a.z,b.z,front,back],[a.y,b.y,y+bottom,y+top]]){
    if(Math.abs(t-s)<1e-6){if(s<min||s>max){high=-1;break;}continue;}
    const u=(min-s)/(t-s),v=(max-s)/(t-s);
    low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));
   }
   if((high-low)*length>depth)return p.id;
  }
 };
 private scare(c:Cluster,at:Position,time:number,reason:string,sense:'sight'|'sound',d:number){
  if(c.origin)return;
  c.origin={...at};c.started=time;c.until=time+this.data.calm;
  const p=c.place,noise={x:p.x,y:p.floor*3.5,z:p.z};
  this.reaction?.(p.id,'scream',reason,sense,d,at);
  this.reaction?.(p.id,'flee',reason,sense,d,at);
  this.onPanic?.(noise,time);
  const guards=this.director.npcs.filter(n=>n.active&&!n.busy&&n.guard&&n.state==='patrol'&&n.securityRole!=='escort'&&n.id!=='gate_frisk')
   .map(n=>({n,d:distance(n.pos,noise)})).filter(({n,d})=>d<=this.data.guardHear&&Math.abs(n.pos.y-noise.y)<1.5)
   .sort((a,b)=>a.d-b.d);
  const g=guards.find(({n,d})=>d<this.data.guardHear*.45||segmentClear(this.director.boxes,{...n.pos,y:n.pos.y+1.5},{...noise,y:noise.y+1.4}));
  if(g){
   g.n.radio(noise,this.director.rules,{eventType:'report',estimatedOrigin:noise,confirmedActor:false,confidence:.5,observedAt:time});
   this.reaction?.(g.n.id,'investigate','crowd_scream','sound',g.d,noise);
  }
 }
 gunshot(at:Position,time:number,kind:'small'|'loud'){
  const range=this.data.hear*(kind==='small'?.6:1);
  for(const c of this.clusters){
   const n=c.people.find(n=>{
    const d=distance(n,at);
    return d<=range&&(d<range*.38||segmentClear(this.director.boxes,{...n,y:n.y+1.5},{...at,y:at.y+1.4}));
   });
   if(n)this.scare(c,at,time,'gunshot','sound',distance(n,at));
  }
 }
 violence(p:PlayerView,time:number,reason:'kill'|'gun_drawn'){
  for(const c of this.clusters){
   const n=c.people.find(n=>this.sees(n,p));
   if(!n)continue;
   if(reason==='kill'&&this.data.ghostWitness)this.witnessed?.(c.place.id);
   this.scare(c,p,time,reason,'sight',distance(n,p));
  }
 }
 // Dancers step aside for anyone walking through (the target and their escort above all), then drift back: up to
 // 0.9 m away from a walker within 1.2 m (2026-11-03: the investor walked through people to the stage).
 private makeWay(){
  const walkers=this.director.npcs.filter(n=>n.active&&!n.busy&&n.speed>.1);
  for(const c of this.clusters){
   if(c.origin)continue;
   const y=c.place.floor*3.5,near=walkers.filter(w=>Math.abs(w.pos.y-y)<1&&Math.abs(w.pos.x-c.place.x)<c.place.width/2+1.5&&Math.abs(w.pos.z-c.place.z)<c.place.depth/2+1.5);
   for(const n of c.people){
    let ox=0,oz=0;
    for(const w of near){const dx=n.home.x-w.pos.x,dz=n.home.z-w.pos.z,d=Math.hypot(dx,dz);if(d<1.2&&d>1e-3){ox+=dx/d*(1.2-d);oz+=dz/d*(1.2-d);}}
    const k=Math.hypot(ox,oz);if(k>.9){ox*=.9/k;oz*=.9/k;}
    const tx=n.home.x+ox,tz=n.home.z+oz,dx=tx-n.x,dz=tz-n.z,d=Math.hypot(dx,dz);
    if(d<.01)continue;
    const step=Math.min(d,k?.16:.06),x=n.x+dx/d*step,z=n.z+dz/d*step;
    if(this.director.world.blocked(x,n.y,z,1.1))continue;
    n.x=x;n.z=z;this.changed=true;
   }
  }
 }
 // The target falls: dancers within reach stop facing the stage and turn to look (not a panic; nobody is blamed).
 private look:{until:number}|null=null;
 gasp(at:Position,time:number,seconds=45){
  for(const c of this.clusters){
   const p=c.place,d=Math.hypot(Math.max(0,Math.abs(at.x-p.x)-p.width/2),Math.max(0,Math.abs(at.z-p.z)-p.depth/2));
   if(c.origin||d>14||Math.abs(at.y-p.floor*3.5)>1.5||!c.people.some(n=>this.sees(n,{...at,floor:p.floor,disguise:'',speed:0,running:false,crouched:false,tampering:false})))continue;
   for(const n of c.people)n.heading=Math.atan2(at.x-n.x,at.z-n.z);
   this.changed=true;
   this.reaction?.(p.id,'gasp','target_down','sight',d,at);
  }
  this.look={until:time+seconds};
 }
 step(time:number,p:PlayerView){
  if(!this.people.length||time<this.next)return;
  this.next=time+.1;
  if(this.look&&time>=this.look.until){for(const n of this.people)n.heading=n.home.heading;this.look=null;this.changed=true;}
  if(p.weaponDrawn)this.violence(p,time,'gun_drawn');
  this.makeWay();
  for(const c of this.clusters){
   if(!c.origin)continue;
   for(const n of c.people){
    const flee=time-c.started<1.45;
    const returning=time>=c.until;
    const dx=flee?n.x-c.origin.x:n.home.x-n.x,dz=flee?n.z-c.origin.z:n.home.z-n.z;
    const d=Math.hypot(dx,dz),pace=Math.min(d,flee?.13:.17);
    if(n.crouch===returning){n.crouch=!returning;this.changed=true;}
    if((flee||returning)&&d>1e-5){
     const q=this.director.world.move(n,dx/d*pace,dz/d*pace,1.1);
     if((n.x!==q.x||n.z!==q.z)&&this.director.zone({...p,...q,floor:c.place.floor})?.type==='public'){
      n.x=q.x;n.z=q.z;this.changed=true;
     }
    }
   }
   if(time>=c.until+2){c.origin=null;for(const n of c.people){n.x=n.home.x;n.z=n.home.z;n.crouch=false;}this.changed=true;}
  }
 }
}
