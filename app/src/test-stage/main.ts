// 2026-11-10 (Issue #1): a second, small map run by the same engine as the club, with NPC ids, rooms, props, exits and a
// safe room the club does not have. It has no code of its own beyond wiring engine parts to its data: if a feature
// only works with club ids, it breaks here. Open it at http://127.0.0.1:8796/test-stage.html (after npm run build:all).
import {runGame,type GameDef} from '../engine/game';
import {buildGameMap,type MapLayout} from '../map-layout';
import layout from '../data/test-stage-layout.json';
import schedule from '../data/test-stage-schedule.json';
import stage from '../data/test-stage-mission.json';
// Rules, looks, weapons and items are shared game settings, not the club's map.
import look from '../data/club-look.json';
import rules from '../data/club-rules.json';
import combat from '../data/club-combat.json';
import detection from '../data/club-detection.json';
import crowd from '../data/club-crowd.json';
import clubMission from '../data/club-mission.json';
import {Errands} from '../engine/errands';
import {VipProtection,type VipConfig} from '../engine/vip';
import {HoldActions,type HoldSpot} from '../engine/hold-actions';
import {KillEvents,TargetWatch} from '../engine/target-watch';
import {Chances} from '../chances';
import type {CrowdData} from '../engine/crowd';
import type {MissionScript} from '../engine/types';

const map=buildGameMap(layout as unknown as MapLayout&Record<string,unknown>,{section:{id:'test',label:'検証ステージ',surface:'carpet'}});
const mission={title:'検証ステージ',targets:['host'],briefing:[{id:'host',label:'主催者',text:'主催者を排除して正面玄関から出る。'}],
 tools:clubMission.tools,toolSlots:clubMission.toolSlots,fixedTools:clubMission.fixedTools,pistols:clubMission.pistols,
 starts:[{id:'T1',label:'正面玄関',open:true,note:'ロビーから入る'}],pickups:[],cases:clubMission.cases,cleaners:[],devices:[]};

runGame({
 map,schedule,mission,look,rules:rules as GameDef['rules'],
 detection:{...detection,worldItems:[],blend:[],monitor:{...detection.monitor,id:''}},
 combat:{...combat,placed:[]},dialogue:{},actions:{radius:1.3,clothes:[],acts:[]},chances:{},
 crowd:{...crowd,places:[]} as CrowdData,
 createScript:c=>{
  const flags=new Set<string>(),notices:string[]=[];
  const script:Partial<MissionScript>&{reactionText:string;reactionUntil:number}={flags,notices,reactionText:'',reactionUntil:0,chances:new Chances({},c.events)};
  const say=(text:string)=>{script.reactionText=text;script.reactionUntil=c.clock.elapsed+6;};
  const flag=(id:string,reason?:string)=>{flags.add(id);c.events.emit({type:'flag.set',time:c.clock.elapsed,id,reason});};
  const errands=new Errands(c.schedule);
  const vip=new VipProtection(c.director,c.m3,c.clock,c.events,errands,stage.vip as VipConfig,flag,say);
  const watch=new TargetWatch(c.director,errands,[vip.target]);
  watch.onGathered=(t,at,time)=>{say(`${t.label}が倒れた。周りの人が駆け寄る。`);script.onTargetDown?.(at,time);};
  const kills=new KillEvents(c.director,c.events);
  const holds=new HoldActions(stage.acts as HoldSpot[],1.3,()=>c.director.boxes,c.clock,c.events);
  holds.onComplete=s=>{flag(s.id);notices.push('作業場の明かりが消えた。');};
  return Object.assign(script,{
   get locked(){return !!holds.action;},get tampering(){return !!holds.action;},get escaped(){return vip.escaped;},
   step:(dt:number,p:Parameters<MissionScript['step']>[1],keys:Set<string>,suppressed?:boolean)=>{notices.length=0;return holds.step(dt,p,keys,suppressed);},
   prompt:(p:Parameters<MissionScript['prompt']>[0])=>holds.prompt(p),
   afterAi:()=>{vip.step(c.clock.elapsed);watch.step(c.clock.elapsed);kills.step(c.clock.elapsed);},
   // The lights in the workshop go out for good once the breaker is thrown.
   darkZones:()=>flags.has('breaker')?{works:.45}:{},
   alarm:vip.alarm.bind(vip),bodyFound:vip.bodyFound.bind(vip),
  });
 },
 text:{
  mapTitle:'TEST',mapLabel:'検証ステージ',pause:'検証用の小さな地図です。',help:'<h2>検証ステージ</h2><p>クラブと同じエンジンで、クラブにない人物・部屋・はしごを動かします。</p>',
  prepEyebrow:'検証ステージ · 準備',loadSmall:'検証ステージ',loading:'検証ステージを準備しています。',brief:'主催者を排除して脱出してください。',
  targetDown:'ターゲットを排除した。正面玄関（X）から脱出する。',hint:'奥の部屋と作業場は職員区画。照明係は作業場のはしごで上の通路へ上がる。',
 },
});
