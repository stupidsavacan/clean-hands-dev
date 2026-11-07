export type MissionEvent={type:'kill.rejudged'|'clock.tick'|'schedule.action'|'dialogue.heard'|'alert.level'|'disguise.changed'|'npc.talked'|'cellar.entered'|'trap.armed'|'trap.fired'|'npc.killed'|'chance.updated'|'item.picked'|'item.used'|'player.spotted'|'body.found'|'shot.fired'|'combat.started'|'camera.recorded'|'mission.escape'|'mission.exit'|'mission.failed'|'combat.ended'|'player.hit'|'witness.started'|'witness.reported'|'camera.recorded'|'camera.cleared'|'camera.destroyed'|'flag.set'|'target.escaped';time:number;id?:string;value?:number;target?:string;method?:string;place?:string;judgement?:'accident'|'murder'|'combat';reason?:string;life?:'unconscious'|'dead'};
// A bounded trace is also useful from __cleanHands; subscribers receive events synchronously.
export class MissionEvents{
 readonly recent:MissionEvent[]=[];
 private listeners=new Set<(event:MissionEvent)=>void>();
 on(listener:(event:MissionEvent)=>void){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 emit(event:MissionEvent){if(event.type!=='clock.tick'||this.recent.at(-1)?.time!==Math.floor(event.time)){this.recent.push({...event,time:event.type==='clock.tick'?Math.floor(event.time):event.time});if(this.recent.length>160)this.recent.shift();}for(const listener of this.listeners)listener(event);}
}
