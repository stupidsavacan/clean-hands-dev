// 2026-11-10 (Issue #1): dark areas lower how far people see (moved out of club/chances.ts). A map's script names the
// zones that are dark now and how far sight reaches there (0..1 of normal); NPCs standing in one see that much less,
// and so do the crowd's people in a dark zone. How the lights look going out stays the map's (decorate().blackout).
import {zoneAt,type Director} from '../ai.ts';
import {floorOf} from '../world.ts';

export type DarkZones=Record<string,number>;

export function applyDarkZones(director:Director,crowd:{zoneSight:DarkZones},dark:DarkZones){
 crowd.zoneSight=dark;
 const any=Object.keys(dark).length>0;
 for(const n of director.npcs){
  if(!any){n.visionScale=1;continue;}
  const zone=zoneAt(director.mission.zones,n.pos.x,n.pos.z,floorOf(n.pos.y))?.id;
  n.visionScale=zone!==undefined?dark[zone]??1:1;
 }
}
