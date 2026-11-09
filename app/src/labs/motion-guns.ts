import type {WeaponClass} from '../combat-motion.ts';
import {COMBAT_MODELS} from '../combat-data.ts';
import {GUN_LIST,GUN_MODELS} from '../gun-data.ts';
// Every gun model (2026-11-06): the game's M5.5 guns, and the generic ones in their detailed and simple versions
// (assets/guns, assets/guns-simple). cls is the hold (combat-motion.ts): one hand or two.
export const GUNS:{id:string;label:string;cls:WeaponClass;b64:string}[]=[
 ...([['pistol_guard','警備の拳銃','pistol'],['pistol_silenced','消音ピストル','pistol'],['tranq_pistol','鎮静ダーツ銃','pistol'],['smg','短機関銃','long'],['rifle_npc','突撃銃（NPC専用）','long']] as const).map(([id,label,cls])=>({id:'m55:'+id,label:`${label}（ゲーム中）`,cls,b64:COMBAT_MODELS[id]})),
 ...GUN_LIST.map(g=>({id:g.id,label:g.label,cls:g.cls,b64:GUN_MODELS[g.id]})),
];
