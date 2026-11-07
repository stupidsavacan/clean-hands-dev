import {baseRate,permission,zoneAt,type Director,type PlayerView,type Npc} from './ai.ts';
import {floorOf,type Position} from './world.ts';
import {segmentClear} from './sight.ts';
export type KillCamera={id:string;x:number;y:number;z:number;floor:number;heading:number;fov:number;range:number};
export type KillJudgement={kind:'accident'|'murder'|'combat';witnesses:string[];cameras:string[];illegal:boolean;reasons:string[]};
export type KillRecord={victim:string;method:string;time:number;position:Position;judgement:KillJudgement};
// Judgement is sampled at activation; suspiciousOnly uses the same base rate as normal suspicion for trap work.
// Pushes and direct kills still count everyone who can see the act. Erasing camera-only evidence is handled by M53.
// exposed: the activation is the player's own visible act (a push). A poisoned barrel or glass kills when the victim
// drinks; the poisoning itself was the preparation, so being seen elsewhere at that moment makes no one a witness.
export function judgeKill(director:Director,player:PlayerView,cameras:KillCamera[],illegal=false,exclude:string[]=[],exposed=true,suspiciousOnly=false):KillJudgement{
 const witnesses:string[]=[],seenCameras:string[]=[];
 if(exposed)for(const n of director.npcs){if(!n.active||n.busy||exclude.includes(n.id))continue;n.perceive(player,director.boxes,director.rules);const zone=zoneAt(director.mission.zones,player.x,player.z,player.floor);if(n.visibility>0&&(!suspiciousOnly||baseRate(director.rules,player,permission(director.rules,player.disguise,zone),zone?.type)>0))witnesses.push(n.id);}
 if(exposed)for(const c of cameras){if(c.floor!==floorOf(player.y))continue;const dx=player.x-c.x,dz=player.z-c.z,off=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-c.heading),Math.cos(Math.atan2(dx,dz)-c.heading)))*180/Math.PI;
  if(Math.hypot(dx,dz)<=c.range&&off<=c.fov/2&&segmentClear(director.boxes,{x:c.x,y:c.y,z:c.z},{x:player.x,y:player.y+1.2,z:player.z}))seenCameras.push(c.id);}
 const reasons=[...witnesses.map(id=>'目撃: '+id),...seenCameras.map(id=>'カメラ: '+id),...(illegal?['違法な物を手に出していた']:[])];
 return {kind:reasons.length?'murder':'accident',witnesses,cameras:seenCameras,illegal,reasons:reasons.length?reasons:['仕掛けによる死亡・作動時の目撃なし・違法な持ち物なし']};
}
// Out cold where they stand (a dart; M3's knock-out sets the same fields itself).
export function markUnconscious(n:Npc){n.life='unconscious';n.bodyMode='ground';n.busy=false;n.speed=0;n.suspicion=0;n.visibility=0;n.fall=0;n.evidenceGoal=null;n.goal=null;n.state='patrol';n.scheduleTarget=null;n.scheduleAction='';}
export function markDead(n:Npc,method:string,judgement:KillJudgement){n.life='dead';n.deathKind=judgement.kind;n.deathMethod=method;n.bodyMode='ground';n.busy=false;n.speed=0;n.suspicion=0;n.visibility=0;n.fall=0;n.evidenceGoal=null;n.goal=null;n.state='patrol';n.scheduleTarget=null;n.scheduleAction='';}
