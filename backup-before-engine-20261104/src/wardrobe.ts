// The player's look: which wardrobe meshes show (appearance.ts applies it), palette colours, body proportions and the
// personal gait. This module has no three.js / DOM dependency so the look can be validated, saved and shared in tests.
export type GaitPick={style:string;stride:number;arm:number;lean:number;sway:number;bounce:number};
export type Look={character:string;codename:string;hair:string;brow:number;outfit:'suit'|'tie';tie:'red'|'black';glasses:boolean;
 hairColor:string;skin:string;suitColor:string;shirtColor:string;tieColor:string;frameColor:string;gloveColor:string;
 height:number;shoulders:number;build:number;head:number;gait:GaitPick};
export const CHARACTERS=[{id:'wardrobe',label:'標準エージェント',note:'髪・服を自由に変更'},{id:'architect',label:'アーキテクト',note:'眼鏡の知的な人物'},{id:'operative',label:'オペレーティブ',note:'細身の工作員'},{id:'veteran',label:'ベテラン',note:'落ち着いた人物'},{id:'agent47',label:'Agent 47',note:'修正済みのローポリモデル'}];
export const HAIRS=[{id:'swept',label:'流し'},{id:'parted',label:'七三'},{id:'short',label:'短髪'},{id:'crop',label:'クロップ'},{id:'bob',label:'ボブ'},{id:'ponytail',label:'ポニーテール'},{id:'long',label:'ロング'},{id:'skinhead',label:'スキンヘッド'}];
export const OUTFITS=[{id:'suit',label:'スーツ',note:'ノーネクタイ'},{id:'tie',label:'スーツ＋シャツ',note:'白シャツにネクタイ'}] as const;
export const TIES=[{id:'red',label:'クリムゾン',color:'#c22f21'},{id:'black',label:'オニキス',color:'#2b2e35'}] as const;
// Colour swatches (the picker next to each row allows any colour).
export const SWATCHES={
 hair:['#2b2e35','#503f35','#7a5a3c','#9b7053','#b8924f','#d9c28a','#a8a8a8','#e8e4da','#8a3b2a','#3b5b8a'],
 skin:['#f2d7c4','#e8c4a8','#d9b39a','#c49272','#a8744f','#8a5a3b','#6b4630','#4a2f22'],
 suit:['#2b2e35','#1c2230','#3a3f4a','#737a82','#503f35','#3b5b8a','#17776c','#6b2a2a'],
 shirt:['#efeadf','#ffffff','#a9bcc9','#d9c9b0','#2b2e35','#f2c14e','#c22f21','#8b9c88'],
 tie:['#c22f21','#2b2e35','#3b5b8a','#17776c','#f2c14e','#503f35','#efeadf','#6b2a6b'],
 frame:['#737a82','#2b2e35','#f2c14e','#c22f21','#efeadf','#3b5b8a'],
 glove:['#c22f21','#2b2e35','#503f35','#efeadf','#3b5b8a','#d9b39a']
} as const;
// Gait presets: stride / arm / lean / sway / bounce / toe feed GaitStyle in locomotion.ts (see gaitStyleOf).
export const GAITS=[
 {id:'standard',label:'標準',note:'まっすぐ自然に',v:{stride:1,arm:1,lean:0,sway:1,bounce:1,toe:0}},
 {id:'brisk',label:'軽快',note:'歩幅が広く、弾む',v:{stride:1.1,arm:1.25,lean:.05,sway:.8,bounce:1.4,toe:0}},
 {id:'heavy',label:'重厚',note:'どっしり、腰が揺れる',v:{stride:.88,arm:.8,lean:.02,sway:1.5,bounce:.6,toe:.5}},
 {id:'stealth',label:'忍び足',note:'小さく静かに',v:{stride:.85,arm:.5,lean:.1,sway:.5,bounce:.5,toe:0}},
 {id:'proud',label:'堂々',note:'胸を張って大股',v:{stride:1.12,arm:1.1,lean:-.04,sway:1.2,bounce:1.1,toe:.3}},
 {id:'slouch',label:'猫背',note:'前かがみで脱力',v:{stride:.92,arm:.7,lean:.16,sway:1,bounce:.7,toe:0}},
 {id:'military',label:'軍人',note:'腕を大きく、ぶれない',v:{stride:1.05,arm:1.5,lean:-.02,sway:.3,bounce:.8,toe:0}},
 {id:'lazy',label:'気だるげ',note:'ゆらゆら、外股',v:{stride:1,arm:.7,lean:.06,sway:1.8,bounce:1,toe:.6}}
] as const;
export const DEFAULT_GAIT:GaitPick={style:'standard',stride:0,arm:0,lean:0,sway:0,bounce:0};
export const DEFAULT_LOOK:Look={character:'wardrobe',codename:'AGENT 07',hair:'swept',brow:0,outfit:'suit',tie:'red',glasses:true,
 hairColor:'#2b2e35',skin:'#d9b39a',suitColor:'#2b2e35',shirtColor:'#efeadf',tieColor:'#c22f21',frameColor:'#737a82',gloveColor:'#c22f21',
 height:0,shoulders:0,build:0,head:0,gait:{...DEFAULT_GAIT}};
const KEY='clean-hands.m4.look',SLOTS='clean-hands.m4.slots';
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:0))+0;
const COLOR=/^#[0-9a-f]{6}$/i;
const COLOR_KEYS=['hairColor','skin','suitColor','shirtColor','tieColor','frameColor','gloveColor'] as const;
// Accepts anything (old saves, imported codes) and returns a complete, in-range look.
export function sanitizeLook(raw:unknown):Look{const v=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>,out:Look={...DEFAULT_LOOK,gait:{...DEFAULT_GAIT}};
 if(CHARACTERS.some(c=>c.id===v.character))out.character=v.character as string;
 if(typeof v.codename==='string'&&v.codename.trim())out.codename=v.codename.trim().slice(0,16);
 if(HAIRS.some(h=>h.id===v.hair))out.hair=v.hair as string;
 if(typeof v.brow==='number')out.brow=clamp(v.brow,-1,1);
 if(v.outfit==='suit'||v.outfit==='tie')out.outfit=v.outfit;
 if(typeof v.glasses==='boolean')out.glasses=v.glasses;
 for(const k of COLOR_KEYS)if(typeof v[k]==='string'&&COLOR.test(v[k] as string))out[k]=(v[k] as string).toLowerCase();
 // Saves from before free tie colours only knew red / black.
 if(v.tieColor===undefined&&v.tie==='black')out.tieColor='#2b2e35';
 for(const k of ['height','shoulders','build','head'] as const)if(typeof v[k]==='number')out[k]=clamp(v[k] as number,-1,1);
 const g=(v.gait&&typeof v.gait==='object'?v.gait:{}) as Record<string,unknown>;
 if(GAITS.some(x=>x.id===g.style))out.gait.style=g.style as string;
 for(const k of ['stride','arm','lean','sway','bounce'] as const)if(typeof g[k]==='number')out.gait[k]=clamp(g[k] as number,-1,1);
 return out;}
export function loadLook():Look{try{const v=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('clean-hands.look')||'null');if(v)return sanitizeLook(v);}catch{/* storage unavailable */}return sanitizeLook(null);}
export function saveLook(look:Look){try{localStorage.setItem(KEY,JSON.stringify(look));}catch{/* storage unavailable */}}
export type Slot={name:string;look:Look;thumb?:string};
export function loadSlots():(Slot|null)[]{try{const v=JSON.parse(localStorage.getItem(SLOTS)||localStorage.getItem('clean-hands.slots')||'null');if(Array.isArray(v))return Array.from({length:6},(_,i)=>v[i]&&v[i].look?{name:String(v[i].name||`SLOT ${i+1}`).slice(0,16),look:sanitizeLook(v[i].look),thumb:typeof v[i].thumb==='string'?v[i].thumb:undefined}:null);}catch{/* storage unavailable */}return Array(6).fill(null);}
export function saveSlots(slots:(Slot|null)[]){try{localStorage.setItem(SLOTS,JSON.stringify(slots));}catch{/* storage unavailable */}}
// Share code: CH1.<base64url of the look as JSON>
export function encodeLook(look:Look):string{const bin=new TextEncoder().encode(JSON.stringify(look));let s='';bin.forEach(b=>s+=String.fromCharCode(b));return 'CH1.'+btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function decodeLook(code:string):Look|null{const m=/^\s*CH1\.([A-Za-z0-9_-]+)\s*$/.exec(code);if(!m)return null;try{const b64=m[1].replace(/-/g,'+').replace(/_/g,'/'),s=atob(b64+'='.repeat((4-b64.length%4)%4)),bytes=Uint8Array.from(s,c=>c.charCodeAt(0));return sanitizeLook(JSON.parse(new TextDecoder().decode(bytes)));}catch{return null;}}
// Proportions: sliders -1..1. Height is a whole-body scale (±7%), the rest are bone scales (±12%).
export const heightScale=(l:Look)=>1+l.height*.07;
export const bodyScales=(l:Look)=>({shoulders:1+l.shoulders*.12,build:1+l.build*.12,head:1+l.head*.12});
export function gaitStyleOf(p:GaitPick){const base=(GAITS.find(g=>g.id===p.style)??GAITS[0]).v;
 return {stride:base.stride*(1+p.stride*.2),arm:base.arm*(1+p.arm*.5),lean:base.lean+p.lean*.12,sway:base.sway*(1+p.sway*.6),bounce:base.bounce*(1+p.bounce*.5),toe:base.toe};}
export function visibleParts(look:Look){const parts=['Body','Face','Hair_'+look.hair];if(look.glasses)parts.push('Glasses');
 if(look.outfit==='suit')parts.push('Outfit_suit','Details_suit');else parts.push('Outfit_tie','Details_tie','Tie_red');return parts;}
export function randomLook(codename:string):Look{const pick=<X>(a:readonly X[])=>a[Math.floor(Math.random()*a.length)],r=(a=-1,b=1)=>Math.round((a+Math.random()*(b-a))*10)/10;
 return sanitizeLook({codename,hair:pick(HAIRS).id,brow:r(),outfit:pick(OUTFITS).id,glasses:Math.random()<.5,hairColor:pick(SWATCHES.hair),skin:pick(SWATCHES.skin),suitColor:pick(SWATCHES.suit),shirtColor:pick(SWATCHES.shirt.slice(0,4)),tieColor:pick(SWATCHES.tie),frameColor:pick(SWATCHES.frame),gloveColor:pick(SWATCHES.glove),
  height:r(-.6,.6),shoulders:r(-.6,.6),build:r(-.6,.6),head:r(-.4,.4),gait:{style:pick(GAITS).id,stride:0,arm:0,lean:0,sway:0,bounce:0}});}
