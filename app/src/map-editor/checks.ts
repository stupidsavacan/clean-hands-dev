// 2026-11-10: what the map editor checks after every change. The page lists these (click one to go to it), Claude reads
// the same list from window.__mapLab.check() or `npm run map:check`, and the tests run it on every map.
import {inside} from '../world.ts';
import {ladderOf,traversalPoints,type Traversal} from '../party/traversal.ts';
import {KINDS,floorOfItem,get,items,nameOf,probeOf,rectOf,standY,type Doc,type KindId,type Probe,type Ref} from './core.ts';

export type Issue={level:'error'|'warning';ref:Ref|null;text:string;at:{x:number;z:number;floor:number}|null};

/** Every problem the editor knows how to find. A map ready for the game has no errors. */
export function checkMap(doc:Doc,probe:Probe=probeOf(doc)):Issue[]{
 const out:Issue[]=[];
 const issue=(level:Issue['level'],ref:Ref|null,text:string,at:Issue['at']=null)=>out.push({level,ref,text,at});
 const g=doc.ground;
 const spot=(x:number,z:number,floor:number)=>({x,z,floor});
 // A standing spot: off any collider, and on the walking area joined to the start (so it can be reached).
 const spawnFloor=0,spawnY=standY(doc,probe,doc.spawn.x,doc.spawn.z,spawnFloor);
 const spawnNode=probe.nav.nearest({x:doc.spawn.x,y:spawnY,z:doc.spawn.z}),home=spawnNode>=0?probe.area[spawnNode]:-1;
 const stand=(ref:Ref,what:string,x:number,z:number,floor:number,reachable=true)=>{
  const at=spot(x,z,floor);
  if(!inside(g,x,z)){issue('error',ref,what+'が敷地の外にあります',at);return;}
  const y=standY(doc,probe,x,z,floor);
  if(probe.world.blocked(x,y,z)){issue('error',ref,what+'が壁や家具に重なっていて立てません',at);return;}
  if(!reachable||home<0)return;
  const n=probe.nav.nearest({x,y,z});
  if(n<0||probe.area[n]!==home)issue('warning',ref,what+'へ開始地点から歩いて行けません',at);
 };
 if(spawnNode<0||probe.world.blocked(doc.spawn.x,spawnY,doc.spawn.z))issue('error',{kind:'spawn',key:0},'開始地点が壁や家具に重なっているか、歩ける所がありません',spot(doc.spawn.x,doc.spawn.z,0));

 // The same id twice confuses scripts that look items up by id. Rooms share ids on purpose (one zone, several rectangles).
 for(const kind of ['walls','furniture','doors','npcs','hides','exits','checkpoints','devices','traversals','stairs'] as KindId[]){
  const seen=new Map<string,number>();
  for(const {ref,value} of items(doc,kind)){
   const id=String(value.id??'');
   if(!id){issue('error',ref,KINDS[kind].label+'に id がありません');continue;}
   if(kind==='stairs'&&seen.has(id))continue;
   if(seen.has(id))issue('error',ref,KINDS[kind].label+'の id「'+id+'」が重複しています',centre(doc,ref));
   seen.set(id,1);
  }
 }
 // Shapes: positive sizes, inside the grounds.
 for(const kind of ['rooms','stairs','platforms','shafts','walls','furniture','doors'] as KindId[])for(const {ref,value} of items(doc,kind)){
  const r=rectOf(doc,ref)!,c=centre(doc,ref);
  if(!(r.maxX>r.minX&&r.maxZ>r.minZ))issue('error',ref,nameOf(doc,ref)+'の幅か奥行きが0以下です',c);
  else if(r.minX<g.minX-.01||r.maxX>g.maxX+.01||r.minZ<g.minZ-.01||r.maxZ>g.maxZ+.01)issue('warning',ref,nameOf(doc,ref)+'が敷地の外にはみ出しています',c);
  if(KINDS[kind].shape==='box'&&!(value.h>0))issue('error',ref,nameOf(doc,ref)+'の高さが0以下です',c);
 }
 for(const {ref,value} of items(doc,'stairs'))if(!(value.high>value.low))issue('error',ref,'階段 '+value.id+' の上端が下端より低いです',centre(doc,ref));

 // People and places: where someone has to stand.
 for(const {ref,value} of items(doc,'npcs'))(value.route as number[][]).forEach((p,i)=>
  stand(ref,nameOf(doc,ref)+'の巡回 '+(i+1)+' 番目',p[0],p[1],value.floor??0));
 for(const {ref,value} of items(doc,'schedulePlaces'))stand(ref,'予定の場所「'+(value.label??ref.key)+'」('+ref.key+')',value.x,value.z,floorOfItem(doc,ref));
 for(const {ref,value} of items(doc,'exits'))stand(ref,'出口「'+value.label+'」',value.x,value.z,value.floor??0);
 for(const {ref,value} of items(doc,'hides')){
  const a=value.approach??{x:0,z:1};
  // The game's standing spot for a hide is its position plus approach (m3.ts).
  stand(ref,'隠れ場所「'+value.label+'」の前',value.x+a.x,value.z+a.z,floorOfItem(doc,ref));
 }
 for(const {ref,value} of items(doc,'devices'))if(value.approach)stand(ref,'設備「'+value.label+'」の操作位置',value.approach.x,value.approach.z,value.floor??0);
 // Ladders, windows, ledges: both ends must be standing spots.
 for(const {ref,value} of items(doc,'traversals')){
  const t=value as Traversal;
  for(const [end,p] of [['始点',t.start],['終点',t.end]] as const)stand(ref,'移動経路 '+t.id+' の'+end,p.x,p.z,nearest(doc,p.y));
  if((t.kind==='ladder'||t.kind==='drainpipe')&&!ladderOf(t))issue('error',ref,'はしご '+t.id+' に縦の区間（同じ位置で高さだけ変わる2点）がありません',centre(doc,ref));
  if(t.kind!=='ladder'&&t.kind!=='drainpipe'&&!(typeof t.seconds==='number'&&t.seconds>0))issue('error',ref,t.kind+' '+t.id+' には seconds（何秒で渡るか）が要ります',centre(doc,ref));
  if(traversalPoints(t).some(p=>![p.x,p.y,p.z].every(Number.isFinite)))issue('error',ref,'移動経路 '+t.id+' の座標に数でない値があります');
 }
 // Schedules that name a place that is gone.
 const places=(doc.schedulePlaces??{}) as Record<string,unknown>;
 for(const [actor,plan] of Object.entries((doc.actors??{}) as Record<string,{plan?:{place:string}[]}>))for(const e of plan.plan??[])
  if(!places[e.place])issue('error',null,'予定（'+actor+'）が無い場所「'+e.place+'」を使っています');
 return out;
}
function nearest(doc:Doc,y:number){return [{floor:0,y:0},...(doc.geometry?.floors??[])].reduce((a,b)=>Math.abs(y-a.y)<=Math.abs(y-b.y)?a:b).floor;}
/** Where to point at an item in messages and on the plan. */
export function centre(doc:Doc,ref:Ref){
 const r=rectOf(doc,ref),v=get(doc,ref),floor=floorOfItem(doc,ref);
 if(r)return {x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2,floor};
 if(v?.start)return {x:v.start.x,z:v.start.z,floor};
 if(Array.isArray(v?.route))return {x:v.route[0][0],z:v.route[0][1],floor};
 return v&&typeof v.x==='number'?{x:v.x,z:v.z,floor}:null;
}
