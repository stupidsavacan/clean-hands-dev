import {FLASH_THROW_SECONDS} from '../flash-motion.ts';
import party from '../data/party.json' with {type:'json'};
import {ladderOf,traversalParts,traversalSeconds,type Traversal} from '../party/traversal.ts';
import type {LadderMove} from '../ladder-motion.ts';
import {WALK_SPEED,RUN_SPEED,CROUCH_SPEED} from '../locomotion.ts';
import type {MotionKind} from '../motion.ts';
import {PICKUP_SECONDS} from '../motion-runtime.ts';
import {COMBAT_SECONDS,COMBAT_LOOPS,type CombatKind} from '../combat-motion.ts';
import {MELEE} from '../melee.ts';
import {COIN_PICKUP_SECONDS} from '../coin-pickup.ts';
import {RESCUE_SECONDS} from '../body-rescue.ts';

export type Clip={id:string;group:string;label:string;seconds:number;loop:boolean;
 loco?:{speed:number;crouch:number};gesture?:string;m3?:MotionKind;combat?:CombatKind;
 // A tool in the right hand (hold-pose.ts), with the walk in `loco`.
 item?:string;
 flashThrow?:'stand'|'walk'|'cover';coinPickup?:true;weaponPickup?:true;traversal?:{link:Traversal;reverse:boolean;from:number};
 // 2026-11-06: one swing or stab with the item (hold-pose.ts strikePose, melee.ts), as the game plays it.
 strike?:'blunt'|'blade';
 // 2026-11-08 (M06): hands up for a fake surrender (hold-pose.ts surrenderPose), as the game plays it.
 surrender?:boolean;
 pair?:'brawl'|'punch'|'katana-front'|'katana-back'|'rescue'};
const LOCO:[string,string,number,number][]=[['idle','立ち',0,0],['walk','歩き',WALK_SPEED,0],['run','走り',RUN_SPEED,0],['crouch','しゃがみ歩き',CROUCH_SPEED,1],['crouch-idle','しゃがみ',0,1]];
const GESTURES:[string,string][]=[['phone','電話'],['radio','無線'],['drink','飲む'],['tasting','試飲'],['speech','スピーチ'],['chat','談笑'],['camera','撮影'],['photo','記念撮影'],['tour','見学'],['inspect','点検'],['cook','料理'],['clean','掃除'],['mop_floor','床をモップで拭く'],['massage_work','施術'],['work','仕事'],['serve','給仕'],['club_press','ボタンを押す'],['dance','ダンス'],['massage','マッサージを受ける']];
const M3:[MotionKind,string,number][]=[['ko','気絶させる',2],['kill','ワイヤー',2.5],['fall','倒れる',.9],['pickup','持ち上げる',PICKUP_SECONDS],['drag','引きずる',1.2],['drop','置く',.65],['hide','収納',2]];
const COMBAT:[CombatKind,string][]=[['draw','銃を出す'],['holster','しまう'],['aim','構える'],['fire','撃つ'],['reload','弾を込める'],['hit','撃たれる'],['cover','隠れる'],['coverAim','隠れて構える'],['flee','逃げる'],['duck','伏せる']];
// A ladder that belongs to no map: 3.5 m from a floor up through a hatch, the landing behind the climber.
export const SAMPLE_LADDER:Traversal={id:'sample',a:'',b:'',kind:'ladder',start:{x:0,y:0,z:0},via:[{x:0,y:3.5,z:0}],end:{x:0,y:3.5,z:-1.4}};
const LADDER_CLIPS:[string,string,boolean,LadderMove|null][]=[
 ['mount','取り付く（下から）',false,'mount'],['climb','登る',false,'climb'],['exit-top','上で降りる',false,'exit-top'],
 ['mount-top','取り付く（上から）',true,'mount-top'],['descend','降りる',true,'descend'],['exit-bottom','下で離れる',true,'exit-bottom'],
 ['up','登って上がる（通し）',false,null],['down','上から降りる（通し）',true,null],
];
/** Where a traversal clip is at t seconds of itself (0..1 of its whole link). */
export const clipTraversalProgress=(clip:Clip,t:number)=>clip.traversal?(clip.traversal.from+Math.min(t,clip.seconds))/traversalSeconds(clip.traversal.link):0;
export const CLIPS:Clip[]=[
 ...(['stand','walk','cover'] as const).map((mode)=>({id:'flash-throw-'+mode,group:'警備の投擲',label:'フラッシュを投げる・'+({stand:'立ち',walk:'歩きから',cover:'遮蔽から'}[mode]),seconds:FLASH_THROW_SECONDS,loop:false,flashThrow:mode})),
 ...LOCO.map(([id,label,speed,crouch])=>({id:'loco-'+id,group:'移動',label,seconds:2,loop:true,loco:{speed,crouch}})),
 // 2026-11-05: carrying a tool (HITMAN WoA carry research): the same walk, the right arm holds it.
 ...[['wrench','スパナ'],['bottle','ボトル'],['mop','モップ'],['briefcase','ブリーフケース'],['toolbox','工具箱'],['katana','刀']].flatMap(([item,name])=>LOCO.map(([id,label,speed,crouch])=>({id:`item-${item}-${id}`,group:'持ち物',label:`${name}・${label}`,seconds:2,loop:true,loco:{speed,crouch},item}))),
 {id:'coin-pickup',group:'持ち物',label:'コインを拾う',seconds:COIN_PICKUP_SECONDS,loop:false,coinPickup:true},
 {id:'weapon-pickup',group:'持ち物',label:'落下銃を回収する',seconds:COIN_PICKUP_SECONDS,loop:false,weaponPickup:true},
 ...Object.entries(MELEE).map(([item,m])=>({id:'strike-'+item,group:'道具攻撃',label:`${m.label}で${m.kind==='blunt'?'殴る':m.swing?'斬る':'刺す'}`,seconds:m.seconds,loop:true,loco:{speed:0,crouch:0},item,strike:m.swing??m.kind})),
 // 2026-11-06: the fight with a guard (M02) and the single punch (M01), the agent and the first NPC facing each other.
 // M15: the sword from behind stabs instead of cutting (full spec row 14).
 {id:'surrender',group:'素手',label:'投降する（ふり）',seconds:1.4,loop:true,loco:{speed:0,crouch:0},surrender:true},
 {id:'strike-katana-back',group:'道具攻撃',label:'刀で刺す（背後から）',seconds:.7,loop:true,loco:{speed:0,crouch:0},item:'katana',strike:'blade'},
 {id:'pair-katana-front',group:'格闘（2人）',label:'刀・正面（袈裟斬り）',seconds:1.0,loop:true,pair:'katana-front'},
 {id:'pair-katana-back',group:'格闘（2人）',label:'刀・背後（口を押さえて突く）',seconds:1.0,loop:true,pair:'katana-back'},
 {id:'pair-brawl',group:'格闘（2人）',label:'警備との格闘（右・左・右）',seconds:2.8,loop:true,pair:'brawl'},
 {id:'pair-punch',group:'格闘（2人）',label:'素手で殴る（一般人）',seconds:1.4,loop:true,pair:'punch'},
 {id:'pair-rescue',group:'救助（2人）',label:'気絶者を起こす',seconds:RESCUE_SECONDS,loop:false,pair:'rescue'},
 ...GESTURES.map(([id,label])=>({id:'gesture-'+id,group:'予定の仕草',label,seconds:8,loop:true,gesture:id})),
 ...M3.map(([id,label,seconds])=>({id:'m3-'+id,group:'背後アクション',label,seconds,loop:id==='drag',m3:id})),
 ...COMBAT.map(([id,label])=>({id:'combat-'+id,group:'戦闘',label,seconds:COMBAT_SECONDS[id],loop:COMBAT_LOOPS.includes(id),combat:id})),
 // 2026-11-09: the ladder is one generic motion (ladder-motion.ts) like aiming or running, shown on a sample ladder
 // that is no map's: every ladder and drainpipe in every map plays these same moves.
 ...LADDER_CLIPS.map(([id,label,reverse,part])=>{
  const parts=traversalParts(SAMPLE_LADDER,reverse)!,p=part&&parts.find(x=>x.kind===part)!;
  return {id:'ladder-'+id,group:'はしご',label,seconds:p?p.seconds:traversalSeconds(SAMPLE_LADDER),loop:part==='climb'||part==='descend',
   traversal:{link:SAMPLE_LADDER,reverse,from:p?p.start:0}};
 }),
 // Windows and ledges still follow each map's path.
 ...[['party','パーティー',party.traversals]].flatMap(([map,label,links])=>
  (links as Traversal[]).filter(link=>!ladderOf(link)).flatMap(link=>[false,true].map(reverse=>({
   id:'traversal-'+map+'-'+link.id+(reverse?'-reverse':''),group:'窓・縁',
   label:label+' '+link.id+' '+({ledge:'縁',window:'窓'}[link.kind as 'ledge']??link.kind)+(reverse?'（逆方向）':''),
   seconds:traversalSeconds(link),loop:false,traversal:{link,reverse,from:0},
  })))),
];
