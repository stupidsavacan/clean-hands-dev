// The HITMAN-style menus (2026-11-06), worked on in the UI lab (ui-lab.html) until they are good enough to replace the
// game's screens. Layout and information design follow HITMAN (planning: briefing + a row of loadout slots, each opening
// its choices; pause: a menu list beside the objectives and situation; result: rank, score lines and stats side by side);
// colours and type are CLEAN HANDS's own (style.css variables). The loadout rules are loadout.ts (one gun at most).
// Every class lives under .hm so the file can be imported into the game without touching its current screens.
import './menus.css';
import {blockedReason,choose,cleanLoadout,loadoutGuns,IN_CASE,type Choice,type Loadout,type LoadoutMission} from './loadout';

export type PlanMission=LoadoutMission&{title:string;targets:string[];briefing:{id:string;label:string;text:string}[]};
type SlotId='start'|'suit'|'pistol'|'case'|'gear0'|'gear1'|'pickup';
type Slot={id:SlotId|string;title:string;en:string;value:string;note:string;fixed?:boolean;muted?:boolean};
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));

export class PlanScreen{
 readonly root:HTMLElement;readonly m:PlanMission;readonly text:{eyebrow:string;agent:()=>string};plan:Loadout;slot='';
 onStart?:(l:Loadout)=>void;onLook?:()=>void;
 constructor(host:HTMLElement,m:PlanMission,text:{eyebrow:string;agent:()=>string}){
  this.m=m;this.text=text;
  this.plan=cleanLoadout(null,m);
  this.root=document.createElement('div');this.root.className='hm modal hm-plan';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','作戦準備');
  this.root.innerHTML=`<section class="hm-sheet"><header class="hm-head"><div><div class="eyebrow">${esc(text.eyebrow)}</div><h2 data-id="title"></h2></div><p data-id="agent"></p></header>
<div class="hm-body"><div class="hm-brief"><h3>BRIEFING</h3><div data-id="targets"></div></div>
<div class="hm-load"><h3>LOADOUT</h3><div data-id="slots" class="hm-slots"></div><div data-id="picker" class="hm-picker" hidden></div><p data-id="guns" class="hm-guns"></p></div></div>
<footer><button data-id="look">姿を変える</button><button data-id="go" class="hm-go">作戦開始</button></footer></section>`;
  host.append(this.root);
  this.q('look').onclick=()=>this.onLook?.();this.q('go').onclick=()=>this.onStart?.(cleanLoadout(this.plan,this.m));
  this.root.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.slot){e.stopPropagation();this.slot='';this.render();}});}
 private q(id:string){return this.root.querySelector<HTMLElement>(`[data-id="${id}"]`)!;}
 get isOpen(){return this.root.classList.contains('open');}
 open(saved:unknown){this.plan=cleanLoadout(saved,this.m);this.slot='';this.q('title').textContent=this.m.title;this.q('agent').textContent=`AGENT · ${this.text.agent()}`;
  this.q('targets').innerHTML=this.m.briefing.map(b=>{const on=this.m.targets.includes(b.id);return `<article class="${on?'on':'off'}"><span>${on?'TARGET':'この版では対象外'}</span><b>${esc(b.label)}</b><p>${esc(b.text)}</p></article>`;}).join('')||'<p class="hm-empty">この版では標的はいない。建物を歩いて確かめる。</p>';
  this.render();this.root.classList.add('open');this.q('go').focus();}
 close(){this.root.classList.remove('open');}
 private label(list:Choice[],id:string,none:string){return list.find(o=>o.id===id)?.label??none;}
 slots():Slot[]{const m=this.m,p=this.plan,tool=(i:number)=>p.tools[i]??'',at=(m.pickups??[]).find(x=>x.id===p.pickup),gun=this.label(m.pistols,p.pistol,'持ち込まない');
  return [{id:'start',title:'開始地点',en:'STARTING LOCATION',value:this.label(m.starts,p.start,'—'),note:m.starts.find(s=>s.id===p.start)?.note??''},
   {id:'suit',title:'スーツ',en:'SUIT',value:this.text.agent(),note:'押すと姿を変える'},
   {id:'pistol',title:'銃',en:'WEAPON',value:p.pistol?gun:'持ち込まない',note:p.pistol?(at?`${at.label}に置いておく`:p.pickup===IN_CASE?'ケースの中に入れておく。検査では見つかる':'身につけて持ち込む。入口の検査で止められる'):'銃は1丁まで'},
   ...(m.cases?.length?[{id:'case',title:'ケース',en:'BRIEFCASE',value:this.label(m.cases,p.case,'持たない'),note:p.case?'手に持って始める':'銃を入れて持ち込める'}]:[]),
   {id:'gear0',title:'道具 1',en:'GEAR',value:this.label(m.tools,tool(0),'空き'),note:m.tools.find(t=>t.id===tool(0))?.note??''},
   {id:'gear1',title:'道具 2',en:'GEAR',value:this.label(m.tools,tool(1),'空き'),note:m.tools.find(t=>t.id===tool(1))?.note??''},
   ...m.fixedTools.map(f=>({id:'fixed-'+f.id,title:'いつも持つ',en:'STANDARD',value:f.label,note:f.note??'',fixed:true})),
   ...(m.pickups?.length?[{id:'pickup',title:'持ち込み',en:'AGENCY PICKUP',value:at?at.label:p.pickup===IN_CASE?'ケースの中':'使わない',note:!p.pistol?'先に銃を選ぶ':at?`${gun}を先に置いておく`:p.pickup===IN_CASE?`${gun}をケースに入れて持つ`:'銃を先に置いておく場所',muted:!p.pistol}]:[])];}
 options(slot:string):{title:string;key:SlotId;items:(Choice&{why?:string})[];current:string}|null{const m=this.m,p=this.plan,why=(k:SlotId,id:string)=>blockedReason(p,m,k as 'pistol',id);
  if(slot==='start')return {title:'開始地点',key:'start',items:m.starts.map(s=>({...s,why:why('start',s.id)})),current:p.start};
  if(slot==='pistol')return {title:'持ち込む銃（1丁まで）',key:'pistol',items:m.pistols,current:p.pistol};
  if(slot==='case')return {title:'持って始めるケース',key:'case',items:[{id:'',label:'持たない'},...(m.cases??[])],current:p.case};
  if(slot==='gear0'||slot==='gear1'){const i=slot==='gear0'?0:1;return {title:`道具 ${i+1}`,key:slot,items:[{id:'',label:'空き'},...m.tools.map(t=>({...t,why:why(slot,t.id)}))],current:p.tools[i]??''};}
  if(slot==='pickup'){const gun=this.label(m.pistols,p.pistol,'');return {title:p.pistol?`${gun}を置いておく場所（入口の検査の内側。置けるのはこの1丁だけ）`:'銃を置いておく場所（先に銃を選ぶ。銃は1丁まで）',key:'pickup',items:[{id:'',label:'使わない',note:p.pistol?'身につけて持ち込む':''},...(m.cases?.length?[{id:IN_CASE,label:'ケースの中',note:'見えないが、検査では見つかる',why:why('pickup',IN_CASE)}]:[]),...(m.pickups??[]).map(x=>({...x,why:why('pickup',x.id)}))],current:p.pickup};}
  return null;}
 render(){const slots=this.q('slots'),picker=this.q('picker');
  slots.innerHTML=this.slots().map(s=>`<button class="slot${s.id===this.slot?' active':''}${s.fixed?' fixed':''}${s.muted?' muted':''}" data-slot="${s.id}" ${s.fixed?'aria-disabled="true"':''} aria-expanded="${s.id===this.slot}"><small>${s.en}</small><span>${esc(s.title)}</span><b>${esc(s.value)}</b><i>${esc(s.note)}</i></button>`).join('');
  const o=this.slot?this.options(this.slot):null;picker.hidden=!o;
  picker.innerHTML=o?`<h4>${esc(o.title)}</h4><div class="opts">${o.items.map(i=>{const no=i.why||i.open===false;return `<button class="opt${i.id===o.current?' on':''}" data-key="${o.key}" data-value="${i.id}" ${no?'disabled':''}><b>${esc(i.label)}</b>${i.why?`<i class="why">${esc(i.why)}</i>`:i.note?`<i>${esc(i.note)}</i>`:''}</button>`;}).join('')}</div>`:'';
  const g=loadoutGuns(this.plan),at=(id:string)=>(this.m.pickups??[]).find(x=>x.id===id)?.label??id;
  this.q('guns').textContent=g.length?`持ち込む銃 1/1 — ${this.label(this.m.pistols,g[0].id,'')}（${g[0].at==='carried'?'身につける':at(g[0].at)}）`:'持ち込む銃 0/1';
  slots.querySelectorAll<HTMLButtonElement>('.slot').forEach(b=>b.onclick=()=>{const id=b.dataset.slot!;if(id==='suit'){this.onLook?.();return;}if(id.startsWith('fixed-'))return;this.slot=this.slot===id?'':id;this.render();
   if(this.slot)picker.querySelector<HTMLButtonElement>('.opt.on,.opt:not([disabled])')?.focus();});
  picker.querySelectorAll<HTMLButtonElement>('.opt').forEach(b=>b.onclick=()=>{const k=b.dataset.key as SlotId,v=b.dataset.value!;this.plan=choose(this.plan,this.m,k as 'pistol',v);
   const back=this.slot;this.slot='';this.render();slots.querySelector<HTMLButtonElement>(`[data-slot="${back}"]`)?.focus();});}
}

export type PauseInfo={objectives:{text:string;state:string;bonus?:boolean}[];status:{text:string;en:string;tone:string}[];loadout:string;note?:string};
export class PauseMenu{
 readonly root:HTMLElement;
 constructor(host:HTMLElement,actions:{id:string;label:string;key?:string;run:()=>void}[]){
  this.root=document.createElement('div');this.root.className='hm modal hm-pause';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','一時停止');
  this.root.innerHTML=`<section class="hm-menu"><nav class="hm-list"><div class="eyebrow">PAUSED</div><h2>一時停止</h2>${actions.map(a=>`<button data-act="${a.id}">${esc(a.label)}${a.key?`<small>${a.key}</small>`:''}</button>`).join('')}</nav>
<aside class="hm-side"><h3>OBJECTIVES</h3><ul data-id="obj"></ul><h3>SITUATION</h3><div data-id="status"></div><h3>LOADOUT</h3><div data-id="loadout" class="hm-loadout"></div><p data-id="note"></p></aside></section>`;
  host.append(this.root);for(const a of actions)this.root.querySelector<HTMLButtonElement>(`[data-act="${a.id}"]`)!.onclick=a.run;}
 open(i:PauseInfo){const q=(id:string)=>this.root.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
  q('obj').innerHTML=i.objectives.map(o=>`<li class="${o.state}${o.bonus?' bonus':''}">${esc(o.text)}</li>`).join('');
  q('status').innerHTML=i.status.map(t=>`<span class="tag ${t.tone}">${esc(t.text)}<small>${t.en}</small></span>`).join('')||'<span class="tag dim">異常なし<small>CLEAR</small></span>';
  q('loadout').textContent=i.loadout||'なし';q('note').textContent=i.note??'';
  this.root.classList.add('open');this.root.querySelector<HTMLButtonElement>('.hm-list button')?.focus();}
 close(){this.root.classList.remove('open');}
}

export type ResultInfo={eyebrow:string;title:string;rank:string;text:string;lines:{label:string;count:string;points:number|string;cls?:string}[];stats:[string,string][]};
export class ResultScreen{
 readonly root:HTMLElement;
 constructor(host:HTMLElement,actions:{id:string;label:string;run:()=>void}[]){
  this.root=document.createElement('div');this.root.className='hm modal hm-result';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','結果');
  this.root.innerHTML=`<section class="hm-res"><div class="eyebrow" data-id="eyebrow"></div><div class="hm-res-head"><h2 data-id="title"></h2><div class="hm-rank" data-id="rank" aria-label="ランク"></div></div><p data-id="text"></p>
<table data-id="lines" class="hm-lines"></table><dl data-id="stats" class="hm-stats"></dl><footer>${actions.map(a=>`<button data-act="${a.id}">${esc(a.label)}</button>`).join('')}</footer></section>`;
  host.append(this.root);for(const a of actions)this.root.querySelector<HTMLButtonElement>(`[data-act="${a.id}"]`)!.onclick=a.run;}
 open(r:ResultInfo){const q=(id:string)=>this.root.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
  q('eyebrow').textContent=r.eyebrow;q('title').textContent=r.title;q('rank').textContent=r.rank;q('rank').dataset.rank=r.rank;q('text').textContent=r.text;
  q('lines').innerHTML=r.lines.map(l=>`<tr class="${l.cls??''}"><th>${esc(l.label)}</th><td>${esc(l.count)}</td><td>${typeof l.points==='number'?(l.points>0&&l.cls!=='total'?'+':'')+l.points.toLocaleString():esc(l.points)}</td></tr>`).join('');
  q('stats').innerHTML=r.stats.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  this.root.classList.add('open');this.root.querySelector<HTMLButtonElement>('footer button:last-child')?.focus();}
 close(){this.root.classList.remove('open');}
}
