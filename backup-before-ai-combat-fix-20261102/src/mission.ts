import type {Director} from './ai.ts';
import type {MissionEvents} from './events.ts';
/** Mission progress: eliminate every target, then leave by any of the exits. Failure is being caught (the agent's
 * death once gunfights exist) or a target escaping (evacuation at hotel alert 3 arrives with 5.7). */
export type FailReason='caught'|'killed'|'target_escaped';
export const FAIL_TEXT:Record<FailReason,{title:string;text:string}>={
 caught:{title:'捕まった。',text:'警戒した警備員に追いつかれた。見つかったら視界を切り、疑惑が下がるのを待つ。'},
 killed:{title:'倒れた。',text:'撃ち合いで力尽きた。'},
 target_escaped:{title:'ターゲットに逃げられた。',text:'騒ぎが大きくなり、ターゲットが避難してホテルを離れた。'},
};
export class MissionFlow{
 phase:'targets'|'escape'|'over'='targets';outcome:{success:boolean;exit?:string;reason?:FailReason;time:number}|null=null;
 readonly targets:string[];private readonly director:Director;private readonly events:MissionEvents;
 constructor(targets:string[],director:Director,events:MissionEvents){
  for(const id of targets)if(!director.npcs.some(n=>n.id===id&&n.target))throw new Error(`ターゲットではありません: ${id}`);
  this.targets=targets;this.director=director;this.events=events;}
 remaining(){return this.targets.filter(id=>this.director.npcs.find(n=>n.id===id)!.life!=='dead');}
 /** Switches to escaping once the last target is dead; returns true on that step. */
 update(time:number){if(this.phase==='targets'&&!this.remaining().length){this.phase='escape';this.events.emit({type:'mission.escape',time});return true;}return false;}
 exit(id:string,time:number){if(this.phase!=='escape')return false;this.phase='over';this.outcome={success:true,exit:id,time};this.events.emit({type:'mission.exit',time,id});return true;}
 fail(reason:FailReason,time:number){if(this.phase==='over')return false;this.phase='over';this.outcome={success:false,reason,time};this.events.emit({type:'mission.failed',time,reason});return true;}
}
