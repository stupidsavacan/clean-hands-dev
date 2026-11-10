// The club (2026-11-04): its data and its few club-only pieces, run by the shared engine. Game systems live in
// src/engine and the modules it uses; change them there and every map follows.
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {runGame,type GameDef} from '../engine/game';
import mapData from '../data/club-map.json';
import look from '../data/club-look.json';
import rules from '../data/club-rules.json';
import schedule from '../data/club-schedule.json';
import dialogue from '../data/club-dialogue.json';
import chances from '../data/club-chances.json';
import actions from '../data/club-actions.json';
import mission from '../data/club-mission.json';
import combat from '../data/club-combat.json';
import detection from '../data/club-detection.json';
import crowd from '../data/club-crowd.json';
import stage3 from '../data/club-stage3.json';
import {ClubChances} from './chances';
import {ClubShow} from './show';
import {itemModel,loadItemModels} from '../item-models';
import type {CrowdData} from '../engine/crowd';
import type {ChancesData} from '../chances';

runGame({
 map:mapData,schedule,mission,detection,look,rules:rules as GameDef['rules'],combat,dialogue,actions,
 chances:chances as ChancesData,crowd:crowd as CrowdData,
 // The investor, the drop, the meeting and VIP protection.
 createScript:c=>new ClubChances(c.director,c.m3,c.m4,c.clock,c.events,c.chances,c.schedule),
 decorate:({scene,hemi,group,box})=>{
  // The mirror ball over the dance floor (it spins).
  const ball=new T.Mesh(new T.SphereGeometry(.35,16,10),new T.MeshStandardMaterial({color:look.mirrorBall.color,emissive:look.mirrorBall.emissive,emissiveIntensity:look.mirrorBall.emissiveIntensity,metalness:.7,roughness:.3}));ball.position.set(24,5.7,22);group(0).add(ball);
  // Light spots drifting over the dance floor.
  const dots=Array.from({length:24},(_,i)=>{const dot=new T.Mesh(new T.CircleGeometry(.07,5),new T.MeshBasicMaterial({color:i%2?'#6486ef':'#b46ee4'}));dot.rotation.x=-Math.PI/2;dot.position.set(18+(i%6)*2.5,.035,15+Math.floor(i/6)*2.5);scene.add(dot);return dot;});
  // Small scenic props on the existing furniture (no collision).
  {
   const parts:[number,number,number,number,number,number,string][]=[
    [14.6,.8,32.2,.32,.075,.28,'#20282c'],[14.51,.875,32.2,.10,.065,.25,'#131719'],
    [14.68,.875,32.15,.038,.009,.04,'#73d397'],[14.68,.805,30.9,.2,.012,.27,'#e8dcb6'],
    [25.3,1,31.58,.22,.09,.22,'#ed605e'],[31.45,.82,31.3,.40,.16,.10,'#39444a'],
    [32,1.4,33.2,.48,.06,.35,'#384e59'],
   ];
   const geometry=parts.map(([x,y,z,w,h,d,color])=>{
    const g=new T.BoxGeometry(w,h,d).translate(x,y+h/2,z),c=new T.Color(color);
    g.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:g.attributes.position.count},()=>[c.r,c.g,c.b]).flat(),3));
    return g;
   });
   group(0).add(new T.Mesh(mergeGeometries(geometry),new T.MeshStandardMaterial({vertexColors:true,roughness:.93,flatShading:true})));
   for(const g of geometry)g.dispose();
  }
  // Lasers, moving heads and strobe bursts (look only), made after the static freeze so they keep animating.
  let show:ClubShow|undefined;
  return {
   spin:ball,animated:dots,
   afterFreeze:()=>{void loadItemModels().then(()=>{
    show=new ClubShow(scene,hemi,itemModel('moving_head'));
   });},
   step:(seconds,frame,dark,mission)=>{
    ball.rotation.y+=frame*.25;show?.step(seconds,dark);
    dots.forEach((dot,i)=>{dot.position.x=18+i%6*2.5+Math.sin(mission*.4+i)*.5;dot.position.z=15+Math.floor(i/6)*2.5+Math.cos(mission*.4+i)*.5;});
   },
   // The drop's blackout: the dance-floor light, its glowing strips and the dots go dark.
   blackout:(dark,{points,emitters})=>{
    const index=stage3.drop.blackout.pointLight;
    points[index].intensity=dark?0:look.points[index].intensity;
    for(const id of stage3.drop.blackout.emitters){const m=emitters.get(id);if(m)m.visible=!dark;}
    for(const dot of dots)dot.visible=!dark;
   },
   // The DJ wears headphones.
   dressNpc:v=>{
    if(v.npc.id!=='dj')return;
    const head=v.rig.joints.get('head')?.bone;
    if(head){for(const side of [-1,1])box('dj-headphone',side*.105,.075,0,.046,.085,.075,'#1a1b24',head);box('dj-headband',0,.174,0,.23,.028,.04,'#1a1b24',head);}
   },
  };
 },
 text:{
  mapTitle:'CLUB',mapLabel:'クラブ区画図',
  pause:'人物はいません。建物の中を自由に歩けます。',
  help:'<h2>クラブを自由に歩く。</h2><p>第1段階は建物と光だけです。人物、標的、仕掛けはありません。</p><p>WASDで移動。Shiftで走る。マウスで向きを変える。Vで視点を切り替える。E長押しではしごを使う。途中で離すと戻ります。</p><p>Nで標的とチャンスの表示を切り替えます。この段階では対象は空です。Tabで地図。Escで一時停止。</p>',
  prepEyebrow:'クラブ · 準備',loadSmall:'クラブ · 第3段階',loading:'クラブを準備しています。',
  brief:'投資家を排除して脱出してください。',
  targetDown:'ターゲットを排除した。正門前（E1）か西の搬入路（E2）から脱出する。',
  venue:'クラブ',
  hint:'厨房など黄色の職員区画と私室は、スーツでは入れない。使用人の立ち話に耳を傾けろ。',
 },
});
