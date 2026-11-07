import {floorOf,inside,plateY,HEIGHT,type Level,type Position} from './world.ts';
// Test the whole visual body against one opaque floor rectangle. Looking through a stair
// opening or past a plate edge always keeps the NPC. AI and movement are independent of this.
export function npcLayerVisible(level:Level,p:Position,viewFloor:number,camera:Position,radius:number,margin:number){
 const floor=floorOf(p.y),cap=Math.max(0,viewFloor);
 if(floor>cap)return level.stairs.some(s=>s.low<=plateY(level,cap)&&p.y>=s.low&&p.y<=s.high&&inside(s,p.x,p.z));
 if(floor>=viewFloor)return true;
 for(const plate of level.floors){if(plate.floor>viewFloor||plate.y<=p.y+HEIGHT+.5||camera.y<=plate.y)continue;
  for(const area of plate.areas){let covered=true;
   for(const h of [0,HEIGHT+.5])for(const dx of [-radius,radius])for(const dz of [-radius,radius]){const y=p.y+h,t=(plate.y-y)/(camera.y-y),x=p.x+dx+(camera.x-p.x-dx)*t,z=p.z+dz+(camera.z-p.z-dz)*t;if(!inside(area,x,z,margin))covered=false;}
   if(covered)return false;
  }
 }
 return true;
}
