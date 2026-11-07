// Run from any directory: node playtest/analyze-crowd.mjs [club-run.json ...]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const runs = new URL('./runs/', import.meta.url);
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const files = process.argv.slice(2);
const inputs = files.length ? files : readdirSync(runs)
  .filter(name => /^\d{8}-\d{6}_club-.*\.json$/.test(name)).sort()
  .map(name => fileURLToPath(new URL(name, runs)));
const map = read(new URL('../app/src/data/club-map.json', import.meta.url));
const risk = new Set(['kill', 'carry', 'hide', 'draw', 'trespass', 'change']);
const grid = 2;
const cells = new Map(), places = new Map();
const place = id => {
  if (!places.has(id)) places.set(id, { id, observations: 0, seen: [], cover: [] });
  return places.get(id);
};
const sources = [];
for (const path of inputs) {
  const run = read(path);
  if (run.meta?.map !== 'club' || !Array.isArray(run.telemetry) || !files.length && run.meta.test) continue;
  const name = basename(path);
  sources.push(name);
  const active = new Map();
  const seen = (ids, proof, action) => {
    for (const id of ids ?? []) {
      if (action.seen.has(id)) continue;
      action.seen.add(id);
      place(id).seen.push({ ...proof, action: action.action, started: action.started });
    }
  };
  for (const row of run.telemetry) {
    const proof = { run: name, t: row.t, x: row.x, z: row.z, floor: row.floor, zone: row.zone };
    if (row.kind === 'action' && risk.has(row.action)) {
      if (row.phase === 'end') { active.delete(row.action); continue; }
      const x = Math.floor(row.x / grid) * grid, z = Math.floor(row.z / grid) * grid;
      const key = [row.floor, x, z].join(':');
      if (!cells.has(key)) cells.set(key, { floor: row.floor, x, z, actions: [] });
      cells.get(key).actions.push({ ...proof, action: row.action });
      const action = { action: row.action, started: row.t, seen: new Set() };
      active.set(row.action, action);
      seen(row.crowd, proof, action);
    }
    if (row.kind === 'sight') {
      const ids = row.crowd?.places ?? [];
      for (const id of ids) place(id).observations++;
      for (const action of active.values()) seen(ids, proof, action);
      const blockers = new Set((row.blocked ?? []).flatMap(([, ids]) => ids));
      for (const id of blockers) place(id).cover.push({ ...proof, observers: row.blocked.filter(([, ids]) => ids.includes(id)).map(([id]) => id) });
    }
  }
}

let crowd = [];
try { crowd = read(new URL('../app/src/data/club-crowd.json', import.meta.url)).places; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const p of crowd) place(p.id);
const statuses = [...places.values()].map(p => {
  const definition = crowd.find(q => q.id === p.id);
  const level = p.seen.length >= 3 ? '邪魔' : p.seen.length > 0 ? '注意' : p.observations || p.cover.length ? '安全' : '記録なし';
  return { ...definition, ...p, level, visibleActions: p.seen.length, coverSamples: p.cover.length };
});
const byZone = {};
for (const cell of cells.values()) for (const row of cell.actions) {
  const key = `${row.floor}:${row.zone}`;
  const zone = byZone[key] ??= { floor: row.floor, zone: row.zone, count: 0, actions: {} };
  zone.count++;
  zone.actions[row.action] = (zone.actions[row.action] ?? 0) + 1;
}
const analysis = { sources, gridMetres: grid, threshold: '注意 1〜2回、邪魔 3回以上。同じ行動と場所の組は1回。', zones: Object.values(byZone), cells: [...cells.values()], places: statuses };
writeFileSync(new URL('crowd-analysis.json', runs), JSON.stringify(analysis, null, 2) + '\n');

const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const colors = { 安全:'#56aa8a', 注意:'#e8ba65', 邪魔:'#ed7975', 記録なし:'#8793a3' };
const k=12, offset=22, size=map.ground;
const width=(size.maxX-size.minX)*k+offset*2, height=(size.maxZ-size.minZ)*k+offset*3;
const rect = (x,z,w,d,fill,alpha,title) => `<rect x="${offset+x*k}" y="${offset+z*k}" width="${w*k}" height="${d*k}" fill="${fill}" fill-opacity="${alpha}" stroke="#a6afbd" stroke-width=".6"><title>${esc(title)}</title></rect>`;
const text = (x,z,s) => `<text x="${offset+x*k}" y="${offset+z*k}" fill="#edf0f4" font-size="10">${esc(s)}</text>`;
const layers = [0,1].map(floor => {
  let content = text(0,-.6,`${floor+1}F　赤い格子：行動回数　色の付いた枠：群衆の場所（見えた／遮った）`);
  for (const r of map.rooms.filter(r => r.floor === floor)) {
    content += rect(r.minX,r.minZ,r.maxX-r.minX,r.maxZ-r.minZ,'#243349',.7,r.label);
    content += text(r.minX+.2,r.minZ+.85,r.label);
  }
  for (const p of statuses.filter(p => p.floor === floor)) {
    content += rect(p.x-p.width/2,p.z-p.depth/2,p.width,p.depth,colors[p.level],.45,`${p.id} ${p.level}`);
    content += text(p.x-p.width/2+.1,p.z,`${p.id} ${p.visibleActions}/${p.coverSamples}`);
  }
  for (const c of analysis.cells.filter(c => c.floor === floor)) {
    content += rect(c.x,c.z,grid,grid,'#ff7774',.62,c.actions.map(a => `${a.run} ${a.t}s ${a.action}`).join(' / '));
    content += text(c.x+.3,c.z+1.35,c.actions.length);
  }
  return `<g transform="translate(${floor*width} 0)">${content}</g>`;
});
writeFileSync(new URL('crowd-analysis.svg', runs), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${2*width} ${height}"><rect width="100%" height="100%" fill="#151b24"/>${layers.join('')}</svg>\n`);
console.log(JSON.stringify({ runs:sources.length, cells:cells.size, places:statuses.length }));
