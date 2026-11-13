import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {buildCoverSpots,hiddenFrom,shootsFrom} from '../src/cover-spots.ts';
import {CollisionWorld,inside,type Level,type Position} from '../src/world.ts';
import {NavGrid} from '../src/nav.ts';
import {sightBoxes} from '../src/sight.ts';
import {Director,type Mission,type Rules} from '../src/ai.ts';
import {CombatSystem,type CombatRules,type WeaponDef} from '../src/combat.ts';
import {MissionEvents} from '../src/events.ts';
const json=(n:string)=>JSON.parse(readFileSync(new URL('../src/data/'+n+'.json',import.meta.url),'utf8'));
const out=new URL('../../investigation/guard-ai/',import.meta.url);mkdirSync(out,{recursive:true});
const results=[];
for(const [name,file,rule,combat] of [['hotel','hotel','rules','combat'],['party','party','party-rules','combat'],['club','club-map','club-rules','club-combat']]){
 const l=json(file) as Mission,w=new CollisionWorld(l),nav=new NavGrid(w),r=json(combat) as CombatRules;
 const before=buildCoverSpots(l,w,nav),spots=buildCoverSpots(l,w,nav,r.tactics);
 const bad=spots.filter(s=>w.blocked(s.x,s.y,s.z)||l.stairs.some(t=>inside(t,s.x,s.z)&&s.y>=t.low-.01&&s.y<=t.high+.01));
 const d=new Director({...l,npcs:[]},w,nav,sightBoxes(l),json(rule) as Rules);
 const c=new CombatSystem(d,new MissionEvents(),{level:0,quiet:0} as never,r,json('weapons') as Record<string,WeaponDef>,[],()=>0);
 const base=spots[0]??{x:0,y:0,z:0};
 const guards=Array.from({length:10},(_,i)=>d.addNpc({id:'audit-'+i,role:'guard',label:'audit',floor:0,model:'guard',route:[[base.x+i*.1,base.z]]}));
 for(const n of guards){n.state='combat';n.weapon='rifle_npc';}
 const choose=(c as unknown as {choose(n:typeof guards[number],p:Position,crouched:boolean,time:number):void}).choose.bind(c);
 const frames:number[]=[];
 for(let k=0;k<220;k++){const t=performance.now();for(const n of guards)choose(n,{x:base.x+15,y:base.y,z:base.z},false,k);const ms=performance.now()-t;if(k>=20)frames.push(ms);}
 frames.sort((a,b)=>a-b);
 const reinforcement=[];
 if(name==='hotel')for(const point of (l as Mission&{reinforcements:{id:string;x:number;z:number}[]}).reinforcements){
  const samples=[];for(const s of spots.filter(s=>s.floor===0&&Math.hypot(s.x-point.x,s.z-point.z)<15))for(const distance of [8,16,24]){
   const p={x:s.x+s.nx*distance,y:s.y,z:s.z+s.nz*distance};
   if(w.blocked(p.x,p.y,p.z)||nav.nearest(p)<0||!hiddenFrom(s,p,false,d.boxes)||!shootsFrom(s,p,false,d.boxes,d.rules.vision.eye))continue;
   const n=guards[0];n.pos={x:s.x,y:s.y,z:s.z};choose(n,p,false,0);
   if(n.tactic&&Math.hypot(n.tactic.spot.x-p.x,n.tactic.spot.z-p.z)>=8&&Math.hypot(n.tactic.spot.x-p.x,n.tactic.spot.z-p.z)<=24){samples.push({distance,block:n.tactic.spot.block,range:Math.hypot(n.tactic.spot.x-p.x,n.tactic.spot.z-p.z)});}
  }reinforcement.push({entry:point.id,checked:samples.length,samples:samples.slice(0,6)});
 }
 const counts={low:spots.filter(s=>s.kind==='low').length,edge:spots.filter(s=>s.kind==='edge').length};
 results.push({name,before:before.length,total:spots.length,...counts,invalid:bad.length,excluded:[...new Set(before.filter(s=>r.tactics?.excludeIds?.some(p=>s.block.startsWith(p))).map(s=>s.block))],reinforcement,selection10:{mean:frames.reduce((a,b)=>a+b,0)/frames.length,p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1)}});
 const floors=[...new Set(spots.map(s=>s.floor))].sort();
 const g=l.ground,scale=5,pad=25,width=(g.maxX-g.minX)*scale+pad*2,height=(g.maxZ-g.minZ)*scale+pad*2;
 const x=(v:number)=>(v-g.minX)*scale+pad,z=(v:number)=>(v-g.minZ)*scale+pad;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width*floors.length}" height="${height+40}"><rect width="100%" height="100%" fill="#1a2029"/>`;
 for(const [i,f] of floors.entries()){
 svg+=`<g transform="translate(${i*width},40)"><text x="20" y="-15" fill="white" font-size="10">${name} floor ${f} / green=low orange=edge</text>`;
 for(const b of [...l.walls,...l.blockers].filter(b=>(b.floor??0)===f))svg+=`<rect x="${x(b.x-b.w/2)}" y="${z(b.z-b.d/2)}" width="${b.w*scale}" height="${b.d*scale}" fill="#596270"/>`;
 for(const s of spots.filter(s=>s.floor===f))svg+=`<circle cx="${x(s.x)}" cy="${z(s.z)}" r="2" fill="${s.kind==='low'?'#60e7a4':'#ffb65d'}"><title>${s.block} #${s.id}</title></circle>`;
 svg+='</g>';}
 writeFileSync(new URL(name+'-cover-map.svg',out),svg+'</svg>');
}
writeFileSync(new URL('stageA-audit.json',out),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
