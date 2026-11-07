import { ScheduleSystem } from '../schedule.ts';
import { floorOf, type Position } from '../world.ts';
import type { Traversal } from '../party/traversal.ts';

// The club technician uses the same shaft as the player. Ordinary routes
// still use the collision navigation grid, including both stairs.
export class ClubSchedule extends ScheduleSystem {
 private climb: { points: Position[]; elapsed: number } | null = null;
 private readonly ladder: Traversal;

 constructor(data: ScheduleSystem['data'], places: ScheduleSystem['places'],
             director: ScheduleSystem['director'], clock: ScheduleSystem['clock'],
             events: ScheduleSystem['events'], ladder: Traversal) {
  super(data, places, director, clock, events);
  this.ladder = ladder;
 }

 step(dt: number) {
  const tech = this.director.npcs.find(n => n.id === 'technician');
  if (!tech?.active) { this.climb = null; return; }
  if (this.climb) {
   const { points } = this.climb;
   this.climb.elapsed = Math.min(this.ladder.seconds, this.climb.elapsed + dt);
   const progress = this.climb.elapsed / this.ladder.seconds * (points.length - 1);
   const index = Math.min(points.length - 2, Math.floor(progress));
   const a = points[index], b = points[index + 1], t = progress - index;
   tech.pos = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
   if (this.climb.elapsed === this.ladder.seconds) {
    tech.busy = false;
    this.climb = null;
   }
   return;
  }
  const goal = tech.scheduleTarget;
  if (tech.busy || !goal || floorOf(tech.pos.y) === floorOf(goal.y)) return;
  const { start, end, via = [] } = this.ladder;
  const points = goal.y > tech.pos.y ? [start, ...via, end] : [end, ...[...via].reverse(), start];
  const from = points[0];
  tech.scheduleTarget = from;
  if (Math.hypot(tech.pos.x - from.x, tech.pos.z - from.z) <= .12) {
   tech.busy = true;
   tech.speed = 0;
   this.climb = { points, elapsed: 0 };
  }
 }
}
