// Compile club geometry through the same compiler the map editor uses.
import {readFileSync,writeFileSync} from 'node:fs';
import {assertMapLayout,compileMapGeometry} from '../src/map-layout.ts';
const file=(name:string)=>new URL('../src/data/'+name+'.json',import.meta.url);
const read=(name:string)=>JSON.parse(readFileSync(file(name),'utf8'));
const raw=read('club-layout'),hotel=read('hotel');
assertMapLayout(raw);
const {geometry,...spec}=raw as typeof raw&Record<string,any>;
const compiled=compileMapGeometry({...raw,geometry});
const map={...hotel,...spec,...compiled,sections:[{id:'club',label:'クラブ',surface:'asphalt',...spec.ground,outdoor:true}],
 pool:{minX:100,maxX:101,minZ:100,maxZ:101},water:[],palms:[],labels:[],guide:[[22,2],[20,15]],
 exits:spec.exits??[],reinforcements:[],cameras:[]};
delete map.m53;delete map.m57;
const stable=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)
 ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
if(stable(read('club-map'))!==stable(map))writeFileSync(file('club-map'),JSON.stringify(map,null,1)+'\n');
console.log(JSON.stringify({zones:compiled.zones.length,walls:compiled.walls.length,npcs:spec.npcs.length}));
