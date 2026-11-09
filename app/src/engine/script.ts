// 2026-11-10 (Issue #1): a map's mission script fills in only what the map has. A map without chances, hold-E spots,
// a poison or VIP protection leaves those members out, and the engine gets harmless stand-ins here instead of every
// map writing dummy methods.
import type {MissionScript} from './types.ts';

const STAND_INS:{[K in keyof MissionScript]?:()=>unknown}={
 chances:()=>({track:()=>{}}),flags:()=>new Set<string>(),notices:()=>[],reactionText:()=>'',reactionUntil:()=>0,
 locked:()=>false,tampering:()=>false,
 step:()=>()=>false,prompt:()=>()=>null,seek:()=>()=>{},beforeAi:()=>()=>{},afterAi:()=>()=>{},
 chanceSnapshot:()=>()=>[],snapshot:()=>()=>({kills:[]}),
};
/** The script with every member the engine reads; the map's own members win. */
export function withScriptDefaults(script:Partial<MissionScript>):MissionScript{
 for(const [key,make] of Object.entries(STAND_INS))if(!(key in script))Object.defineProperty(script,key,{value:make!(),writable:true,configurable:true});
 return script as MissionScript;
}
