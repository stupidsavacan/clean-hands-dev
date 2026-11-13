// 星見岳天文台 (2026-11-13): a mountain observatory on a storm night, run by the shared engine, with a world
// simulation of its own under it (src/sim: the storm, the electricity, the air) that the people react to.
// Map and schedule come from scripts/build-observatory.ts; the simulation's numbers from data/observatory-systems.json;
// what people do about the world from observatory/script.ts; the picture, panel and sound from this folder.
import {runGame,type GameDef} from '../engine/game';
import {buildGameMap,type MapLayout} from '../map-layout';
import layout from '../data/observatory-layout.json';
import schedule from '../data/observatory-schedule.json';
import systems from '../data/observatory-systems.json';
import config from '../data/observatory-mission.json';
import look from '../data/observatory-look.json';
// Rules, weapons and items are shared game settings.
import rules from '../data/club-rules.json';
import combat from '../data/club-combat.json';
import detection from '../data/club-detection.json';
import crowd from '../data/club-crowd.json';
import clubMission from '../data/club-mission.json';
import type {CrowdData} from '../engine/crowd';
import type {LookData} from '../engine/types';
import {ObservatoryWorld,type SystemsDef} from './world';
import {ObservatoryScript,type ObservatoryConfig} from './script';
import {buildScenery} from './scenery';
import {Panel} from './panel';
import {Sound} from './sound';

const map=buildGameMap(layout as unknown as MapLayout&Record<string,unknown>,{section:{id:'observatory',label:'天文台',surface:'asphalt'}});
// What the outfits are called here.
const stageRules=structuredClone(rules) as unknown as GameDef['rules']&{disguises:Record<string,{label:string}>};
Object.assign(stageRules.disguises.suit,{label:'来館者'});Object.assign(stageRules.disguises.manager,{label:'研究員'});
Object.assign(stageRules.disguises.technician,{label:'設備技師'});Object.assign(stageRules.disguises.bartender,{label:'食堂係'});
Object.assign(stageRules.disguises.cleaner,{label:'清掃員'});Object.assign(stageRules.disguises.guard,{label:'警備員'});

const mission={
 title:'嵐の観望会',targets:['director'],
 briefing:[{id:'director',label:'所長',text:'衛星追跡データを横流ししている天文台の所長。台風で観望会は中止、後援者たちと山上に閉じ込められている。嵐・電気・空気を使え。'}],
 tools:clubMission.tools,toolSlots:clubMission.toolSlots,fixedTools:clubMission.fixedTools,pistols:clubMission.pistols,
 starts:[{id:'S1',label:'正門',open:true,note:'前庭の駐車場から'}],
 pickups:[{id:'P1',label:'西の裏手の木箱',note:'発電機小屋へ向かう途中',x:7.6,z:15.6,floor:0}],
 cases:clubMission.cases,cleaners:['cleaner'],devices:[],
};
const worldItems=[
 {id:'wrench-gen',item:'wrench',x:6.6,z:33.4,floor:0},{id:'crowbar-pier',item:'crowbar',x:23.6,z:36.9,floor:0},
 {id:'hammer-plant',item:'hammer',x:38.2,z:34.4,floor:0},{id:'brick-north',item:'brick',x:16,z:40.6,floor:0},
 {id:'knife-lounge',item:'kitchen_knife',x:16.9,z:18.6,floor:0},
];
const clothes=[
 {id:'uniform-tech',disguise:'technician',pos:{x:6.4,y:0,z:29},},
 {id:'coat-researcher',disguise:'manager',pos:{x:41.6,y:0,z:20.8}},
 {id:'uniform-cleaner',disguise:'cleaner',pos:{x:44.8,y:0,z:17.2}},
];

// The world and script of the mission being played (a restart makes new ones); the picture, panel and sound read them.
let live:{world:ObservatoryWorld;script:ObservatoryScript}|undefined;
const sound=new Sound(),panel=new Panel(on=>sound.set(on));

runGame({
 map,schedule,mission,look:look as unknown as LookData,rules:stageRules,
 detection:{...detection,worldItems,blend:[],monitor:{...detection.monitor,id:''}},
 combat:{...combat,placed:[]},dialogue:{},actions:{radius:1.3,clothes,acts:[]},chances:{},
 crowd:{...crowd,places:[]} as CrowdData,
 createScript:c=>{
  const world=new ObservatoryWorld(systems as unknown as SystemsDef);
  const script=new ObservatoryScript(c,world,structuredClone(config) as unknown as ObservatoryConfig);
  live={world,script};
  return script;
 },
 // Drawn by scenery.ts instead of as plain boxes.
 decoratedBlockers:new Set(['mount-telescope','machine-generator','tank-day','tank-fuel','tank-nitrogen','dewar-cryo','stove-lounge','orrery-lobby','panel-main','mast-weather','pole-line']),
 decorate:ctx=>{
  const scenery=buildScenery(ctx,layout.rooms,config.acts,()=>live&&{world:live.world,here:{room:live.script.zone(position),outdoor:live.script.here.outdoor}});
  const position={x:28,y:0,z:2};
  return {
   afterFreeze:scenery.afterFreeze,
   step:(seconds,frame,dark,missionSeconds,view)=>{
    if(view)Object.assign(position,view.player);
    scenery.step!(seconds,frame,dark,missionSeconds,view);
    if(!live)return;
    panel.update({world:live.world,here:live.script.here,forecast:live.script.flags.has('forecast')},seconds);
    sound.step(live.world,position,live.script.here.outdoor,seconds);
   },
  };
 },
 text:{
  mapTitle:'OBSERVATORY',mapLabel:'星見岳天文台',
  pause:'嵐の夜の天文台。天候・電力・空気が連鎖して動いています。',
  help:'<h2>星見岳天文台 ― 嵐の観望会</h2><p>この地図では、嵐（雷雨）・電気（送電線、発電機、ブレーカー）・空気（気温、酸素）が互いに影響しあい、人はそれに反応して動きます。</p><p>停電すると発電機が動き、暖房が切られます。寒くなると人は談話室の薪ストーブに集まります。雷鳴の間は物音が届きにくくなります。暗い部屋では人の目が利きません。</p><p>黄色い輪の場所で E を長押しすると、ブレーカー・弁・ケーブルを操作できます。掲示やメモ（職員廊下、架台室、電気室）と2階の気象モニターが手がかりです。右上の表示で、今いる場所の明かり・気温・酸素が分かります。</p><p>WASDで移動。Shiftで走る。Vで視点切替。Tabで地図。Escで一時停止。</p>',
  prepEyebrow:'星見岳天文台 · 準備',loadSmall:'星見岳天文台',loading:'天文台を準備しています。',
  brief:'所長を排除して脱出してください。',
  targetDown:'ターゲットを排除した。正門（X1）か西の登山道（X2）から脱出する。',
  venue:'天文台',
  hint:'黄色い輪で E 長押し：ブレーカー・弁・ケーブル。掲示と保守メモ、2階の気象モニターが手がかり。',
 },
});
Object.assign(window,{__observatory:{snapshot:()=>live?.script.snapshot(),operate:(id:string)=>live?.script.operate(id),world:()=>live?.world}});
