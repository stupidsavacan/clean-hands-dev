// The club's game map: the shared map build (scripts/build-map.ts) with the club's section and guide walk.
import {buildMapFile} from './build-map.ts';
const map=buildMapFile('club',{section:{id:'club',label:'クラブ',surface:'asphalt'},guide:[[22,2],[20,15]]});
console.log(JSON.stringify({zones:map.zones.length,walls:map.walls.length,npcs:(map.npcs as unknown[]).length}));
