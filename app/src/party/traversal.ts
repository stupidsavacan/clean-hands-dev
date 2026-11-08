import type {Director,PlayerView} from '../ai.ts';
import type {Position} from '../world.ts';
export type Traversal={id:string;a:string;b:string;kind:string;start:Position;end:Position;seconds:number;via?:Position[]};
const RUNG=.3;
const lift=(u:number)=>Math.min(1,Math.max(0,Math.sin(u*Math.PI*2)*1.4));

export class PartyTraversal{
 action:{link:Traversal;from:Position;to:Position;elapsed:number;reverse:boolean}|null=null;
 private release=false; transfer:Position|null=null;notices:string[]=[];
 readonly director:Director;readonly links:Traversal[];readonly rules:{radius:number;suspicionPerSecond:number};
 constructor(d:Director,links:Traversal[],rules:{radius:number;suspicionPerSecond:number}){this.director=d;this.links=links;this.rules=rules;}
 get locked(){return !!this.action;}get tampering(){return !!this.action;}get progress(){return this.action?this.action.elapsed/this.action.link.seconds:0;}
 near(p:Position,q:Position){return Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y)<=this.rules.radius;}
 candidate(p:Position){for(const link of this.links){if(this.near(p,link.start))return {link,reverse:false};if(this.near(p,link.end))return {link,reverse:true};}return null;}
 prompt(p:Position){const a=this.action,c=this.candidate(p);return a?{text:'E 長押し 移動中。離すと元へ戻る',progress:this.progress}:c?{text:`E 長押し ${c.link.kind==='window'?'窓':c.link.kind==='ladder'?'はしご':c.link.kind==='drainpipe'?'雨どい':'外の縁'}を使う`,progress:0}:null;}
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){this.notices=[];if(!keys.has('KeyE'))this.release=false;
 if(this.action){const a=this.action;if(!keys.has('KeyE')||suppressed){this.transfer={...a.from};this.action=null;this.release=true;return true;}
 a.elapsed=Math.min(a.link.seconds,a.elapsed+dt);const points=[a.reverse?a.link.end:a.link.start,...(a.reverse?[...(a.link.via??[])].reverse():a.link.via??[]),a.to];const t=this.progress*(points.length-1),i=Math.min(points.length-2,Math.floor(t)),k=t-i;this.transfer={x:points[i].x+(points[i+1].x-points[i].x)*k,y:points[i].y+(points[i+1].y-points[i].y)*k,z:points[i].z+(points[i+1].z-points[i].z)*k};
 const seen={...p,...this.transfer};for(const n of this.director.npcs){if(!n.active||n.busy)continue;n.perceive(seen,this.director.boxes,this.director.rules);if(n.visibility>0)n.suspicion=Math.min(100,n.suspicion+dt*this.rules.suspicionPerSecond*n.visibility);}
 if(a.elapsed>=a.link.seconds){this.transfer={...a.to};this.action=null;this.release=true;}return true;}
 if(suppressed||this.release||!keys.has('KeyE'))return false;const c=this.candidate(p);if(!c)return false;this.action={...c,from:{x:p.x,y:p.y,z:p.z},to:{...(c.reverse?c.link.start:c.link.end)},elapsed:0};return true;}
 frame(p:Position){
  const a=this.action;if(!a)return;
  const points=[a.reverse?a.link.end:a.link.start,...(a.reverse?[...(a.link.via??[])].reverse():a.link.via??[]),a.to];
  const n=points.length-1,i=Math.min(n-1,Math.floor(this.progress*n)),from=points[i],to=points[i+1];
  const flat=Math.hypot(to.x-from.x,to.z-from.z),climb=Math.abs(to.y-from.y)>.5,vault=a.link.kind==='window';
  const heading=climb&&flat<.2?0:vault?Math.atan2(points[n].x-points[0].x,points[n].z-points[0].z):Math.atan2(to.x-from.x,to.z-from.z);
  const s=Math.sin(heading),c=Math.cos(heading);
  const at=(x:number,y:number,z:number,origin=p):Position=>({x:origin.x+x*c+z*s,y:origin.y+y,z:origin.z-x*s+z*c});
  if(vault){
   const v=a.link.via??[],sill=v.length?{x:(v[0].x+v[v.length-1].x)/2,y:Math.min(...points.map(o=>o.y))+1.05,z:(v[0].z+v[v.length-1].z)/2}:{...p,y:p.y+1};
   return {heading,vault,hand:(side:1|-1)=>at(side*.28,0,0,sill)};
  }
  if(!climb)return {heading,vault};
  const phase=((p.y/(2*RUNG))%1+1)%1;
  const u=(side:1|-1)=>(phase+(side===1?0:.5))%1;
  return {heading,vault,hand:(side:1|-1)=>at(side*.22,1.3+RUNG*.8*lift(u(side)),.3),
   foot:(side:1|-1)=>at(side*.12,.25+RUNG*lift((u(side)+.5)%1),.22)};
 }
 takeTransfer(){const p=this.transfer;this.transfer=null;return p;}
 snapshot(){return {action:this.action,progress:this.progress};}
}
