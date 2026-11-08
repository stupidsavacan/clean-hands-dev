import type {Npc,PlayerView,Rules} from './ai.ts';
import type {CombatSystem} from './combat.ts';
import type {DetectionSystem} from './detection.ts';
import {segmentClear,type Aabb} from './sight.ts';
import type {Position} from './world.ts';

export type CarrySight={drawn?:Position;longGun?:Position;illegalTools:Position[];suspicious?:Position};

export function carriedPoints(p:Position,heading:number,crouched:boolean,disguise:string,combat:CombatSystem,items:DetectionSystem,includeTools=false):CarrySight|undefined{
 const s=Math.sin(heading),c=Math.cos(heading);
 const point=(forward:number,right:number,y:number):Position=>({x:p.x+s*forward-c*right,y:p.y+y,z:p.z+c*forward+s*right});
 const drawn=combat.hand?point(.37,.25,crouched?.81:1.24):undefined;
 const longGun=combat.shown(disguise)?point(-.26,.08,crouched?.78:1.23):undefined;
 const hand=point(.21,.29,crouched?.65:1.02);
 const suspicious=items.suspiciousHeld(disguise)?hand:undefined;
 const illegalTools:Position[]=[];
 if(includeTools){
  const illegal=(id:string)=>{const l=items.legality(id,disguise);return l.legality==='illegal'&&!l.ok;};
  if(items.held&&illegal(items.held))illegalTools.push(hand);
  for(const [i,id] of items.back.entries())if(illegal(id))illegalTools.push(point(-.24,i%2?-.19:.19,crouched?.80:1.22));
 }
 return drawn||longGun||suspicious||illegalTools.length?{drawn,longGun,suspicious,illegalTools}:undefined;
}

export function carryPointVisible(n:Npc,p:PlayerView,point:Position|undefined,boxes:Aabb[],eyeHeight:number){
 if(!point||p.hidden||n.visibility<=0)return false;
 const eye={...n.pos,y:n.pos.y+eyeHeight};
 const dx=point.x-eye.x,dz=point.z-eye.z,len=dx*dx+dz*dz;
 const t=len>0?((p.x-eye.x)*dx+(p.z-eye.z)*dz)/len:0;
 // The player's torso can hide the item while the watcher can still see their head.
 if(t>0&&t<1){
  const x=eye.x+dx*t-p.x,z=eye.z+dz*t-p.z,y=eye.y+(point.y-eye.y)*t-p.y;
  if(x*x+z*z<.23*.23&&y>(p.crouched?.28:.66)&&y<(p.crouched?1.01:1.52))return false;
 }
 return segmentClear(boxes,eye,point)&&!n.crowdOcclusion?.(eye,point);
}

export function visibleCarry(n:Npc,p:PlayerView,boxes:Aabb[],rules:Rules):PlayerView{
 const carry=p.carrySight;
 if(!carry)return p;
 const sees=(at:Position|undefined)=>carryPointVisible(n,p,at,boxes,rules.vision.eye);
 const weaponDrawn=!!p.weaponDrawn&&sees(carry.drawn);
 const longGun=!!p.illegalVisibleCarry&&sees(carry.longGun);
 const illegalVisibleCarry=!!p.illegalVisibleCarry&&(longGun||carry.illegalTools.some(sees));
 const suspiciousItem=!!p.suspiciousItem&&sees(carry.suspicious);
 const illegal=p.illegal&&(weaponDrawn||longGun);
 if(weaponDrawn===!!p.weaponDrawn&&illegalVisibleCarry===!!p.illegalVisibleCarry&&suspiciousItem===!!p.suspiciousItem&&illegal===p.illegal)return p;
 return {...p,weaponDrawn,illegalVisibleCarry,suspiciousItem,illegal};
}
