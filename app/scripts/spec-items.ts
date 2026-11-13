// The item spec, read from every table that knows about items (2026-11-07). An item's facts live in several places
// (the model, how it is held, the melee table, each map's rules and placements); this file puts them side by side so
// docs/items.md shows one row per item, and tests/items.test.ts can say exactly what a new item is still missing.
import {readFileSync} from 'node:fs';
import {MELEE,BACK_ITEMS,LARGE_ITEMS,BACK_MAX} from '../src/melee.ts';
import {HOLD_KIND,GRIP} from '../src/hold-pose.ts';
import {ITEM_INFO,ITEM_MODELS} from '../src/item-data.ts';
import {CollisionWorld,plateY} from '../src/world.ts';

type Rule={label:string;legality:string;concealable?:boolean};
type Placed={id:string;item:string;x:number;z:number;floor:number};
type Pickup={id:string;label:string;x:number;z:number;floor:number};
const data=(f:string)=>JSON.parse(readFileSync(new URL('../src/data/'+f,import.meta.url),'utf8'));
/** Every map the game ships, with its data files. A new map adds a row here (and its files under src/data). */
export const MAPS=[
 {id:'club',label:'クラブ',map:'club-map.json',detection:'club-detection.json',mission:'club-mission.json'},
 {id:'party',label:'夜会',map:'party.json',detection:'party-detection.json',mission:'party-mission.json'},
 {id:'hotel',label:'ホテル',map:'hotel.json',detection:'detection.json',mission:'mission.json'},
 {id:'observatory',label:'天文台',map:'observatory-map.json',detection:'observatory-detection.json',mission:'observatory-brief.json'},
] as const;
const weapons=data('weapons.json') as Record<string,{label?:string}>,guns=new Set(Object.keys(weapons).filter(k=>!k.startsWith('_')));

/** Known, deliberate gaps. Each needs a reason; the test fails on any gap not listed here. */
export const ITEM_EXCEPTIONS:Record<string,string>={
 'poison_lethal:model':'まだモデルがない。手と床では代わりの小さな形で出る。作ったらこの行を消す',
 'poison_lethal:hold':'モデルと一緒に足す（今は small 扱い）',
};

export type ItemRow={id:string;label:string;kind:string;rules:Record<string,Rule>;placed:Record<string,Placed[]>;melee?:{kind:string;seconds:number;throwable:boolean;swing?:string};
 hold?:string;grip:string;large:boolean;back:boolean;model?:{triangles:number;size:number[]};gun:boolean};

export function itemRows():ItemRow[]{
 const ids=new Set<string>([...ITEM_INFO.map(i=>i.id),...Object.keys(MELEE),...guns]);
 const byMap=MAPS.map(m=>({m,det:data(m.detection) as {items:Record<string,Rule>;worldItems?:Placed[]}}));
 for(const {det} of byMap){for(const id of Object.keys(det.items))ids.add(id);for(const w of det.worldItems??[])ids.add(w.item);}
 return [...ids].sort().map(id=>{const info=ITEM_INFO.find(i=>i.id===id),rules:Record<string,Rule>={},placed:Record<string,Placed[]>={};
  for(const {m,det} of byMap){if(det.items[id])rules[m.id]=det.items[id];const p=(det.worldItems??[]).filter(w=>w.item===id);if(p.length)placed[m.id]=p;}
  const label=info?.label??MELEE[id]?.label??Object.values(rules)[0]?.label??weapons[id]?.label??id;
  return {id,label,kind:guns.has(id)?'gun':info?.kind??(MELEE[id]?'melee':'rule'),rules,placed,melee:MELEE[id],hold:HOLD_KIND[id],grip:GRIP[id]??'fist',
   large:LARGE_ITEMS.includes(id),back:BACK_ITEMS.includes(id),model:info?{triangles:info.triangles,size:info.size_m}:undefined,gun:guns.has(id)};});}

/** Everything a hand-held item must have, as a list of missing pieces ('' when complete). */
export function itemProblems(rows=itemRows()):string[]{const out:string[]=[];const skip=(id:string,what:string)=>!!ITEM_EXCEPTIONS[`${id}:${what}`];
 for(const r of rows){if(r.gun)continue;
  const handheld=!!r.model||!!r.melee||Object.keys(r.placed).length>0;if(!handheld)continue;
  if(!ITEM_MODELS[r.id]&&!skip(r.id,'model'))out.push(`${r.id}: モデルがない（assets/items/source/build_items.py → scripts/embed-items.mjs）`);
  if(!r.hold&&!skip(r.id,'hold'))out.push(`${r.id}: 持ち方がない（src/hold-pose.ts HOLD_KIND に small / long / hang）`);
  for(const map of Object.keys(r.placed))if(!r.rules[map])out.push(`${r.id}: ${map} に置いてあるのに、その地図の決まり（合法・違法）がない（${MAPS.find(m=>m.id===map)!.detection} items）`);
  const labels=new Set([r.model&&ITEM_INFO.find(i=>i.id===r.id)!.label,r.melee?.label,...Object.values(r.rules).map(x=>x.label)].filter(Boolean));
  if(labels.size>1&&!skip(r.id,'label'))out.push(`${r.id}: 名前が表ごとに違う（${[...labels].join(' / ')}）`);
  if(r.melee&&!r.model&&!skip(r.id,'model'))out.push(`${r.id}: 近接武器なのにモデルがない`);}
 for(const id of BACK_ITEMS)if(!LARGE_ITEMS.includes(id))out.push(`${id}: 背中に背負う物は大きい物（LARGE_ITEMS）にも入れる`);
 if(BACK_MAX<1)out.push('BACK_MAX は1以上');
 for(const id of [...LARGE_ITEMS,...BACK_ITEMS,...Object.keys(HOLD_KIND),...Object.keys(GRIP)])if(!rows.some(r=>r.id===id))out.push(`${id}: 表にあるが、どの地図にもモデルにもない`);
 return out;}

/** Whether the agent can stand somewhere within reach of (x,z) on that floor. */
export function canReach(mapId:string,x:number,z:number,floor:number){const m=MAPS.find(m=>m.id===mapId)!,level=data(m.map),det=data(m.detection),world=new CollisionWorld(level),reach=(det.useRadius??1.4)*.9,y=plateY(level,floor);
 for(let r=.3;r<=reach;r+=.25)for(let a=0;a<16;a++){if(!world.blocked(x+Math.cos(a/16*Math.PI*2)*r,y,z+Math.sin(a/16*Math.PI*2)*r))return true;}return false;}

/** Map data: every placed item and every agency pickup can be reached by the agent (a free spot within reach). */
export function placementProblems():string[]{const out:string[]=[];
 for(const m of MAPS){const level=data(m.map),det=data(m.detection),mission=data(m.mission);
  const floors=new Set([0,...(level.floors??[]).map((f:{floor:number})=>f.floor)]);
  const spots=[...(det.worldItems??[]).map((w:Placed)=>({what:`${w.id}（${w.item}）`,x:w.x,z:w.z,floor:w.floor})),...((mission.pickups??[]) as Pickup[]).map(p=>({what:`持ち込み ${p.id}（${p.label}）`,x:p.x,z:p.z,floor:p.floor}))];
  for(const s of spots){if(!floors.has(s.floor)){out.push(`${m.id}: ${s.what} の階 ${s.floor} が地図にない`);continue;}
   if(!canReach(m.id,s.x,s.z,s.floor))out.push(`${m.id}: ${s.what} (${s.x}, ${s.z}) の近くに立てる所がない（壁や家具の中）`);}
  // The loadout's ids exist.
  const rules=det.items as Record<string,Rule>;
  for(const t of mission.tools??[])if(!rules[t.id]&&t.id!=='coin')out.push(`${m.id}: 道具 ${t.id} に決まりがない`);
  for(const p of mission.pistols??[])if(p.id&&!guns.has(p.id))out.push(`${m.id}: 銃 ${p.id} が weapons.json にない`);}
 return out;}

const yes=(b:boolean)=>b?'○':'';
export function itemsMarkdown(){const rows=itemRows();
 const mapCols=MAPS.map(m=>m.label);
 const line=(r:ItemRow)=>`| \`${r.id}\` | ${r.label} | ${r.gun?'銃':r.melee?(r.melee.kind==='blade'?'刃物':'鈍器'):r.kind==='tool'?'道具':r.kind==='throw'?'投げる物':'—'} | ${MAPS.map(m=>{const ru=r.rules[m.id];const p=r.placed[m.id];return !ru&&r.gun?'銃（weapons.json）':ru?`${ru.legality==='illegal'?'違法':ru.legality==='suspicious'?'怪しい':'合法'}${p?` · 置き${p.length}`:''}`:p?`⚠ 決まりなし · 置き${p.length}`:'';}).join(' | ')} | ${r.hold??''} | ${r.grip==='fist'?'':r.grip} | ${yes(r.large)} | ${yes(r.back)} | ${r.melee?`${r.melee.seconds}秒${r.melee.throwable?' · 投げる':''}${r.melee.swing?` · 正面は${r.melee.swing}`:''}`:''} | ${r.model?r.model.triangles:''} |`;
 const problems=itemProblems(rows),place=placementProblems();
 return ['# 持ち物（アイテム）','','このページは `app/scripts/spec-items.ts` が、モデル・持ち方・近接武器の表・各地図の決まりと置き場所から作っています。直接書き換えず、元の表を直してから `node --experimental-strip-types --no-warnings scripts/spec-docs.ts` を実行します。','',
  '## 新しい持ち物を足す時','','1. モデル：`assets/items/source/build_items.py` に足し、`node scripts/embed-items.mjs`（`src/item-data.ts` ができる）。','2. 持ち方：`src/hold-pose.ts` の `HOLD_KIND`（small / long / hang）。棒のように持つ物は `GRIP` に along。','3. 武器なら：`src/melee.ts` の `MELEE`。大きくてポケットに入らない物は `LARGE_ITEMS`、背中に背負う物は `BACK_ITEMS`。',
  '4. 地図ごとの決まり（合法・違法・隠せるか）：クラブは `investigation/build-club-source.py` の items → `scripts/build-club.ts`。ほかの地図は `src/data/*detection.json` の items。','5. 置き場所：同じ所の `worldItems`（id・item・x・z・floor）。','6. このページを作り直し、`npm test` を通す（`tests/items.test.ts` が抜けを言う）。','7. 見た目は [持ち物ラボ](../item-lab.html) で、手・床・単体を確かめる。','',
  '## 一覧','',`| id | 名前 | 種類 | ${mapCols.join(' | ')} | 持ち方 | 握り | 大きい | 背中 | 近接 | 三角形 |`,`|---|---|---|${mapCols.map(()=>'---').join('|')}|---|---|---|---|---|---|`,...rows.map(line),'',
  '## 足りない所','',...(problems.length?problems.map(p=>`- ${p}`):['- なし']),'','## 置き場所の確かめ','',...(place.length?place.map(p=>`- ${p}`):['- すべての置き場所と持ち込みの場所に、手が届く立ち位置がある']),'',
  '## わざと例外にしている所','',...Object.entries(ITEM_EXCEPTIONS).map(([k,v])=>`- \`${k}\`：${v}`),''].join('\n');}
