import type {Mesh} from 'three';
import type {Npc} from './ai.ts';
import type {Position} from './world.ts';
import {segmentClear,type Aabb} from './sight.ts';

export const COIN_PICKUP_SECONDS=1.25;
export const COIN_GRASP=.42;
export const COIN_STOW=.83;

export type CoinPickup={at:Position;progress:number};
type PendingPickup=CoinPickup&{npc:Npc;goal:Position;mesh:Mesh};

export class LandedCoinPickups{
 private readonly pending=new Set<PendingPickup>();

 watch(mesh:Mesh,npc:Npc|undefined){
  const {x,y,z}=mesh.position,goal=npc?.goal;
  // A guard who only turned at a post, or who saw the throw, has no coin goal.
  if(npc?.state==='distracted'&&goal&&goal.x===x&&goal.y===y&&goal.z===z){
   this.pending.add({npc,goal,mesh,at:{x,y,z},progress:0});
  }
 }

 step(dt:number,boxes:Aabb[]){
  for(const pickup of this.pending){
   const {npc,at,goal,mesh}=pickup;
   // A fresh noise replaces the goal, even if the next coin lands in the same spot.
   if(!npc.active||npc.busy||npc.state!=='distracted'||npc.goal!==goal){
    this.finish(pickup);
    continue;
   }
   const distance=Math.hypot(at.x-npc.pos.x,at.z-npc.pos.z);
   if(!npc.arrived||distance>.62||Math.abs(npc.pos.y-at.y)>.22||
      !segmentClear(boxes,{...npc.pos,y:npc.pos.y+.25},at)){
    if(npc.coinPickup===pickup)this.finish(pickup);
    continue;
   }
   npc.coinPickup=pickup;
   npc.speed=0;
   if(distance>.05){
    const turn=Math.atan2(at.x-npc.pos.x,at.z-npc.pos.z)-npc.heading;
    const delta=Math.atan2(Math.sin(turn),Math.cos(turn)),limit=dt*12;
    npc.heading+=Math.max(-limit,Math.min(limit,delta));
   }
   npc.scanBase=npc.heading;
   npc.scanT=0;
   pickup.progress+=dt/COIN_PICKUP_SECONDS;
   if(pickup.progress>=COIN_STOW)mesh.removeFromParent();
   if(pickup.progress>=1)this.finish(pickup);
  }
 }

 get held(){
  return [...this.pending].filter(p=>p.progress>=COIN_GRASP&&p.progress<COIN_STOW);
 }

 clear(){for(const pickup of this.pending)this.finish(pickup);}

 private finish(pickup:PendingPickup){
  if(pickup.progress>=COIN_GRASP)pickup.mesh.removeFromParent();
  if(pickup.npc.coinPickup===pickup)pickup.npc.coinPickup=null;
  this.pending.delete(pickup);
 }
}
