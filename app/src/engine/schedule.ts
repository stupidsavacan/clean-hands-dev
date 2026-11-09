import { ScheduleSystem } from '../schedule.ts';
import type { Npc } from '../ai.ts';
import { floorOf, type Position } from '../world.ts';
import { sampleTraversal, traversalSeconds, type Traversal } from '../party/traversal.ts';

// 2026-11-10 (Issue #1): any scheduled NPC can use any ladder, drainpipe or window the map lists them on
// (`users` on the traversal), with the same generic motion as the player (ladder-motion.ts). Everyone else, and every
// trip that stays on one floor, keeps to the walking grid and its stairs.
export type NpcTraversal = Traversal & { users?: string[] };
type Climb = { link: NpcTraversal; reverse: boolean; elapsed: number; seconds: number };

export class TraversalSchedule extends ScheduleSystem {
 private readonly climbs = new Map<string, Climb>();
 private readonly links: NpcTraversal[];

 constructor(data: ScheduleSystem['data'], places: ScheduleSystem['places'],
             director: ScheduleSystem['director'], clock: ScheduleSystem['clock'],
             events: ScheduleSystem['events'], links: NpcTraversal[] = []) {
  super(data, places, director, clock, events);
  this.links = links.filter(l => l.users?.length);
 }

 /** Who is on a traversal now, and where. */
 climbing(id: string) { return this.climbs.get(id); }

 step(dt: number) {
  for (const [id, c] of this.climbs) {
   const n = this.director.npcs.find(x => x.id === id);
   // Knocked out (or gone) mid-climb: they stay where they are; the body rules take over from there.
   if (!n?.active) { if (n) { n.traversal = null; n.busy = false; } this.climbs.delete(id); continue; }
   c.elapsed = Math.min(c.seconds, c.elapsed + dt);
   const frame = sampleTraversal(c.link, c.reverse, c.elapsed / c.seconds);
   n.pos = { ...frame.position }; n.heading = frame.heading; n.traversal = frame; n.speed = 0;
   if (c.elapsed === c.seconds) { n.busy = false; n.traversal = null; this.climbs.delete(id); }
  }
  for (const n of this.director.npcs) {
   const goal = n.scheduleTarget;
   if (this.climbs.has(n.id) || !n.active || n.busy || !goal || floorOf(n.pos.y) === floorOf(goal.y)) continue;
   const pick = this.route(n, goal);
   if (!pick) continue;
   const from = pick.reverse ? pick.link.end : pick.link.start;
   n.scheduleTarget = from;
   if (Math.hypot(n.pos.x - from.x, n.pos.z - from.z) <= .12 && Math.abs(n.pos.y - from.y) < .3) {
    n.busy = true; n.speed = 0;
    this.climbs.set(n.id, { link: pick.link, reverse: pick.reverse, elapsed: 0, seconds: traversalSeconds(pick.link) });
   }
  }
 }

 /** The nearest traversal this NPC may use that leaves from their floor and arrives on the goal's floor. */
 private route(n: Npc, goal: Position) {
  const here = floorOf(n.pos.y), there = floorOf(goal.y);
  let best: { link: NpcTraversal; reverse: boolean } | null = null, dist = Infinity;
  for (const link of this.links) {
   if (!link.users!.includes(n.id)) continue;
   for (const reverse of [false, true]) {
    const a = reverse ? link.end : link.start, b = reverse ? link.start : link.end;
    if (floorOf(a.y) !== here || floorOf(b.y) !== there) continue;
    const d = Math.hypot(n.pos.x - a.x, n.pos.z - a.z) + Math.hypot(b.x - goal.x, b.z - goal.z);
    if (d < dist) { dist = d; best = { link, reverse }; }
   }
  }
  return best;
 }
}
