// 2026-11-10 (Issue #1): temporary orders that take an NPC off their schedule, and the way back to it.
// A chance scene, a VIP lockdown, people gathering round a body and a guard sent to check all give orders from their
// own source. The newest order an NPC holds is the one they follow; when a source lets go, the NPC goes back to the
// order under it, or to their schedule (with a fresh travel budget) once no order is left. Before this, every system
// wrote scriptedGoal itself and a release by one wiped out an order from another.
import type {Npc} from '../ai.ts';
import type {Position} from '../world.ts';

type Order={source:string;at:Position;action:string;heading:number|null};

export class Errands{
 private readonly orders=new Map<Npc,Order[]>();
 /** schedule.states: an NPC's schedule slot is restarted when they come back to it. */
 private readonly schedule:{states:Map<string,unknown>};
 constructor(schedule:{states:Map<string,unknown>}){this.schedule=schedule;}
 /** Send `n` to `at` for `source`; when there, they do `action` facing `heading`. Replaces that source's last order. */
 send(n:Npc,source:string,at:Position,action='',heading:number|null=null){
  const list=(this.orders.get(n)??[]).filter(o=>o.source!==source);
  list.push({source,at,action,heading});this.orders.set(n,list);this.apply(n);
 }
 /** That source no longer needs `n`. */
 release(n:Npc,source:string){
  const list=this.orders.get(n);if(!list?.some(o=>o.source===source))return;
  this.orders.set(n,list.filter(o=>o.source!==source));this.apply(n);
 }
 /** Every order of a source, from everyone. */
 releaseAll(source:string){for(const n of [...this.orders.keys()])this.release(n,source);}
 /** All of `n`'s orders (someone who takes over the NPC completely, e.g. a radio call). */
 clear(n:Npc){
  this.orders.set(n,[]);this.applied.delete(n);
  if(n.scriptedGoal){this.schedule.states.delete(n.id);n.scriptedGoal=null;n.scriptedAction='';n.scriptedHeading=null;}
 }
 holds(n:Npc,source:string){return !!this.orders.get(n)?.some(o=>o.source===source);}
 /** Who holds an order from this source. */
 holders(source:string){return [...this.orders].filter(([,l])=>l.some(o=>o.source===source)).map(([n])=>n);}
 // The goal these errands last gave each NPC. Other systems (chores, redressing) still write scriptedGoal themselves; an
 // NPC whose goal is no longer ours has a newer order from them, which a release here must not undo.
 private readonly applied=new Map<Npc,Position>();
 private apply(n:Npc){
  const top=this.orders.get(n)?.at(-1),mine=this.applied.get(n);
  if(top){n.scriptedGoal=top.at;n.scriptedAction=top.action;n.scriptedHeading=top.heading;this.applied.set(n,top.at);return;}
  this.applied.delete(n);
  if(mine&&n.scriptedGoal!==mine)return;
  // The trip back to the regular schedule gets a fresh travel budget.
  if(n.scriptedGoal)this.schedule.states.delete(n.id);
  n.scriptedGoal=null;n.scriptedAction='';n.scriptedHeading=null;
 }
}
