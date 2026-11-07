import type {Director,PlayerView} from '../ai.ts';
import type {Position} from '../world.ts';
export type Traversal={id:string;a:string;b:string;kind:string;start:Position;end:Position;seconds:number;via?:Position[]};
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
 const seen={...p,...this.transfer};for(const n of this.director.npcs){if(!n.active)continue;n.perceive(seen,this.director.boxes,this.director.rules);if(n.visibility>0)n.suspicion=Math.min(100,n.suspicion+dt*this.rules.suspicionPerSecond*n.visibility);}
 if(a.elapsed>=a.link.seconds){this.transfer={...a.to};this.action=null;this.release=true;}return true;}
 if(suppressed||this.release||!keys.has('KeyE'))return false;const c=this.candidate(p);if(!c)return false;this.action={...c,from:{x:p.x,y:p.y,z:p.z},to:{...(c.reverse?c.link.start:c.link.end)},elapsed:0};return true;}
 takeTransfer(){const p=this.transfer;this.transfer=null;return p;}
 snapshot(){return {action:this.action,progress:this.progress};}
}
