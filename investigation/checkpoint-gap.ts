// Playtest memo "隙間がでかすぎて普通に入れる" (2026-10-31 23:26, at (6.0, -3.7) beside the grand stairs): walk around
// the end of the lobby checkpoint line instead of across it, with its guard on duty and no frisk, and see if the agent
// gets up the stairs. Same checks as the game per step: world.move (walls, step height), then M4 constrain.
// Run from app/: node --experimental-strip-types --no-warnings ../investigation/checkpoint-gap.ts
import {readFileSync} from 'node:fs';
import {Director, type Mission, type Rules} from '../app/src/ai.ts';
import {CollisionWorld, type Position} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {M4System, type Checkpoint} from '../app/src/m4.ts';
const json = (n: string) => JSON.parse(readFileSync(new URL(`../app/src/data/${n}.json`, import.meta.url), 'utf8'));
const hotel = json('hotel') as Mission & {checkpoints: Checkpoint[]}, rules = json('rules') as Rules;
const world = new CollisionWorld(hotel), d = new Director(hotel, world, new NavGrid(world), sightBoxes(hotel), structuredClone(rules));
const m = new M4System(d, hotel.checkpoints, (rules as any).m4);
const lobby = hotel.checkpoints.find(c => c.id === 'check-lobby')!;
function walk(name: string, points: number[][]) {
 let p: Position = {x: points[0][0], y: 0, z: points[0][1]};
 for (const [x, z] of points.slice(1)) for (let i = 0; i < 200; i++) {
  const dx = x - p.x, dz = z - p.z, len = Math.hypot(dx, dz); if (len < .05) break;
  const s = Math.min(.05, len), to = world.move(p, dx / len * s, dz / len * s), next = m.constrain(p, to);
  if (next === p) break; p = next;
 }
 console.log(JSON.stringify({route: name, guardOnDuty: !!m.attendant(lobby), end: {x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2)}, upstairs: p.y > 3}));
}
walk('straight across the line', [[8, -2], [8, -11]]);
walk('around the west end', [[5.3, -2], [5.3, -3.8], [7, -3.8], [7, -11]]);
walk('around the east end', [[10.7, -2], [10.7, -3.8], [9, -3.8], [9, -11]]);
