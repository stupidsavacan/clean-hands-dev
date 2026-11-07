import type {Director,Npc,PlayerView} from './ai.ts';
import {permission,zoneAt} from './ai.ts';
import type {M3System} from './m3.ts';
import type {M4System} from './m4.ts';
import type {M53System} from './m53.ts';
import type {MissionClock} from './schedule.ts';
import type {MissionEvents} from './events.ts';
import {markDead,type KillCamera} from './kills.ts';
import {segmentClear} from './sight.ts';
import {floorOf,type Position} from './world.ts';
/** M5.7: the other twelve chances and seven traps (spec "M5 · CHANCES"), and the targets' reaction to the hotel alert.
 * Each chance step is a held E at a place or beside a person (positions in hotel.json `m57`); what it does is below in
 * `complete`. A trap kills everyone inside its area (kills.json `area`); it is an accident unless the agent's own act
 * that sets it off is seen (judgeKill). Alert 2 sends the targets to their safe rooms; alert 3 evacuates them (A and B
 * to the parking lot, C to the escape boat) and a target who gets there has escaped — the mission fails. */
type Spot=Position&{heading?:number};
export type M57Map={acts:Record<string,{label:string;at?:Position;seconds:number;tamper?:boolean;allowedFor?:string[]}>;props:Record<string,Position>;areas:Record<string,Position&{r:number}>;
 posed:Record<string,Spot>;sick:Position;inCar:Position;railFall:Position;safeRooms:Record<string,Position>;evacuate:Record<string,Position>;clothes:(Position&{disguise:string})[];escortPrivate:Position&{radius:number;hide:string};signal:number;scenes:Record<string,{until:number;cast:Record<string,Spot>}>};
export type M57Action={id:string;elapsed:number;duration:number;start:Position;npc?:Npc};
const flat=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.z-b.z);
const TARGETS=['wine_merchant','lawyer','investor'];
// Acts done beside a person rather than at a place: who, and what they must be doing.
const BESIDE:Record<string,{npc:string;doing:string}>={photo_pose:{npc:'wine_merchant',doing:'photo'},chef_emetic:{npc:'head_chef',doing:'cook'},serve_dish:{npc:'lawyer',doing:'tasting'},
 escort_start:{npc:'lawyer',doing:'wait'},greet_investor:{npc:'investor',doing:'wait'},massage_wire:{npc:'investor',doing:'massage'}};
const METHOD:Record<string,string>={pool_light:'electrocution',yacht_crane:'falling_object',chandelier:'chandelier',gas_leak:'gas_explosion',boat_fuel:'boat_explosion',fireworks:'fireworks'};

export class M57System{
 readonly armed=new Set<string>();readonly fired=new Set<string>();readonly flags=new Set<string>();readonly escaped=new Set<string>();
 action:M57Action|null=null;notices:string[]=[];keycard=false;inCar=false;escorting=false;fuse:{trap:string;at:number}|null=null;
 /** What each scripted NPC is doing for us, and until when (mission seconds). */
 readonly scripts=new Map<string,{why:string;until:number}>();
 readonly blasts:{trap:string;time:number;at:Position}[]=[];
 private held=new Set<string>();
 readonly director:Director;readonly m3:M3System;readonly m4:M4System;readonly m53:M53System;readonly clock:MissionClock;readonly events:MissionEvents;readonly map:M57Map;readonly cameras:KillCamera[];
 /** The item in the agent's hand (detection.ts) and whether a gun is out, asked fresh each time. */
 held_item:()=>string=()=>'';illegal:()=>boolean=()=>this.m53.illegal();
 constructor(d:Director,m3:M3System,m4:M4System,m53:M53System,clock:MissionClock,events:MissionEvents,map:M57Map,cameras:KillCamera[]){
  this.director=d;this.m3=m3;this.m4=m4;this.m53=m53;this.clock=clock;this.events=events;this.map=map;this.cameras=cameras;
  map.clothes.forEach((c,i)=>m4.clothes.push({id:'m57-clothes-'+i,disguise:c.disguise,pos:{x:c.x,y:c.y,z:c.z}}));
  const before=m4.extraInventory;m4.extraInventory=()=>[...(before?.()??[]),...(this.keycard?['keycard']:[])];}
 npc(id:string){return this.director.npcs.find(n=>n.id===id)!;}
 get tampering(){const a=this.action&&this.map.acts[this.action.id];return !!a&&(!!a.tamper||!!a.allowedFor&&!a.allowedFor.includes(this.m4.disguise));}
 activationView(p:PlayerView){const a=this.action&&this.map.acts[this.action.id];return {...p,tampering:!!a&&!a.allowedFor?.includes(p.disguise)};}
 get locked(){return !!this.action||this.inCar;}
 get progress(){return this.action?this.action.elapsed/this.action.duration:0;}
 private clear(a:Position,b:Position){return Math.abs(a.y-b.y)<.6&&segmentClear(this.director.boxes,{...a,y:a.y+1.1},{...b,y:b.y+1.1});}
 private near(p:Position,q:Position,r=this.m53.rules.interactRadius){return flat(p,q)<=r&&this.clear(p,q);}
 /** A person standing at their scheduled spot doing that thing (not chasing, fleeing or walking there). */
 private doing(n:Npc,what:string){return n.active&&!n.busy&&n.state==='patrol'&&!n.scheduleTarget&&n.scheduleAction===what;}
 private staff(p:PlayerView){return permission(this.director.rules,this.m4.disguise,zoneAt(this.director.mission.zones,p.x,p.z,p.floor))==='allow';}
 private set(flag:string){if(this.flags.has(flag))return;this.flags.add(flag);this.events.emit({type:'flag.set',time:this.clock.elapsed,id:flag});}
 private arm(trap:string,text:string){this.armed.add(trap);this.events.emit({type:'trap.armed',time:this.clock.elapsed,id:trap});this.notices.push(text);}

 /** Why an act cannot be done now ('' when it can). */
 private blocked(id:string,p:PlayerView):string{const d=this.m4.disguise,wrench=this.held_item()==='wrench',t=this.clock.time;
  switch(id){
   case 'pool_panel':return this.armed.has('pool_light')?'配電盤はもう壊した':wrench?'':'スパナを手に持つ必要がある';
   case 'pool_light':return this.fired.has('pool_light')?'':this.armed.has('pool_light')?'':'先に裏通路の配電盤を壊す';
   case 'photo_pose':return d!=='photographer'?'カメラマンの服が必要':this.flags.has('wine_posed')?'':'';
   case 'crane_pin':return this.armed.has('yacht_crane')?'固定ピンは抜いてある':'';
   case 'crane_panel':return this.fired.has('yacht_crane')?'荷はもう落ちた':this.armed.has('yacht_crane')?'':'先にクレーンの固定ピンを抜く';
   case 'chandelier_clamp':return this.armed.has('chandelier')?'留め具は緩めてある':!this.staff(p)?'スタッフの服が必要':wrench?'':'スパナを手に持つ必要がある';
   case 'chandelier_release':return this.fired.has('chandelier')?'シャンデリアはもう落ちた':this.armed.has('chandelier')?'':'先に留め具をスパナで緩める';
   case 'chef_emetic':return d!=='chef'?'シェフの服が必要':this.flags.has('chef_away')?'料理長はもういない':'';
   case 'serve_dish':return d!=='chef'?'シェフの服が必要':!this.flags.has('chef_away')?'料理長が自分で出す（先に料理長をどかす）':this.m53.poison<=0?'致死毒がない':'';
   case 'gas_pipe':return this.armed.has('gas_leak')?'ガス管は緩めてある':wrench?'':'スパナを手に持つ必要がある';
   case 'stove_light':return this.fired.has('gas_leak')||this.fuse?'':!this.armed.has('gas_leak')?'先に厨房奥のガス管を緩める':d!=='chef'?'シェフの服が必要':!this.doing(this.npc('lawyer'),'tasting')?'弁護士が試食に来てから':'';
   case 'escort_start':return d!=='bodyguard'?'私設護衛の服が必要':this.escorting?'':t<960||t>=1200?'交代は16分から':'';
   case 'car_sit':return d!=='driver'?'運転手の服が必要':'';
   case 'car_kill':return this.flags.has('lawyer_in_car')&&this.npc('lawyer').active?'':'弁護士が乗り込むのを待つ（20分）';
   case 'take_keycard':return this.keycard?'':'';
   case 'rail_bolts':return this.armed.has('balcony_rail')?'ボルトは外してある':this.keycard?'':'カードキーが必要';
   case 'boat_fuel':return this.armed.has('boat_fuel')?'燃料には細工した':'';
   case 'alarm_bell':return this.flags.has('investor_evacuation')?'もう鳴っている':'';
   case 'greet_investor':return d!=='pilot'?'パイロットの服が必要':this.flags.has('investor_posed')?'':'';
   case 'massage_wire':return d!=='masseuse'?'マッサージ師の服が必要':!this.m4.hasWire?'ワイヤーが必要':'';
   case 'fireworks_aim':return this.armed.has('fireworks')?'筒は向けてある':d!=='beachbar'?'ビーチバー店員の服が必要':'';
  }return '';}
 /** Acts that are finished for good stop offering themselves. */
 private done(id:string){return id==='pool_light'&&this.fired.has('pool_light')||id==='photo_pose'&&this.flags.has('wine_posed')||id==='greet_investor'&&this.flags.has('investor_posed')||
  id==='take_keycard'&&this.keycard||id==='escort_start'&&this.escorting||id==='car_sit'&&this.inCar||id==='car_kill'&&!this.inCar||id==='stove_light'&&(this.fired.has('gas_leak')||!!this.fuse);}
 /** The act within reach, if any: a person doing their thing, or a place. */
 here(p:PlayerView):{id:string;npc?:Npc}|null{
  if(this.inCar)return {id:'car_kill'};
  // Places first, then people; two acts can share a spot (loosen, then release), so the one that can be done now wins.
  const spots:{id:string;npc?:Npc}[]=Object.entries(this.map.acts).filter(([id,a])=>a.at&&!this.done(id)&&id!=='car_kill'&&floorOf(a.at.y)===floorOf(p.y)&&this.near(p,a.at,id==='alarm_bell'?1.2:this.m53.rules.interactRadius)).map(([id])=>({id}));
  for(const [id,b] of Object.entries(BESIDE)){if(this.done(id))continue;const n=this.npc(b.npc);if(this.doing(n,b.doing)&&this.near(p,n.pos))spots.push({id,npc:n});}
  return spots.find(s=>!this.blocked(s.id,p))??spots[0]??null;}
 prompt(p:PlayerView):{text:string;progress:number}|null{
  if(this.action)return {text:`E ${this.map.acts[this.action.id].label}…`,progress:this.progress};
  const h=this.here(p);if(!h&&this.escorting&&this.near(p,this.map.escortPrivate,this.map.escortPrivate.radius))return {text:'人のいない客室。背後からX長押しで排除し、近くの物入れへ隠せる。',progress:0};if(!h)return this.inCar?{text:'運転席で待っている（移動キーで降りる）',progress:0}:null;
  const why=this.blocked(h.id,p),label=this.map.acts[h.id].label;
  if(h.id==='car_kill'&&why)return {text:`運転席で待っている：${why}（移動キーで降りる）`,progress:0};
  return {text:why?`${label}：${why}`:`E 長押し ${label}`,progress:0};}

 step(dt:number,p:PlayerView,keys:Set<string>,suppressed=false){this.notices=[];
  const moving=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(k=>keys.has(k)),fresh=!suppressed&&keys.has('KeyE')&&!this.held.has('KeyE');let usedE=false;
  if(this.inCar&&moving&&!this.action){this.inCar=false;this.notices.push('車を降りた。');}
  if(this.action){const a=this.action;usedE=true;
   if(suppressed||moving||!keys.has('KeyE')||flat(p,a.start)>.15||a.npc&&!a.npc.active||this.blocked(a.id,p))this.action=null;
   else if((a.elapsed+=dt)>=a.duration){this.complete(a,p);this.action=null;}}
  else if(fresh&&!moving){const h=this.here(p);if(h&&!this.blocked(h.id,p)){this.action={id:h.id,elapsed:0,duration:this.map.acts[h.id].seconds,start:{...p},npc:h.npc};usedE=true;}}
  this.held=new Set(keys);this.auto(p);return usedE;}

 private complete(a:M57Action,p:PlayerView){const t=this.clock.elapsed,left=(end:number)=>t+Math.max(0,end-this.clock.time);
  switch(a.id){
   case 'pool_panel':this.arm('pool_light','配電盤を壊した。プールの照明スタンドの配線に電気が来ている。');break;
   case 'pool_light':this.fire('pool_light',p,true);break;
   case 'photo_pose':{const n=this.npc('wine_merchant');this.script(n,'pose',this.map.posed.wine_merchant,'photo',left(600));this.scene('photo');this.set('wine_posed');this.notices.push('ワイン商「手すり際ね？ 海が入るように撮ってくれ」');break;}
   case 'crane_pin':this.arm('yacht_crane','固定ピンを抜いた。吊った荷が風で揺れている。');break;
   case 'crane_panel':this.fire('yacht_crane',p,true);break;
   case 'chandelier_clamp':this.arm('chandelier','留め具を緩めた。シャンデリアがきしむ。');break;
   case 'chandelier_release':this.fire('chandelier',p,true);break;
   case 'chef_emetic':{const n=this.npc('head_chef');this.script(n,'sick',this.map.sick,'sick',left(960));this.set('chef_away');this.notices.push('料理長「うっ……ちょっと失礼」——トイレへ急いだ。');break;}
   case 'serve_dish':this.m53.poison--;this.events.emit({type:'item.used',time:t,id:'poison_lethal'});this.kill([this.npc('lawyer')],'poison_dish',p,false);break;
   case 'gas_pipe':this.arm('gas_leak','ガス管を緩めた。厨房にガスの匂いが広がる。');break;
   case 'stove_light':this.fuse={trap:'gas_leak',at:t+3};this.notices.push('コンロに火を付けた。離れろ！');break;
   case 'escort_start':{this.escorting=true;this.set('escorting');
    for(const id of ['bodyguard_captain','bodyguard_1','bodyguard_2'])this.script(this.npc(id),'hold',{...this.npc(id).pos},'wait',left(1200));this.notices.push('弁護士「交代の者か。ついて行こう」');break;}
   case 'car_sit':this.inCar=true;this.notices.push('運転席に座った。弁護士が来るのを待つ。');break;
   case 'car_kill':{const n=this.npc('lawyer');this.kill([n],'car_wire',p,false,true);n.bodyMode='hidden';break;}
   case 'take_keycard':this.keycard=true;this.set('keycard');this.events.emit({type:'item.picked',time:t,id:'keycard'});this.notices.push('ペントハウスのカードキーを手に入れた。');break;
   case 'rail_bolts':this.arm('balcony_rail','手すりのボルトを外した。次に寄りかかった人は落ちる。');break;
   case 'boat_fuel':this.arm('boat_fuel','避難ボートの燃料に細工した。エンジンをかけると爆発する。');break;
   case 'alarm_bell':this.set('investor_evacuation');this.notices.push('避難誘導のベル。投資家が避難ボートへ向かう。');break;
   case 'greet_investor':{const n=this.npc('investor');this.script(n,'pose',this.map.posed.investor,'wait',left(1500));this.scene('heli');this.set('investor_posed');this.notices.push('投資家「ヘリはまだか？ 縁で待つよ」');break;}
   case 'massage_wire':this.kill([this.npc('investor')],'massage_wire',p,true,true);break;
   case 'fireworks_aim':this.arm('fireworks','花火の筒を投資家の席へ向けた。点火は18分。');break;
  }}

 /** Things that happen by themselves: arrivals, the rail, the signal, the fuse, the car, the escort and the alarm. */
 private auto(p:PlayerView){const t=this.clock.time,wine=this.npc('wine_merchant'),lawyer=this.npc('lawyer'),investor=this.npc('investor');
  // Expected visitors (spec: a chance's scripted scene is not seen through): the head chef while the "new cook" doses
  // his meal, and the lawyer and her captain while the relief bodyguard reports for the change.
  const active=(id:string)=>this.m53.chances.states.get(id)?.status==='active',d=this.m4.disguise;
  this.npc('head_chef').scriptedImmune=d==='chef'&&active('b2')&&!this.flags.has('chef_away');
  for(const id of ['lawyer','bodyguard_captain'])this.npc(id).scriptedImmune=d==='bodyguard'&&active('b3')&&(this.escorting||t>=960&&t<1200);
  for(const [id,s] of this.scripts)if(this.clock.elapsed>=s.until&&s.why!=='evac'&&s.why!=='safe')this.unscript(this.npc(id));
  if(this.armed.has('pool_light')&&this.doing(wine,'lounge'))this.set('wine_at_pool');
  const zone=zoneAt(this.director.mission.zones,p.x,p.z,p.floor);
  if(zone?.id==='ZONE_staff_catwalk'&&this.staff(p))this.set('catwalk');
  if(this.m4.disguise==='masseuse'&&(zone?.id==='ZONE_secure_penthouse'||zone?.id==='ZONE_secure_balcony'))this.set('masseuse_in');
  if(this.m3.hotel.level>=3)this.set('alert3');
  // The loose rail gives way under whoever leans on it: the investor on the phone.
  if(this.armed.has('balcony_rail')&&!this.fired.has('balcony_rail')&&this.doing(investor,'phone')){this.fired.add('balcony_rail');this.events.emit({type:'trap.fired',time:this.clock.elapsed,id:'balcony_rail'});
   this.kill([investor],'balcony_rail',p,false);investor.fallOrigin={...investor.pos};investor.fallSeconds=this.m53.rules.fallSeconds;investor.pos={...this.map.railFall};}
  if(this.armed.has('fireworks')&&!this.fired.has('fireworks')&&t>=this.map.signal&&t<1200)this.fire('fireworks',p,false);
  if(this.fuse&&this.clock.elapsed>=this.fuse.at){const trap=this.fuse.trap;this.fuse=null;this.fire(trap,p,false);}
  // The driver's seat: the lawyer comes to the car for the call and gets in the back.
  if(this.inCar&&!this.flags.has('lawyer_in_car')&&lawyer.active){if(this.doing(lawyer,'phone')||this.scripts.get('lawyer')?.why==='car'){this.script(lawyer,'car',this.map.inCar,'sit',this.clock.elapsed+300);if(flat(lawyer.pos,this.map.inCar)<.9){this.set('lawyer_in_car');this.notices.push('弁護士が後部座席に乗り込んだ。窓は閉まっている。');}}}
  if(!this.inCar&&this.scripts.get('lawyer')?.why==='car')this.unscript(lawyer);
  // Escorting: the lawyer walks a step behind the agent until the change is over, the outfit changes or the alarm rises.
  if(this.escorting){if(!lawyer.active){if(lawyer.life==='dead')this.set('escort_kill');this.endEscort();}
   else if(this.m4.disguise!=='bodyguard'||t>=1200||this.m3.hotel.level>=2)this.endEscort();
   else{const d=flat(lawyer.pos,p)||1,goal={x:p.x+(lawyer.pos.x-p.x)/d*1.3,y:p.y,z:p.z+(lawyer.pos.z-p.z)/d*1.3},i=this.director.nav.nearest(goal),node=i>=0?this.director.nav.nodes[i]:null;
    this.script(lawyer,'escort',node&&d>1.6?{x:node.x,y:node.y,z:node.z}:{...lawyer.pos},'escort',this.clock.elapsed+1);}}
  this.alarm(p);}
 /** Settle a hand kill before M5.3 publishes npc.killed (which closes an unfinished chance). */
 afterAi(){const lawyer=this.npc('lawyer');if(this.escorting&&!lawyer.active){if(lawyer.life==='dead')this.set('escort_kill');this.endEscort();}}
 private endEscort(){this.escorting=false;for(const id of ['lawyer','bodyguard_captain','bodyguard_1','bodyguard_2']){const n=this.npc(id);if(['escort','hold'].includes(this.scripts.get(id)?.why??''))this.unscript(n);}}
 /** Alert 2: the targets wait in their safe rooms; alert 3: they evacuate, and one who gets away fails the mission. */
 private alarm(p:PlayerView){const level=this.m3.hotel.level;
  for(const id of TARGETS){const n=this.npc(id);if(!n.active||this.escaped.has(id))continue;const why=this.scripts.get(id)?.why;
   if(level>=3||id==='investor'&&this.flags.has('investor_evacuation')){const goal=this.map.evacuate[id];if(why!=='evac'){if(this.escorting&&id==='lawyer')this.endEscort();this.script(n,'evac',goal,'evacuate',Infinity);}
    if(flat(n.pos,goal)<1&&Math.abs(n.pos.y-goal.y)<.5){
     if(id==='investor'&&this.armed.has('boat_fuel')&&!this.fired.has('boat_fuel'))this.fire('boat_fuel',p,false);
     else{this.escaped.add(id);n.scheduledAway=true;this.events.emit({type:'target.escaped',time:this.clock.elapsed,id});this.notices.push(`${n.label}が${id==='investor'?'ボート':'車'}で逃げた。`);}}}
   else if(level===2){if(why!=='safe')this.script(n,'safe',this.map.safeRooms[id],'hide',Infinity);}
   else if(why==='safe'||why==='evac')this.unscript(n);}}
 private scene(id:string){const scene=this.map.scenes[id],until=this.clock.elapsed+Math.max(0,scene.until-this.clock.time);
  for(const [npc,goal] of Object.entries(scene.cast))this.script(this.npc(npc),'scene',goal,'wait',until);}
 private script(n:Npc,why:string,goal:Spot,action:string,until:number){n.scriptedGoal={x:goal.x,y:goal.y,z:goal.z};n.scriptedAction=action;n.scriptedHeading=goal.heading??null;this.scripts.set(n.id,{why,until});}
 private unscript(n:Npc){n.scriptedGoal=null;n.scriptedAction='';n.scriptedHeading=null;this.scripts.delete(n.id);}

 /** A trap goes off: everyone in its area dies. An accident unless the agent's own act was seen (exposed). */
 fire(trap:string,p:PlayerView,exposed:boolean){if(this.fired.has(trap))return;this.fired.add(trap);const area=this.map.areas[trap];this.events.emit({type:'trap.fired',time:this.clock.elapsed,id:trap});
  this.blasts.push({trap,time:this.clock.elapsed,at:{x:area.x,y:area.y,z:area.z}});
  const victims=this.director.npcs.filter(n=>n.active&&!n.busy&&Math.abs(n.pos.y-area.y)<1.5&&flat(n.pos,area)<=area.r);
  if(!victims.length)this.notices.push('仕掛けが作動したが、誰も巻き込まなかった。');else this.kill(victims,METHOD[trap],p,exposed);}
 /** direct: a quiet kill by hand (the car, the massage) is never an accident, seen or not. */
 private kill(victims:Npc[],method:string,p:PlayerView,exposed:boolean,direct=false){const seen=this.m53.judge(direct? p:this.activationView(p),victims.map(v=>v.id),exposed,!direct,this.illegal()),
   judgement=direct?{...seen,kind:'murder' as const,reasons:seen.kind==='murder'?seen.reasons:['直接の排除（誰にも見られていない）']}:seen;
  for(const n of victims){if(!n.active)continue;if(this.scripts.has(n.id))this.unscript(n);markDead(n,method,judgement);this.m53.kills.push({victim:n.id,method,time:this.clock.elapsed,position:{...n.pos},judgement});this.m3.stats.kills++;
   this.notices.push(`${n.label}を排除 · ${judgement.kind==='accident'?'事故':'殺人'}：${judgement.reasons.join('／')}`);}}
 snapshot(){return {armed:[...this.armed],fired:[...this.fired],flags:[...this.flags],escaped:[...this.escaped],keycard:this.keycard,inCar:this.inCar,escorting:this.escorting,
  action:this.action&&{id:this.action.id,progress:this.progress},scripts:Object.fromEntries(this.scripts)};}
}
