// The loadout rules (2026-11-06), shared by the planning screen in the UI lab (menus.ts) and, once it is finished, the game.
// - One gun at most. It is carried in through the frisk, or left in advance at one pickup (HITMAN's agency pickup):
//   the pickup is where that one gun waits, never a second gun.
// - The gear slots hold different tools, no more than the mission's toolSlots; the fixed tools (the wire) always come.
// - Only open starts can be chosen.
// Anything saved by an older screen (pickupItem, two guns, unknown ids) is cleaned to these rules.
export type Choice={id:string;label:string;note?:string;open?:boolean};
export type Pickup={id:string;label:string;note?:string;x:number;z:number;floor:number};
export type LoadoutMission={tools:Choice[];toolSlots:number;fixedTools:Choice[];pistols:Choice[];starts:Choice[];pickups?:Pickup[]};
export type Loadout={tools:string[];pistol:string;start:string;pickup:string};

export const GUN_LIMIT=1;

export function defaultLoadout(m:LoadoutMission):Loadout{
 return {tools:m.tools.map(t=>t.id).slice(0,m.toolSlots),pistol:'',start:m.starts.find(s=>s.open!==false)?.id??'',pickup:''};}

/** Every gun the loadout brings into the mission, wherever it waits. */
export function loadoutGuns(l:Loadout):{id:string;at:'carried'|string}[]{return l.pistol?[{id:l.pistol,at:l.pickup||'carried'}]:[];}

/** Bring anything (a saved loadout, a half-edited plan) into the rules. */
export function cleanLoadout(raw:unknown,m:LoadoutMission):Loadout{
 const base=defaultLoadout(m),r=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>,str=(v:unknown)=>typeof v==='string'?v:'';
 const guns=new Set(m.pistols.map(p=>p.id).filter(Boolean)),tools=new Set(m.tools.map(t=>t.id)),pickups=new Set((m.pickups??[]).map(p=>p.id));
 // An older screen kept a second gun for the pickup (pickupItem): the carried gun wins; a pickup gun alone becomes the one gun.
 let pistol=str(r.pistol),pickup=str(r.pickup);const legacy=str(r.pickupItem);
 if(!guns.has(pistol))pistol='';
 if(!pistol&&guns.has(legacy)){pistol=legacy;}else if(legacy&&pistol)pickup='';
 if(!pistol||!pickups.has(pickup))pickup='';
 const list=Array.isArray(r.tools)?r.tools.filter((t):t is string=>typeof t==='string'&&tools.has(t)):base.tools;
 const start=m.starts.some(s=>s.id===str(r.start)&&s.open!==false)?str(r.start):base.start;
 return {tools:[...new Set(list)].slice(0,m.toolSlots),pistol,start,pickup};}

/** Why a choice cannot be made right now ('' when it can). */
export function blockedReason(l:Loadout,m:LoadoutMission,slot:'pistol'|'pickup'|'gear0'|'gear1'|'start',id:string):string{
 if(slot==='pickup')return id&&!l.pistol?'先に銃を選ぶ':'';
 if(slot==='gear0'||slot==='gear1'){const other=l.tools[slot==='gear0'?1:0]??'';return id&&id===other?'もう一方の枠に入っている':'';}
 if(slot==='start')return m.starts.find(s=>s.id===id)?.open===false?'まだ選べない':'';
 return '';}

/** One choice applied; the result is always within the rules. */
export function choose(l:Loadout,m:LoadoutMission,slot:'pistol'|'pickup'|'gear0'|'gear1'|'start',id:string):Loadout{
 if(blockedReason(l,m,slot,id))return l;
 if(slot==='pistol')return cleanLoadout({...l,pistol:id,pickup:id?l.pickup:''},m);
 if(slot==='pickup')return cleanLoadout({...l,pickup:id},m);
 if(slot==='start')return cleanLoadout({...l,start:id},m);
 const t=[l.tools[0]??'',l.tools[1]??''];t[slot==='gear0'?0:1]=id;return cleanLoadout({...l,tools:t.filter(Boolean)},m);}
