export const PISTOL_ADJUSTMENTS=[
 {id:'torso',label:'胴のひねり',limit:8},
 {id:'shoulder',label:'右肩を引く',limit:8},
 {id:'elbow',label:'右肘を上げる',limit:20},
 {id:'freeArm',label:'左腕を前に出す',limit:15},
] as const;
export type PistolTuning=Record<typeof PISTOL_ADJUSTMENTS[number]['id'],number>;
export const DEFAULT_PISTOL_TUNING:Readonly<PistolTuning>={torso:0,shoulder:0,elbow:0,freeArm:0};
const STORAGE_KEY='clean-hands.agent-pistol.v1';

function sanitize(value:unknown):PistolTuning{
 const tuning={...DEFAULT_PISTOL_TUNING};
 if(!value||typeof value!=='object')return tuning;
 const fields=value as Record<string,unknown>;
 for(const {id,limit} of PISTOL_ADJUSTMENTS){
  const number=fields[id];
  if(typeof number==='number'&&Number.isFinite(number))tuning[id]=Math.max(-limit,Math.min(limit,Math.round(number)));
 }
 return tuning;
}

export function loadPistolTuning():PistolTuning{
 try{return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)??'null'));}
 catch{return {...DEFAULT_PISTOL_TUNING};}
}

export function savePistolTuning(tuning:PistolTuning):boolean{
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(sanitize(tuning)));return true;}
 catch{return false;}
}
