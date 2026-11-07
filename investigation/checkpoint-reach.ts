// Can the agent be frisked at the real hotel's checkpoints? Scans the floor around each line and applies the same
// checks as pressing B (m4.ts): close to the line segment (checkpoint), its guard on duty (attendant).
// Trigger: playtest2 report that B never starts at either hotel checkpoint.
// Run from app/: node --experimental-strip-types ../investigation/checkpoint-reach.ts
import {readFileSync} from 'node:fs';
import {Director, type Mission, type Rules} from '../app/src/ai.ts';
import {CollisionWorld} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {M4System, type Checkpoint} from '../app/src/m4.ts';
const json = (n: string) => JSON.parse(readFileSync(new URL(`../app/src/data/${n}.json`, import.meta.url), 'utf8'));
const hotel = json('hotel') as Mission & {checkpoints: Checkpoint[]}, rules = json('rules') as Rules;
const world = new CollisionWorld(hotel), d = new Director(hotel, world, new NavGrid(world), sightBoxes(hotel), structuredClone(rules));
const m = new M4System(d, hotel.checkpoints, (rules as any).m4);
const flat = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
for (const c of hotel.checkpoints) {
 const guard = d.npcs.find(n => n.id === c.guardId)!;
 let onLine = 0, withGuard = 0, ok = 0; const okAt: string[] = [];
 for (let dx = -4; dx <= 4; dx += .1) for (let dz = -4; dz <= 4; dz += .1) {
  const x=c.x+dx,z=c.z+dz,y=world.surface(x,z,c.y);if(y===null)continue;
  const p = {x,y,z};if (world.blocked(p.x, p.y, p.z, 1.8)) continue;
  const cp = m.checkpoint(p); if (!cp) continue; onLine++;
  if (!m.attendant(cp)) continue; withGuard++;
  if (m.allowed(cp)) { ok++; if (okAt.length < 3) okAt.push(`(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`); }
 }
 console.log(JSON.stringify({checkpoint: c.id, line: {x: c.x, z: c.z, width: c.width}, guardPost: {x: guard.pos.x, z: guard.pos.z},
  guardToLine: +flat(guard.pos, c).toFixed(2), pointsOnLine: onLine, withGuardOnDuty: withGuard, friskPossible: ok, examples: okAt}));
}
