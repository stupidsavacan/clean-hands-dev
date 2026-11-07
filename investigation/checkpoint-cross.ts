// Where can the agent cross each checkpoint's line without a frisk? Walks short steps across the line's row,
// both ways, and reports the open spans (not walls, not stopped by m4.constrain).
// Trigger: playtest2 blocked crossings and memo 20261031-232600 at (6.0, -3.7).
// Run from app/: node --experimental-strip-types ../investigation/checkpoint-cross.ts
import {readFileSync} from 'node:fs';
import {Director, type Mission, type Rules} from '../app/src/ai.ts';
import {CollisionWorld} from '../app/src/world.ts';
import {NavGrid} from '../app/src/nav.ts';
import {sightBoxes} from '../app/src/sight.ts';
import {M4System, type Checkpoint} from '../app/src/m4.ts';
const json = (n: string) => JSON.parse(readFileSync(new URL(`../app/src/data/${n}.json`, import.meta.url), 'utf8'));
const hotel = json('hotel') as Mission & {checkpoints: Checkpoint[]; stairs: any[]}, rules = json('rules') as Rules;
const world = new CollisionWorld(hotel), d = new Director(hotel, world, new NavGrid(world), sightBoxes(hotel), structuredClone(rules));
const m = new M4System(d, hotel.checkpoints, (rules as any).m4);
for (const c of hotel.checkpoints) {
 const n = c.normal, t = {x: -n.z, z: n.x}, spans: Record<string, string[]> = {};
 for (const [name, sign] of [['from the normal side', 1], ['from the other side', -1]] as const) {
  const open: number[] = [];
  for (let s = -8; s <= 8; s += .1) {
   const at = (k: number) => ({x: c.x + t.x * s + n.x * k, y: 0, z: c.z + t.z * s + n.z * k});
   const a = at(.4 * sign), b = at(-.4 * sign);
   if (world.blocked(a.x, 0, a.z, 1.8) || world.blocked(b.x, 0, b.z, 1.8) || world.blocked((a.x + b.x) / 2, 0, (a.z + b.z) / 2, 1.8)) continue;
   let p=a;for(let step=0;step<16;step++){const q=world.move(p,-n.x*.05*sign,-n.z*.05*sign);p=m.constrain(p,q);}
   if ((p.x-c.x)*n.x*sign+(p.z-c.z)*n.z*sign<0) open.push(+s.toFixed(1));
  }
  const runs: string[] = []; let start = NaN, prev = NaN;
  for (const s of [...open, NaN]) { if (!(Math.abs(s - prev) < .15)) { if (!isNaN(start)) runs.push(`${start}..${prev}`); start = s; } prev = s; }
  spans[name] = runs;
 }
 console.log(JSON.stringify({checkpoint: c.id, width: c.width, openAlongTheLine: spans}));
}
for (const s of hotel.stairs) if (s.floor === 0 || s.low === 0) console.log(JSON.stringify({stairs:s}));
