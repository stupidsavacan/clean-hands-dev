import { ScheduleSystem } from '../schedule.ts';
import { floorOf } from '../world.ts';
import { sampleTraversal, traversalSeconds, type Traversal } from '../party/traversal.ts';

// The club technician uses the same shaft as the player, with the same generic ladder motion (ladder-motion.ts).
// Ordinary routes still use the collision navigation grid, including both stairs.
export class ClubSchedule extends ScheduleSystem {
 private climb: { reverse: boolean; elapsed: number } | null = null;
 private readonly ladder: Traversal;

 constructor(data: ScheduleSystem['data'], places: ScheduleSystem['places'],
             director: ScheduleSystem['director'], clock: ScheduleSystem['clock'],
             events: ScheduleSystem['events'], ladder: Traversal) {
  super(data, places, director, clock, events);
  this.ladder = ladder;
 }

 step(dt: number) {
  const tech = this.director.npcs.find(n => n.id === 'technician');
  if (!tech?.active) { if (tech) tech.traversal = null; this.climb = null; return; }
  if (this.climb) {
   const seconds = traversalSeconds(this.ladder);
   this.climb.elapsed = Math.min(seconds, this.climb.elapsed + dt);
   const frame = sampleTraversal(this.ladder, this.climb.reverse, this.climb.elapsed / seconds);
   tech.pos = { ...frame.position };
   tech.heading = frame.heading;
   tech.traversal = frame;
   if (this.climb.elapsed === seconds) {
    tech.busy = false;
    tech.traversal = null;
    this.climb = null;
   }
   return;
  }
  const goal = tech.scheduleTarget;
  if (tech.busy || !goal || floorOf(tech.pos.y) === floorOf(goal.y)) return;
  const { start, end } = this.ladder;
  // Forwards when the start is on the floor the technician is on.
  const reverse = (goal.y > tech.pos.y) !== (end.y > start.y);
  const from = reverse ? end : start;
  tech.scheduleTarget = from;
  if (Math.hypot(tech.pos.x - from.x, tech.pos.z - from.z) <= .12) {
   tech.busy = true;
   tech.speed = 0;
   this.climb = { reverse, elapsed: 0 };
  }
 }
}
