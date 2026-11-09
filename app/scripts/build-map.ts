// 2026-11-10 (Issue #1): build any map's game data from its layout, the same way for every map.
//   node --experimental-strip-types scripts/build-map.ts <name>   reads src/data/<name>-layout.json, writes <name>-map.json
// Options for the game map (its section name, a guide walk) can sit in the layout as `mapOptions`.
import {readFileSync,writeFileSync} from 'node:fs';
import {assertMapLayout,buildGameMap,type GameMapOptions} from '../src/map-layout.ts';

export function buildMapFile(name:string,options:GameMapOptions={}){
 const file=(n:string)=>new URL('../src/data/'+n+'.json',import.meta.url);
 const read=(n:string)=>JSON.parse(readFileSync(file(n),'utf8'));
 const raw=read(name+'-layout');
 assertMapLayout(raw);
 const {mapOptions,...layout}=raw as typeof raw&{mapOptions?:GameMapOptions};
 const map=buildGameMap(layout,{...mapOptions,...options});
 const stable=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 let old:unknown=null;try{old=read(name+'-map');}catch{/* first build */}
 if(stable(old)!==stable(map))writeFileSync(file(name+'-map'),JSON.stringify(map,null,1)+'\n');
 return map;
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('scripts/build-map.ts')){
 const name=process.argv[2];if(!name)throw new Error('地図の名前を指定してください（例：club）');
 const map=buildMapFile(name);
 console.log(JSON.stringify({map:name,zones:map.zones.length,walls:map.walls.length,npcs:(map.npcs as unknown[]).length}));
}
