import type {MissionEvents} from './events.ts';
/** scoring.json: points per event, the time bonus, rank thresholds and the events that break a ghost run. */
export type Scoring={base:number;events:Record<string,number>;timeBonus:{under:number;points:number};ranks:{rank:string;min:number}[];ghost:string[]};
export const SCORE_LABEL:Record<string,string>={spotted:'見つかった',ko_found:'気絶した人の発見',body_found:'死体の発見',loud_shot_once:'銃声',combat:'撃ち合い',guard_kill:'警備員の排除',civilian_kill:'ターゲット以外の排除',recording_left:'監視カメラの記録',accident_kill:'事故に見せかけた排除',chance_complete:'チャンスの達成'};
type Who={role:string;target:boolean};

/** Listens to mission events and only counts; nothing is added up until the result (so the breakdown can be shown).
 * spotted counts each person who spotted the agent once; bodies count once each and accidents are not "found";
 * deaths count once each: a target dying by accident earns the bonus, anyone else is a guard or civilian kill. */
export class ScoreLedger{
 readonly counts=new Map<string,number>();private seen=new Set<string>();
 constructor(events:MissionEvents,who:(id:string)=>Who|undefined){events.on(e=>{
  const once=(key:string,id:string|undefined,score:string)=>{if(!id||this.seen.has(key+':'+id))return;this.seen.add(key+':'+id);this.add(score);};
  if(e.type==='player.spotted')once('spotted',e.id,'spotted');
  else if(e.type==='body.found'){if(e.life==='unconscious')once('ko',e.id,'ko_found');else if(e.judgement==='murder')once('body',e.id,'body_found');}
  else if(e.type==='npc.killed'){const w=e.id?who(e.id):undefined;if(!w)return;once('killed',e.id,w.target?(e.judgement==='accident'?'accident_kill':'target_kill'):w.role==='guard'?'guard_kill':'civilian_kill');}
  else if(e.type==='chance.updated'&&e.reason==='complete')once('chance',e.id,'chance_complete');
  else if(e.type==='shot.fired'){if(e.method==='loud')this.add('loud_shot_once');}
  else if(e.type==='camera.recorded')this.counts.set('recording_left',1);
  else if(e.type==='camera.cleared')this.counts.delete('recording_left');
  else if(e.type==='combat.started')this.add('combat');
 });}
 add(key:string,n=1){this.counts.set(key,(this.counts.get(key)??0)+n);}
 count(key:string){return this.counts.get(key)??0;}
 /** True while nothing that breaks a ghost run has happened. */
 ghost(scoring:Scoring){return scoring.ghost.every(k=>!this.count(k));}
}
export type ResultLine={key:string;label:string;count:number;points:number};
export type MissionResult={success:boolean;seconds:number;lines:ResultLine[];timeBonus:number;total:number;rank:string;ghost:boolean;ghostBrokenBy:string[]};
/** The whole score at once from the counts: base + every event line + the time bonus, then the rank. */
export function computeResult(scoring:Scoring,counts:ReadonlyMap<string,number>,seconds:number,success:boolean):MissionResult{
 const lines=Object.entries(scoring.events).map(([key,points])=>({key,label:SCORE_LABEL[key]??key,count:counts.get(key)??0,points:(counts.get(key)??0)*points}));
 // loud_shot_once: the first loud shot costs the points once, however many follow.
 const shot=lines.find(l=>l.key==='loud_shot_once');if(shot)shot.points=shot.count?scoring.events.loud_shot_once:0;
 const timeBonus=success&&seconds<scoring.timeBonus.under?scoring.timeBonus.points:0;
 const total=scoring.base+lines.reduce((s,l)=>s+l.points,0)+timeBonus;
 const ranks=[...scoring.ranks].sort((a,b)=>b.min-a.min),rank=success?(ranks.find(r=>total>=r.min)??ranks[ranks.length-1]).rank:'—';
 const ghostBrokenBy=scoring.ghost.filter(k=>(counts.get(k)??0)>0);
 return {success,seconds,lines,timeBonus,total,rank,ghost:success&&!ghostBrokenBy.length,ghostBrokenBy};
}
