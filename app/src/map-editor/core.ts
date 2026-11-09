// 2026-11-10: the map editor's model, shared by the page (labs/map-lab.ts), Claude (window.__mapLab in the page and
// scripts/map-check.ts in node) and the tests. Everything a person does with the mouse is one of these operations, so
// what Claude can do and what a person can do are the same thing, and both are undone the same way.
import {compileMapGeometry,type MapLayout} from '../map-layout.ts';
import {CollisionWorld,inside,surfaces,type Level,type Position,type Rect} from '../world.ts';
import {NavGrid} from '../nav.ts';
import {segmentClear,sightBoxes} from '../sight.ts';

export type Doc=MapLayout&Record<string,unknown>&{devices?:Record<string,unknown>[]};
export type Shape='rect'|'box'|'point'|'route'|'path';
export type KindId='rooms'|'stairs'|'platforms'|'shafts'|'walls'|'furniture'|'doors'|'npcs'|'schedulePlaces'|'hides'|'exits'|'checkpoints'|'devices'|'traversals'|'spawn';
type KindDef={label:string;shape:Shape;color:string;
 // Where the items live in the document; schedulePlaces is an object keyed by id, spawn a single point.
 path:string[];keyed?:boolean;single?:boolean;
 make:(at:{x:number;z:number;w?:number;d?:number},floor:number,y:number)=>Record<string,unknown>};
const r2=(v:number)=>Math.round(v*100)/100;
export const KINDS:Record<KindId,KindDef>={
 rooms:{label:'部屋',shape:'rect',color:'#3d5266',path:['rooms'],make:({x,z,w=4,d=3},floor)=>({id:'R'+stamp(),label:'新しい部屋',floor,type:'public',minX:r2(x),minZ:r2(z),maxX:r2(x+w),maxZ:r2(z+d),surface:'carpet',indoor:true,allowedDisguises:[]})},
 stairs:{label:'階段',shape:'rect',color:'#6c5a8c',path:['stairs'],make:({x,z,w=2,d=7},floor,y)=>({id:'S'+stamp(),minX:r2(x),minZ:r2(z),maxX:r2(x+w),maxZ:r2(z+d),low:y,high:y+3.5,rise:'+z',floor})},
 platforms:{label:'台（ステージ）',shape:'rect',color:'#5b6b47',path:['platforms'],make:({x,z,w=4,d=3})=>({id:'P'+stamp(),minX:r2(x),minZ:r2(z),maxX:r2(x+w),maxZ:r2(z+d),y:.28})},
 shafts:{label:'吹き抜け（床の穴）',shape:'rect',color:'#222a33',path:['geometry','shafts'],make:({x,z,w=1.2,d=1.2},floor)=>({minX:r2(x),minZ:r2(z),maxX:r2(x+w),maxZ:r2(z+d),floor:Math.max(1,floor)})},
 walls:{label:'壁',shape:'box',color:'#c9b38f',path:['walls'],make:({x,z,w=3,d=.2},floor,y)=>({id:'wall-'+stamp(),x:r2(x+w/2),z:r2(z+d/2),w:r2(w),d:r2(d),h:3.4,y,floor})},
 furniture:{label:'家具',shape:'box',color:'#9b7b62',path:['furniture'],make:({x,z,w=1,d=.6},floor,y)=>({id:'furniture-'+stamp(),x:r2(x+w/2),z:r2(z+d/2),w:r2(w),d:r2(d),h:.9,y,floor})},
 doors:{label:'扉',shape:'box',color:'#e0a95a',path:['doors'],make:({x,z,w=1,d=.14},floor,y)=>({id:'door-'+stamp(),label:'扉',x:r2(x+w/2),z:r2(z+d/2),w:r2(w),d:r2(d),y,h:2.2,floor})},
 npcs:{label:'NPC（巡回）',shape:'route',color:'#b49cff',path:['npcs'],make:({x,z},floor)=>({id:'npc_'+stamp(),label:'新しいNPC',role:'guest',outfit:'suit',model:'guest_suit',floor,route:[[r2(x),r2(z),0]],faction:'club',securityRole:'',combatProfile:'civilian',disguiseId:'suit',knowsFaces:[]})},
 schedulePlaces:{label:'予定の場所',shape:'point',color:'#6fd6c4',path:['schedulePlaces'],keyed:true,make:({x,z},_floor,y)=>({x:r2(x),y,z:r2(z),heading:0,label:'新しい場所',outdoor:false})},
 hides:{label:'隠れ場所',shape:'point',color:'#8fd16f',path:['hides'],make:({x,z},_floor,y)=>({id:'hide-'+stamp(),label:'隠れ場所',x:r2(x),y,z:r2(z),heading:0,capacity:1,approach:{x:0,z:1},size:{w:.65,d:.55,h:1.9}})},
 exits:{label:'出口',shape:'point',color:'#ff8a6b',path:['exits'],make:({x,z},floor)=>({id:'E'+stamp(),label:'出口',x:r2(x),z:r2(z),floor,radius:1})},
 checkpoints:{label:'検問',shape:'point',color:'#ffd36b',path:['checkpoints'],make:({x,z},_floor,y)=>({id:'check-'+stamp(),label:'検問',x:r2(x),y,z:r2(z),width:2.8,normal:{x:0,z:-1},zone:'public',guardId:'',weaponPolicy:'no_weapons',exempt:[]})},
 devices:{label:'設備',shape:'point',color:'#7fb7ff',path:['devices'],make:({x,z},floor,y)=>({id:'device-'+stamp(),kind:'radio',label:'設備',x:r2(x),z:r2(z),y,floor,heading:0,approach:{x:r2(x),z:r2(z+.8)}})},
 traversals:{label:'はしご・窓・縁',shape:'path',color:'#e8c070',path:['traversals'],make:({x,z},_floor,y)=>({id:'X'+stamp(),a:'',b:'',kind:'ladder',start:{x:r2(x),y,z:r2(z)},via:[{x:r2(x),y:y+3.5,z:r2(z)}],end:{x:r2(x),y:y+3.5,z:r2(z-1.4)}})},
 spawn:{label:'開始地点',shape:'point',color:'#ffffff',path:['spawn'],single:true,make:({x,z})=>({x:r2(x),z:r2(z)})},
};
// Drawn and picked bottom to top: a click takes the topmost small thing before the room under it.
export const DRAW_ORDER:KindId[]=['rooms','platforms','stairs','shafts','furniture','walls','doors','traversals','npcs','schedulePlaces','hides','checkpoints','devices','exits','spawn'];
let counter=0;
function stamp(){return Date.now().toString(36).slice(-4)+(counter++).toString(36);}

/** One item: its kind and where it sits (array index, or the key of a keyed kind). */
export type Ref={kind:KindId;key:string|number};
export type Item={ref:Ref;value:Record<string,any>};
export const sameRef=(a:Ref|null|undefined,b:Ref|null|undefined)=>!!a&&!!b&&a.kind===b.kind&&a.key===b.key;
export const refText=(r:Ref)=>r.kind+':'+r.key;

function container(doc:Doc,kind:KindId):any{let c:any=doc;for(const k of KINDS[kind].path.slice(0,-1))c=c[k]??={};return c;}
function collection(doc:Doc,kind:KindId):any{
 const def=KINDS[kind],parent=container(doc,kind),last=def.path.at(-1)!;
 if(def.single)return parent[last];
 return parent[last]??=def.keyed?{}:[];
}
export function items(doc:Doc,kind:KindId):Item[]{
 const def=KINDS[kind],c=collection(doc,kind);
 if(def.single)return c?[{ref:{kind,key:0},value:c}]:[];
 if(def.keyed)return Object.entries(c).map(([key,value])=>({ref:{kind,key},value:value as Record<string,any>}));
 return (c as Record<string,any>[]).map((value,key)=>({ref:{kind,key},value}));
}
export function get(doc:Doc,ref:Ref):Record<string,any>|undefined{
 const def=KINDS[ref.kind],c=collection(doc,ref.kind);
 return def.single?c:c?.[ref.key];
}
/** A short name for lists and messages: label, then id, then the key. */
export function nameOf(doc:Doc,ref:Ref){if(ref.kind==='spawn')return '開始地点';const v=get(doc,ref);return String(v?.label??v?.id??ref.key)+(v?.id&&v?.label?' ('+v.id+')':'');}

// --- Floors -------------------------------------------------------------------------------------------------
export function floorHeights(doc:Doc){return [{floor:0,y:0},...(doc.geometry?.floors??[])].sort((a,b)=>a.floor-b.floor);}
export function floorY(doc:Doc,floor:number){return floorHeights(doc).find(f=>f.floor===floor)?.y??floor*3.5;}
function nearestFloor(doc:Doc,y:number){return floorHeights(doc).reduce((a,b)=>Math.abs(y-a.y)<=Math.abs(y-b.y)?a:b).floor;}
/** The floor an item is drawn on (stairs show on the floor they start from). */
export function floorOfItem(doc:Doc,ref:Ref):number{
 const v=get(doc,ref);if(!v)return 0;
 if(typeof v.floor==='number')return v.floor;
 if(ref.kind==='traversals')return nearestFloor(doc,v.start.y);
 if(typeof v.y==='number')return nearestFloor(doc,v.y);
 return 0;
}

// --- Geometry of an item on the plan ------------------------------------------------------------------------
export function rectOf(doc:Doc,ref:Ref):Rect|null{
 const v=get(doc,ref),shape=KINDS[ref.kind].shape;if(!v)return null;
 if(shape==='rect')return {minX:v.minX,maxX:v.maxX,minZ:v.minZ,maxZ:v.maxZ};
 if(shape==='box')return {minX:v.x-v.w/2,maxX:v.x+v.w/2,minZ:v.z-v.d/2,maxZ:v.z+v.d/2};
 return null;
}
/** The points a person can drag: a point item's position, every patrol stop, every traversal point. */
export function handlesOf(doc:Doc,ref:Ref):{x:number;z:number;part:string}[]{
 const v=get(doc,ref),shape=KINDS[ref.kind].shape;if(!v)return [];
 if(shape==='point')return [{x:v.x,z:v.z,part:'at'}];
 if(shape==='route')return (v.route as number[][]).map((p,i)=>({x:p[0],z:p[1],part:'route.'+i}));
 if(shape==='path')return [{...v.start,part:'start'},...(v.via??[]).map((p:Position,i:number)=>({x:p.x,z:p.z,part:'via.'+i})),{...v.end,part:'end'}];
 return [];
}

// --- Editing ------------------------------------------------------------------------------------------------
/** The editor's document with undo. Every change goes through change(), which records one undo step. */
export class MapModel{
 doc:Doc;readonly name:string;private undoStack:string[]=[];private redoStack:string[]=[];
 /** Bumped on every change; the page redraws and re-checks when it moves. */
 revision=0;saved=0;
 constructor(doc:Doc,name:string){this.doc=structuredClone(doc);this.name=name;}
 get dirty(){return this.revision!==this.saved;}
 /** Apply one change (an undo step). `label` says what it was, for the history and messages. */
 change(fn:(doc:Doc)=>void){
  const before=JSON.stringify(this.doc);fn(this.doc);
  if(JSON.stringify(this.doc)===before)return false;
  this.undoStack.push(before);if(this.undoStack.length>200)this.undoStack.shift();this.redoStack=[];this.revision++;return true;
 }
 /** For a drag: one undo step for the whole drag, however many moves it makes. */
 private dragBase:string|null=null;
 beginDrag(){this.dragBase=JSON.stringify(this.doc);}
 dragTo(fn:(doc:Doc)=>void){fn(this.doc);this.revision++;}
 endDrag(){if(this.dragBase!==null&&this.dragBase!==JSON.stringify(this.doc)){this.undoStack.push(this.dragBase);this.redoStack=[];}this.dragBase=null;}
 undo(){const s=this.undoStack.pop();if(!s)return false;this.redoStack.push(JSON.stringify(this.doc));this.doc=JSON.parse(s);this.revision++;return true;}
 redo(){const s=this.redoStack.pop();if(!s)return false;this.undoStack.push(JSON.stringify(this.doc));this.doc=JSON.parse(s);this.revision++;return true;}
 get canUndo(){return this.undoStack.length>0;}get canRedo(){return this.redoStack.length>0;}

 add(kind:KindId,at:{x:number;z:number;w?:number;d?:number},floor:number,key?:string):Ref{
  const def=KINDS[kind],value=def.make(at,floor,floorY(this.doc,floor));let ref:Ref={kind,key:0};
  this.change(doc=>{
   const c=collection(doc,kind);
   if(def.single){container(doc,kind)[def.path.at(-1)!]=value;return;}
   if(def.keyed){const k=key??'place_'+stamp();c[k]=value;ref={kind,key:k};return;}
   c.push(value);ref={kind,key:c.length-1};
  });
  return ref;
 }
 remove(ref:Ref){
  const def=KINDS[ref.kind];if(def.single)return false;
  return this.change(doc=>{const c=collection(doc,ref.kind);if(def.keyed)delete c[ref.key];else c.splice(Number(ref.key),1);});
 }
 duplicate(ref:Ref):Ref|null{
  const v=get(this.doc,ref),def=KINDS[ref.kind];if(!v||def.single)return null;
  const copy=structuredClone(v);if(typeof copy.id==='string')copy.id=copy.id+'-copy';
  const shift=(o:any)=>{if(typeof o?.x==='number'){o.x=r2(o.x+.5);o.z=r2(o.z+.5);}};
  shift(copy);for(const k of ['minX','maxX'])if(typeof copy[k]==='number')copy[k]=r2(copy[k]+.5);for(const k of ['minZ','maxZ'])if(typeof copy[k]==='number')copy[k]=r2(copy[k]+.5);
  if(Array.isArray(copy.route))copy.route=copy.route.map((p:number[])=>[r2(p[0]+.5),r2(p[1]+.5),p[2]]);
  if(copy.start){shift(copy.start);shift(copy.end);(copy.via??[]).forEach(shift);}
  let out:Ref|null=null;
  this.change(doc=>{const c=collection(doc,ref.kind);if(def.keyed){const k=String(ref.key)+'_copy';c[k]=copy;out={kind:ref.kind,key:k};}else{c.push(copy);out={kind:ref.kind,key:c.length-1};}});
  return out;
 }
 /** Set fields of one item, e.g. set(ref,{label:'厨房',h:2.4}). */
 set(ref:Ref,patch:Record<string,unknown>){return this.change(doc=>{const v=get(doc,ref);if(v)Object.assign(v,patch);});}
 /** Rename a keyed item (a schedule place): the plans that use the old key follow. */
 rename(ref:Ref,key:string){
  if(!KINDS[ref.kind].keyed||!key||key===ref.key)return null;
  this.change(doc=>{
   const c=collection(doc,ref.kind);if(c[key])return;
   c[key]=c[ref.key];delete c[ref.key];
   for(const actor of Object.values((doc.actors??{}) as Record<string,{plan?:{place:string}[]}>))for(const e of actor.plan??[])if(e.place===ref.key)e.place=key;
  });
  return {kind:ref.kind,key};
 }
 move(ref:Ref,dx:number,dz:number){return this.change(doc=>moveItem(doc,ref,dx,dz));}
}
/** Move a whole item by dx, dz (rooms, boxes, points, every stop of a patrol, every point of a traversal). */
export function moveItem(doc:Doc,ref:Ref,dx:number,dz:number){
 const v=get(doc,ref),shape=KINDS[ref.kind].shape;if(!v)return;
 if(shape==='rect'){v.minX=r2(v.minX+dx);v.maxX=r2(v.maxX+dx);v.minZ=r2(v.minZ+dz);v.maxZ=r2(v.maxZ+dz);}
 else if(shape==='box'||shape==='point'){v.x=r2(v.x+dx);v.z=r2(v.z+dz);if(v.approach&&ref.kind==='devices'){v.approach.x=r2(v.approach.x+dx);v.approach.z=r2(v.approach.z+dz);}}
 else if(shape==='route')for(const p of v.route){p[0]=r2(p[0]+dx);p[1]=r2(p[1]+dz);}
 else for(const p of [v.start,...(v.via??[]),v.end]){p.x=r2(p.x+dx);p.z=r2(p.z+dz);}
}
/** Put one dragged handle (from handlesOf) at x, z. */
export function moveHandle(doc:Doc,ref:Ref,part:string,x:number,z:number){
 const v=get(doc,ref);if(!v)return;x=r2(x);z=r2(z);
 if(part==='at'){const dx=x-v.x,dz=z-v.z;moveItem(doc,ref,dx,dz);return;}
 const [name,index]=part.split('.');
 if(name==='route'){const p=v.route[Number(index)];p[0]=x;p[1]=z;return;}
 const p=name==='via'?v.via[Number(index)]:v[name];p.x=x;p.z=z;
}
/** Drag one edge or corner of a rectangle or box: edges are any of 'minX','maxX','minZ','maxZ'. */
export function resizeItem(doc:Doc,ref:Ref,edges:string[],x:number,z:number,minSize=.05){
 const v=get(doc,ref),shape=KINDS[ref.kind].shape;if(!v)return;
 const r=rectOf(doc,ref)!;x=r2(x);z=r2(z);
 if(edges.includes('minX'))r.minX=Math.min(x,r.maxX-minSize);if(edges.includes('maxX'))r.maxX=Math.max(x,r.minX+minSize);
 if(edges.includes('minZ'))r.minZ=Math.min(z,r.maxZ-minSize);if(edges.includes('maxZ'))r.maxZ=Math.max(z,r.minZ+minSize);
 if(shape==='rect')Object.assign(v,{minX:r2(r.minX),maxX:r2(r.maxX),minZ:r2(r.minZ),maxZ:r2(r.maxZ)});
 else Object.assign(v,{x:r2((r.minX+r.maxX)/2),z:r2((r.minZ+r.maxZ)/2),w:r2(r.maxX-r.minX),d:r2(r.maxZ-r.minZ)});
}

/** Items on a floor whose shape is under (x, z), topmost first. */
export function pick(doc:Doc,floor:number,x:number,z:number,radius:number,kinds:KindId[]=DRAW_ORDER):Ref[]{
 const out:Ref[]=[];
 for(const kind of [...kinds].reverse())for(const {ref} of items(doc,kind)){
  if(floorOfItem(doc,ref)!==floor&&!(ref.kind==='stairs'&&floorOfItem(doc,ref)+1===floor))continue;
  const r=rectOf(doc,ref);
  if(r?inside({minX:r.minX-radius,maxX:r.maxX+radius,minZ:r.minZ-radius,maxZ:r.maxZ+radius},x,z):handlesOf(doc,ref).some(h=>Math.hypot(h.x-x,h.z-z)<=radius*2.2))out.push(ref);
 }
 return out;
}

// --- The game's view of the map (collision, walking, sight) -------------------------------------------------
export type Probe={world:CollisionWorld;nav:NavGrid;boxes:ReturnType<typeof sightBoxes>;level:Level&Record<string,unknown>;
 /** Which connected walking area each nav cell belongs to (cells of the same number can reach each other). */
 area:Int32Array};
/** Build what the game builds from the layout (build-club.ts): colliders, floor plates, the walking grid, sight boxes. */
export function probeOf(doc:Doc):Probe{
 const compiled=compileMapGeometry(doc);
 const level={...doc,...compiled,sections:[{id:'map',label:'map',...doc.ground}]} as unknown as Level&Record<string,unknown>;
 const world=new CollisionWorld(level),nav=new NavGrid(world);
 const boxes=sightBoxes({...level,walls:compiled.walls.filter(w=>!compiled.collisionOnlyIds.includes(w.id))} as Level);
 // Connected areas over the walking grid (NavGrid keeps its neighbour search private; it is the same one A* uses).
 const area=new Int32Array(nav.nodes.length).fill(-1),next=(nav as unknown as {neighbours(i:number):Int32Array}).neighbours.bind(nav);
 let id=0;for(let s=0;s<area.length;s++){if(area[s]>=0)continue;const stack=[s];area[s]=id;while(stack.length){const i=stack.pop()!;for(const j of next(i))if(area[j]<0){area[j]=id;stack.push(j);}}id++;}
 return {world,nav,boxes,level,area};
}
/** The walking height under a point on a floor (the plate or ramp nearest that floor's height). */
export function standY(doc:Doc,probe:Probe,x:number,z:number,floor:number){
 const ys=surfaces(probe.level,x,z),want=floorY(doc,floor);
 return ys.length?ys.reduce((a,b)=>Math.abs(b-want)<Math.abs(a-want)?b:a):want;
}
export type RouteResult={blocked:'start'|'end'|null;path:Position[]|null;metres:number;sight:boolean};
/** The probe tool: can someone walk from a to b, how far, and can they see each other at eye height. */
export function routeBetween(doc:Doc,probe:Probe,a:{x:number;z:number;floor:number},b:{x:number;z:number;floor:number}):RouteResult{
 const pa={x:a.x,y:standY(doc,probe,a.x,a.z,a.floor),z:a.z},pb={x:b.x,y:standY(doc,probe,b.x,b.z,b.floor),z:b.z};
 const blocked=probe.world.blocked(pa.x,pa.y,pa.z)?'start':probe.world.blocked(pb.x,pb.y,pb.z)?'end':null;
 const path=blocked?null:probe.nav.find(pa,pb);
 let metres=0,last=pa;for(const p of path??[]){metres+=Math.hypot(p.x-last.x,p.z-last.z);last=p;}
 return {blocked,path:path&&[pa,...path],metres:r2(metres),sight:segmentClear(probe.boxes,{...pa,y:pa.y+1.55},{...pb,y:pb.y+1.55})};
}
