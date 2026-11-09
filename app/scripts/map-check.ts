// 2026-11-10: the map lab's checks without a browser, for Claude and for a quick look before a commit.
//   npm run map:check            -> the club's problems as lines
//   npm run map:check -- --json  -> the same as JSON (level, text, where, item)
//   npm run map:check -- --route 22,2,0 36,30,1   -> can someone walk from (x,z,floor) to (x,z,floor), and see there
import {readFileSync} from 'node:fs';
import {checkMap} from '../src/map-editor/checks.ts';
import {probeOf,routeBetween,type Doc} from '../src/map-editor/core.ts';
const read=(n:string)=>JSON.parse(readFileSync(new URL('../src/data/'+n,import.meta.url),'utf8'));
const doc={...read('club-layout.json'),devices:read('club-mission.json').devices} as Doc;
const args=process.argv.slice(2),probe=probeOf(doc);
const at=(s:string)=>{const [x,z,floor=0]=s.split(',').map(Number);return {x,z,floor};};
if(args[0]==='--route'){
 const r=routeBetween(doc,probe,at(args[1]),at(args[2]));
 console.log(JSON.stringify({walk:!!r.path,metres:r.metres,blocked:r.blocked,sight:r.sight,path:r.path?.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)])}));
}else{
 const issues=checkMap(doc,probe);
 if(args.includes('--json'))console.log(JSON.stringify(issues,null,1));
 else{for(const i of issues)console.log((i.level==='error'?'エラー':'注意')+'\t'+i.text+(i.at?`\t(${i.at.x.toFixed(2)}, ${i.at.z.toFixed(2)}) ${i.at.floor+1}階`:''));
  console.log(issues.length?`エラー ${issues.filter(i=>i.level==='error').length} 件・注意 ${issues.filter(i=>i.level==='warning').length} 件`:'問題なし');}
 if(issues.some(i=>i.level==='error'))process.exitCode=1;
}
