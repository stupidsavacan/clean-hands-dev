/** F01: one rule for what may be carried, seen and taken through a checkpoint in each outfit.
 * weapons.json, detection.json items and rules.json m4.items each describe some things; they are merged into one
 * master here so the frisk, the watchers and the HUD cannot disagree (the SMG allowed for guards but found by a frisk). */
export type Legality='illegal'|'suspicious'|'normal';
// holstered: concealed on the body; slung: carried in view (a long gun on the back, a tool); drawn: in hand, pointed.
export type CarryMode='holstered'|'slung'|'drawn';
// What a checkpoint lets through beyond the outfit's own rules.
export type WeaponPolicy='inherit'|'no_long_guns'|'no_weapons';
export type MasterItem={id:string;label:string;legality:Legality;concealable:boolean;friskDetect:boolean;allowedFor:string[];weapon:boolean;long:boolean};
export type ItemMaster=Record<string,MasterItem>;
type Source={label?:string;legality?:string;concealable?:boolean;friskDetect?:boolean;allowedFor?:string[];class?:string;noise?:string};
export type Legal={possessionAllowed:boolean;visibleCarryAllowed:boolean;friskContraband:boolean;prohibitedHere:boolean;reason:string};

/** Merges the tables (keys starting with _ are notes). The first table that says something about a field wins,
 * except allowedFor, which is the union: an outfit allowed in one table is allowed everywhere. */
export function itemMaster(...tables:Record<string,unknown>[]):ItemMaster{const out:ItemMaster={},frisk=new Set<string>();
 for(const t of tables)for(const [id,raw] of Object.entries(t)){if(id.startsWith('_')||!raw||typeof raw!=='object')continue;const s=raw as Source,weapon=!!s.class||!!s.noise;
  const m=out[id]??=({id,label:id,legality:(s.legality??'normal') as Legality,concealable:s.concealable??true,friskDetect:true,allowedFor:[],weapon:false,long:false});
  if(m.label===id&&s.label)m.label=s.label;if(s.friskDetect!==undefined&&!frisk.has(id)){frisk.add(id);m.friskDetect=s.friskDetect;}
  for(const a of s.allowedFor??[])if(!m.allowedFor.includes(a))m.allowedFor.push(a);if(weapon){m.weapon=true;m.long||=s.class==='long';}}
 return out;}

/** Whether `id` carried as `mode` is fine in `disguise`, would be found by a frisk, or is barred at this checkpoint. */
export function evaluateItemLegality(master:ItemMaster,id:string,disguise:string,mode:CarryMode,ctx:{weaponPolicy?:WeaponPolicy}={}):Legal{const it=master[id];
 if(!it)return {possessionAllowed:true,visibleCarryAllowed:true,friskContraband:false,prohibitedHere:false,reason:''};
 const allowed=it.legality==='normal'||it.allowedFor.includes(disguise);
 // A gun in hand is a threat in any outfit; a thing kept out of sight is seen by nobody.
 const visibleCarryAllowed=mode==='holstered'?true:mode==='drawn'&&it.weapon?false:allowed;
 const friskContraband=it.legality!=='normal'&&it.friskDetect&&!allowed;
 const policy=ctx.weaponPolicy??'inherit',prohibitedHere=it.weapon&&(policy==='no_weapons'||policy==='no_long_guns'&&it.long);
 const reason=prohibitedHere?`${it.label}はこの検問を通せない`:friskContraband?`${it.label}は検査で見つかる`:!visibleCarryAllowed?(mode==='drawn'?`${it.label}を構えている`:`${it.label}はこの服では持ち歩けない`):'';
 return {possessionAllowed:allowed,visibleCarryAllowed,friskContraband,prohibitedHere,reason};}

/** How a thing is carried when the caller does not know better: hidden if it can be, else in view. */
export function defaultCarry(master:ItemMaster,id:string):CarryMode{return master[id]?.concealable===false?'slung':'holstered';}
