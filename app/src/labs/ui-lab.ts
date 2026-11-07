// UI Lab (2026-11-06): the HITMAN-style planning screen, pause menu, result (menus.ts) and in-game HUD with the
// inventory strip (hud-hitman.ts, moved out of the game 2026-11-07) on their own, at the PC and
// iPad (9th gen, landscape) sizes, with automatic checks. The game keeps its earlier screens until every check here passes
// and the screens are judged finished; then the game switches to menus.ts.
// The page shows itself in iframes of exact sizes (?embed=plan|pause|result), so the media queries are the real ones.
import '../style.css';
import {PlanScreen,PauseMenu,ResultScreen,type PlanMission} from '../menus';
import {cleanLoadout,loadoutGuns,GUN_LIMIT,type Loadout} from '../loadout';
import club from '../data/club-mission.json';
import clubMap from '../data/club-map.json';
import {HitmanHud,type HudState} from '../hud-hitman';

const mission=club as unknown as PlanMission;
const SIZES:{id:string;label:string;w:number;h:number}[]=[{id:'pc',label:'PC 1280×720',w:1280,h:720},{id:'ipad',label:'iPad 横 1080×810',w:1080,h:810}];
const SCREENS:{id:string;label:string}[]=[{id:'plan',label:'作戦準備'},{id:'pause',label:'一時停止'},{id:'result',label:'結果'},{id:'hud',label:'ゲーム中の HUD'}];
type Check={name:string;ok:boolean;detail:string};
const params=new URLSearchParams(location.search),embed=params.get('embed');
const app=document.querySelector<HTMLDivElement>('#app')!;

// ---- One screen, full size ----
function runEmbed(screen:string){
 document.title='UI ラボ · '+screen;
 const toast=(t:string)=>{const el=document.createElement('div');el.className='lab-toast';el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),1600);};
 const style=document.createElement('style');style.textContent=`#app{position:relative;background:#20262b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 0' stroke='%23ffffff10'/%3E%3C/svg%3E")}
.lab-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 16px;background:var(--paper);color:var(--ink);font-size:13px;z-index:9}`;document.head.append(style);
 const post=(data:object)=>parent!==window&&parent.postMessage({source:'ui-lab',screen,...data},'*');
 let checks:()=>Check[]=()=>[];
 if(params.get('touch'))document.body.classList.add('touch-enabled');
 if(screen==='hud'){checks=runHud();}
 else if(screen==='plan'){
  const plan=new PlanScreen(app,mission,{eyebrow:'クラブ · 準備',agent:()=>'47'});
  plan.onLook=()=>toast('ゲームでは姿を変える画面が開く');plan.onStart=l=>{toast('作戦開始：'+describe(l));post({started:l});};
  const report=()=>post({loadout:plan.plan});const render=plan.render.bind(plan);plan.render=()=>{render();report();};
  // ?gun=<id>&at=<pickup>&open=<slot> starts from that state (for screenshots and for looking at one case).
  plan.open(params.get('gun')?{tools:['coin','poison_lethal'],pistol:params.get('gun'),start:'S1',pickup:params.get('at')??''}:null);
  const first=params.get('open');if(first){plan.slot=first;plan.render();}
  checks=()=>planChecks(plan);
 }else if(screen==='pause'){
  const menu=new PauseMenu(app,[['resume','続ける','Esc'],['map','地図','Tab'],['help','操作',''],['look','姿を変える',''],['reset','最初からやり直す',''],['prep','作戦準備へ','']].map(([id,label,key])=>({id,label,key,run:()=>toast(`「${label}」を押した`)})));
  menu.open({objectives:[{text:'投資家を排除する',state:'open'},{text:'脱出する',state:'open'},{text:'監視カメラの記録を残さない',state:'open',bonus:true}],
   status:[{text:'立入禁止',en:'TRESPASSING',tone:'amber'},{text:'捜索中',en:'SEARCHING',tone:'amber'},{text:'溶け込んでいる',en:'BLENDING',tone:'teal'}],
   loadout:'ワイヤー、コイン、毒、消音ピストル（喫煙所の植え込み）',note:'人物はいません。建物の中を自由に歩けます。'});
  checks=()=>common(menu.root.querySelector('section')!);
 }else{
  const res=new ResultScreen(app,[{id:'prep',label:'準備画面へ',run:()=>toast('準備画面へ')},{id:'retry',label:'同じ準備でもう一度 · R',run:()=>toast('もう一度')}]);
  res.open({eyebrow:'MISSION COMPLETE',title:'貸し切りの夜',rank:'A',text:'投資家は事故に見える形で倒れた。誰にも見られずに表通りから出た。',
   lines:[{label:'基本点',count:'',points:10000,cls:'base'},{label:'気づかれずに倒した',count:'1',points:5000},{label:'時間ボーナス（15分未満）',count:'',points:3000},{label:'合計',count:'',points:17500,cls:'total'}],
   stats:[['ターゲット','投資家：事故死'],['チャンス','屋上のガラス 達成'],['監視カメラ','記録なし'],['撃ち合い','なし'],['持ち込み','コイン、毒、消音ピストル（喫煙所の植え込み）']]});
  checks=()=>common(res.root.querySelector('section')!);
 }
 addEventListener('message',e=>{if(e.data?.source==='ui-lab-shell'&&e.data.run)post({checks:checks()});});
 post({ready:true});
}
function describe(l:Loadout){const g=loadoutGuns(l)[0],gun=g?mission.pistols.find(p=>p.id===g.id)?.label:'';const at=g&&g.at!=='carried'?mission.pickups?.find(p=>p.id===g.at)?.label:'';
 return [...l.tools.map(id=>mission.tools.find(t=>t.id===id)?.label??id),...(gun?[`${gun}（${at||'身につける'}）`]:[])].join('、')||'道具なし';}

// The checks every screen must pass.
function common(sheet:HTMLElement):Check[]{const out:Check[]=[],vw=innerWidth,vh=innerHeight,r=sheet.getBoundingClientRect();
 out.push({name:'横にはみ出さない',ok:r.left>=0&&r.right<=vw+.5&&sheet.scrollWidth<=sheet.clientWidth+1&&document.documentElement.scrollWidth<=vw,detail:`幅 ${Math.round(r.width)} / 画面 ${vw}`});
 out.push({name:'縦に収まる（スクロールなし）',ok:sheet.scrollHeight<=sheet.clientHeight+1&&r.bottom<=vh+.5,detail:`高さ ${Math.round(sheet.scrollHeight)} / 表示 ${Math.round(sheet.clientHeight)} · 画面 ${vh}`});
 const small=[...sheet.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.offsetParent).filter(b=>{const q=b.getBoundingClientRect();return q.height<44||q.width<44;});
 out.push({name:'ボタンは指で押せる大きさ（44px 以上）',ok:!small.length,detail:small.length?small.map(b=>`「${b.textContent?.trim().slice(0,10)}」${Math.round(b.getBoundingClientRect().height)}px`).join('、'):'すべて 44px 以上'});
 const clipped=[...sheet.querySelectorAll<HTMLElement>('b,i,small,span,h2,dd,th,td')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).display!=='inline');
 out.push({name:'文字が枠からはみ出さない',ok:!clipped.length,detail:clipped.length?clipped.slice(0,4).map(e=>`「${e.textContent?.slice(0,12)}」`).join('、'):'なし'});
 return out;}

function planChecks(plan:PlanScreen):Check[]{
 const out:Check[]=[],go=plan.root.querySelector<HTMLButtonElement>('.hm-go')!,sheet=plan.root.querySelector<HTMLElement>('section')!;
 const click=(sel:string)=>{const b=plan.root.querySelector<HTMLButtonElement>(sel);if(b&&!b.disabled)b.click();return !!b&&!b.disabled;};
 // 1. Every reachable state by pressing the screen itself (a seeded walk of 600 presses).
 plan.open(null);let seed=7,worst=0,unexplained=0,steps=0;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<600;i++){const slots=[...plan.root.querySelectorAll<HTMLButtonElement>('.slot:not(.fixed):not([data-slot="suit"])')];
  if(!plan.slot){slots[Math.floor(rnd()*slots.length)].click();continue;}
  const opts=[...plan.root.querySelectorAll<HTMLButtonElement>('.opt')];for(const o of opts)if(o.disabled&&!o.querySelector('.why')&&o.dataset.key!=='start')unexplained++;
  const open=opts.filter(o=>!o.disabled);if(open.length)open[Math.floor(rnd()*open.length)].click();steps++;
  worst=Math.max(worst,loadoutGuns(plan.plan).length);}
 out.push({name:`銃は${GUN_LIMIT}丁まで（画面を ${steps} 回選んで確かめる）`,ok:worst<=GUN_LIMIT,detail:`一番多い時 ${worst} 丁`});
 out.push({name:'押せない選択肢には理由が出る',ok:!unexplained,detail:unexplained?`理由なし ${unexplained} 件`:'すべて理由あり'});
 // 2. The pickup needs the gun first, and holds that gun only.
 plan.open({tools:['coin'],pistol:'',start:'S1',pickup:''});click('[data-slot="pickup"]');
 const locs=[...plan.root.querySelectorAll<HTMLButtonElement>('.opt[data-key="pickup"]')].filter(o=>o.dataset.value);
 out.push({name:'銃がないと持ち込みの場所は選べない',ok:locs.length>0&&locs.every(o=>o.disabled),detail:`場所 ${locs.length} か所 · 押せる ${locs.filter(o=>!o.disabled).length}`});
 click('[data-slot="pistol"]');click('.opt[data-value="pistol_silenced"]');click('[data-slot="pickup"]');click('.opt[data-value="P1"]');click('[data-slot="pistol"]');click('.opt[data-value="tranq_pistol"]');
 const g=loadoutGuns(plan.plan);
 out.push({name:'持ち込みに置くのは、選んだ1丁そのもの',ok:g.length===1&&g[0].id==='tranq_pistol'&&g[0].at==='P1',detail:JSON.stringify(g)});
 // 3. Gear slots.
 plan.open({tools:['coin','poison_lethal'],pistol:'',start:'S1',pickup:''});click('[data-slot="gear1"]');const same=plan.root.querySelector<HTMLButtonElement>('.opt[data-value="coin"]');
 out.push({name:'道具 1 と 2 に同じ物は入らない',ok:!!same?.disabled,detail:same?.disabled?'もう一方の物は押せない':'押せてしまう'});
 // 4. A loadout saved by the earlier screen (a gun and a second gun at the pickup).
 plan.open({tools:['coin'],pistol:'pistol_silenced',start:'S1',pickup:'P1',pickupItem:'tranq_pistol'});
 out.push({name:'前の画面の保存（2丁）を読んでも1丁になる',ok:loadoutGuns(plan.plan).length===1,detail:JSON.stringify(plan.plan)});
 // 5. Esc closes the choices; the start button stays on screen with every slot's choices open.
 click('[data-slot="pistol"]');plan.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 out.push({name:'Esc で選択肢を閉じる',ok:!plan.slot,detail:plan.slot?'閉じない':'閉じた'});
 const hidden:string[]=[];for(const s of ['start','pistol','case','gear0','gear1','pickup']){plan.open({tools:['coin'],pistol:'pistol_silenced',start:'S1',pickup:''});click(`[data-slot="${s}"]`);sheet.scrollTop=0;
  const r=go.getBoundingClientRect();if(r.bottom>innerHeight+.5||r.bottom>sheet.getBoundingClientRect().bottom+.5)hidden.push(s);}
 out.push({name:'どの選択肢を開いても「作戦開始」が見える',ok:!hidden.length,detail:hidden.length?`隠れる：${hidden.join('、')}`:'すべて見える'});
 // 6. Layout, on the first view and with the largest picker open.
 plan.open(null);const first=common(sheet);click('[data-slot="pickup"]');click('[data-slot="pistol"]');
 const open=common(sheet).map(c=>({...c,name:c.name+'（選択肢を開いた時）'}));plan.open(null);
 return [...out,...first,...open];}

// The in-game HUD: the game's HITMAN-style drawing code on sample states (?state=calm|trespass|combat|strip).
const HUD_STATES:Record<string,{label:string;make:(t:number)=>Partial<HudState>}>={
 calm:{label:'ふだん',make:()=>({status:[{text:'溶け込んでいる',en:'BLENDING',tone:'teal'}],perm:'allow',suspicion:0,ghost:'ok',health:1})},
 trespass:{label:'立入禁止・疑われている',make:()=>({status:[{text:'立入禁止',en:'TRESPASSING',tone:'amber'},{text:'カメラに映っている',en:'CAMERA',tone:'amber'}],perm:'deny',suspicion:.62,suspicionColor:'#f0b43c',who:'警備',ghost:'erase',health:1,
  marks:[{x:760,y:300,edge:false,angle:0,pct:.62,glyph:'!',color:'#f0b43c',hot:true}],prompt:{text:'E 長押し 扉を開ける',progress:.4}})},
 combat:{label:'撃ち合い',make:()=>({status:[{text:'戦闘',en:'COMBAT',tone:'red'},{text:'追跡されている',en:'HUNTED',tone:'red'},{text:'銃を構えている',en:'WEAPON DRAWN',tone:'red'}],perm:'deny',suspicion:1,suspicionColor:'#e2362b',ghost:'lost',health:.42,
  alarm:{text:'',level:2},reticle:true,inventory:{hand:'消音ピストル',gun:'消音ピストル 6/18 構え',coins:2}})},
 strip:{label:'持ち物の列',make:()=>({status:[],perm:'allow',ghost:'ok',health:1,inventory:{hand:'ハンマー',pocket:'コイン、毒',back:'刀 ×1',coins:3,
  strip:{items:[{label:'素手',kind:'HANDS'},{label:'消音ピストル',kind:'WEAPON'},{label:'ハンマー',kind:'IN HAND'},{label:'毒',kind:'POCKET'},{label:'刀',kind:'BACK'}],cursor:3,current:2}},prompt:{text:'X 刺す',progress:0}})},
};
function hudState(id:string,t:number):HudState{
 const base:HudState={objectives:[{text:'投資家を排除する',state:'todo'},{text:'脱出する',state:'todo'},{text:'監視カメラの記録を残さない',state:'todo',bonus:true}],hint:'',codename:'47',floor:'1F',zone:'ラウンジ',perm:'allow',
  perms:[{label:'客',perm:'allow',here:true},{label:'職員',perm:'caution',here:false},{label:'警備',perm:'deny',here:false}],disguise:'スーツ',suspicion:0,suspicionColor:'#f3efe6',who:'',alerts:0,coins:3,alarm:{text:'',level:0},
  toast:null,prompt:null,marks:[],labels:[],reticle:false,mode:'三人称',hints:[['WASD','移動'],['Shift','走る'],['E長押し','操作'],['Q','銃'],['Esc','一時停止']],
  radar:{x:14,z:20,heading:0,yaw:0,floor:0,npcs:[{x:16,z:22,heading:1,guard:true,color:'#e2362b',active:true},{x:11,z:18,heading:2,guard:false,color:'#f3efe6',active:true}],targets:[{x:30,z:12,kind:'exit'}]},time:t};
 return {...base,...HUD_STATES[id]?.make(t)} as HudState;}
function runHud():()=>Check[]{
 const id=params.get('state')??'calm';
 app.innerHTML=`<div id="scene"></div><canvas id="hud"></canvas><nav id="hud-states">${Object.entries(HUD_STATES).map(([k,v])=>`<a href="?embed=hud&state=${k}${params.get('touch')?'&touch=1':''}" class="${k===id?'on':''}">${v.label}</a>`).join('')}</nav>`;
 const st=document.createElement('style');st.textContent=`#scene{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#3a4048,#14181c 70%)}#hud{position:absolute;inset:0;width:100%;height:100%}
#hud-states{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}#hud-states a{font-size:12px;color:var(--paper);background:rgba(11,15,18,.7);padding:6px 10px;text-decoration:none;border:1px solid var(--faint)}#hud-states a.on{border-color:var(--red)}`;document.head.append(st);
 const hud=new HitmanHud(document.querySelector<HTMLCanvasElement>('#hud')!,clubMap as unknown as ConstructorParameters<typeof HitmanHud>[1]);let error='';
 const frame=()=>{try{hud.draw(hudState(id,performance.now()/1000));}catch(e){error=String(e);}};frame();setInterval(frame,100);addEventListener('resize',()=>{hud.resize();frame();});
 return ()=>{const out:Check[]=[];for(const k of Object.keys(HUD_STATES)){let err='';try{hud.draw(hudState(k,1));}catch(e){err=String(e);}out.push({name:`「${HUD_STATES[k].label}」を描ける`,ok:!err,detail:err||'例外なし'});}
  frame();out.push({name:'表示中の絵で例外が出ていない',ok:!error,detail:error||'なし'});
  return out;};}

// ---- The lab shell: a live view and the checks at every size ----
function runShell(){
 document.title='UI ラボ';
 app.innerHTML=`<div id="lab"><main><nav id="bar"><b>UI ラボ</b><span class="sub">作戦準備・一時停止・結果（HITMAN の形、CLEAN HANDS の色）</span>
<select id="screen">${SCREENS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select><select id="size">${SIZES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select></nav>
<div id="stage"><div id="frame-wrap"><iframe id="frame" title="画面"></iframe></div></div></main>
<aside id="panel"><section><h2>この版の扱い</h2><p>ゲームは前の画面（作戦準備・一時停止・結果・HUD）のまま。ここの判定がすべて通り、課題が片づき、見た目も確かめられたら、ゲームをこの画面に切り替える。</p></section>
<section><h2>決まり</h2><ul><li>銃は1丁まで。身につけて持ち込むか、持ち込みの場所に先に置くか。</li><li>持ち込みは、選んだ銃の置き場所（2丁目は置けない）。</li><li>道具 1・2 に同じ物は入らない。ワイヤーはいつも持つ。</li><li>PC と iPad 横で、はみ出さず、スクロールなしで「作戦開始」が見え、ボタンは 44px 以上。</li></ul></section>
<section><h2>残っている課題</h2><ul><li>済み（11/8）：GHOST の表示を地図の上の外に出した。iPad では「持ち物ボタンで選ぶ」と出す。</li><li>ゲームに入れる時：操作の表（controls.ts）に持ち物の列のキーとタッチの「持ち物」ボタンを戻す。</li><li>HUD：ゲームに入れる時、状況・体力・GHOST・持ち物の作り方を game.ts に戻す（docs/DEVELOPMENT.md）。</li><li>iPad の実機（タッチ）ではまだ見ていない。</li></ul></section>
<section><h2>今の装備</h2><pre id="loadout">—</pre></section>
<section><h2>自動判定</h2><button id="run">すべて判定（4画面 × 2サイズ）</button><div id="summary"></div><div id="results"></div></section></aside></div>`;
 const style=document.createElement('style');style.textContent=`html,body,#app{overflow:hidden}#lab{display:grid;grid-template-columns:1fr 380px;height:100vh}
main{display:flex;flex-direction:column;min-width:0}#bar{display:flex;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--faint);flex-wrap:wrap}#bar .sub{color:var(--dim);font-size:12px;flex:1}
#bar select,#panel button{font:13px var(--jp);background:#161b20;color:var(--paper);border:1px solid var(--faint);padding:6px 10px}
#stage{flex:1;position:relative;overflow:hidden;background:#0d1114}#frame-wrap{position:absolute;left:50%;top:50%;transform-origin:center}
#frame{display:block;border:0;background:#000;box-shadow:0 0 0 1px var(--faint),0 20px 60px rgba(0,0,0,.6)}
#panel{overflow:auto;border-left:1px solid var(--faint);padding:8px 18px 30px;background:#12171b}#panel h2{font:600 13px var(--jp);color:var(--dim);margin:18px 0 8px;letter-spacing:.08em}
#panel p,#panel li{font-size:12px;line-height:1.7;color:rgba(243,239,230,.85)}#panel ul{padding-left:18px;margin:0}#loadout{font:11px/1.5 Consolas,monospace;white-space:pre-wrap;margin:0;color:var(--paper)}
#summary{margin:10px 0;font-weight:700}.pass{color:var(--teal)}.fail{color:var(--red)}#results h3{font:600 12px var(--jp);margin:14px 0 4px}
#results table{width:100%;border-collapse:collapse;font-size:11.5px}#results td{padding:3px 4px;border-top:1px solid var(--faint);vertical-align:top}#results td:first-child{width:22px;font-weight:700}#results small{color:var(--dim)}
#runner{position:fixed;left:-99999px;top:0;border:0}`;document.head.append(style);
 const $=<E extends HTMLElement>(s:string)=>document.querySelector<E>(s)!;
 const frame=$<HTMLIFrameElement>('#frame'),wrap=$('#frame-wrap'),stage=$('#stage');
 const fit=()=>{const s=SIZES.find(x=>x.id===$<HTMLSelectElement>('#size').value)!,k=Math.min((stage.clientWidth-40)/s.w,(stage.clientHeight-40)/s.h,1);
  frame.style.width=s.w+'px';frame.style.height=s.h+'px';wrap.style.transform=`translate(-50%,-50%) scale(${k})`;};
 const touch=()=>$<HTMLSelectElement>('#size').value==='ipad'?'&touch=1':'';
 const load=()=>{frame.src=`${location.pathname}?embed=${$<HTMLSelectElement>('#screen').value}${touch()}`;fit();$('#loadout').textContent='—';};
 $('#screen').onchange=load;$('#size').onchange=load;addEventListener('resize',fit);
 addEventListener('message',e=>{const d=e.data;if(d?.source!=='ui-lab'||e.source!==frame.contentWindow)return;
  if(d.loadout||d.started){const l=cleanLoadout(d.loadout??d.started,mission);$('#loadout').textContent=`${describe(l)}\n銃 ${loadoutGuns(l).length}/${GUN_LIMIT}\n${JSON.stringify(l)}`;}});
 load();
 // Each screen at each size in a hidden iframe of that exact size; the screen runs its own checks and posts them back.
 const runOne=(screen:string,size:typeof SIZES[number])=>new Promise<Check[]>(done=>{const f=document.createElement('iframe');f.id='runner';f.style.width=size.w+'px';f.style.height=size.h+'px';
  const on=(e:MessageEvent)=>{if(e.source!==f.contentWindow||e.data?.source!=='ui-lab')return;if(e.data.ready)setTimeout(()=>f.contentWindow!.postMessage({source:'ui-lab-shell',run:true},'*'),300);
   if(e.data.checks){removeEventListener('message',on);f.remove();done(e.data.checks);}};
  addEventListener('message',on);f.src=`${location.pathname}?embed=${screen}${size.id==='ipad'?'&touch=1':''}`;document.body.append(f);});
 $('#run').onclick=async()=>{$('#summary').textContent='判定中…';$('#results').innerHTML='';let pass=0,all=0;const report:Record<string,Check[]>={};
  for(const s of SCREENS)for(const z of SIZES){const c=await runOne(s.id,z);report[`${s.id}@${z.id}`]=c;pass+=c.filter(x=>x.ok).length;all+=c.length;
   $('#results').insertAdjacentHTML('beforeend',`<h3>${s.label} · ${z.label}</h3><table>${c.map(x=>`<tr><td class="${x.ok?'pass':'fail'}">${x.ok?'○':'×'}</td><td>${x.name}<br><small>${x.detail}</small></td></tr>`).join('')}</table>`);}
  $('#summary').className=pass===all?'pass':'fail';$('#summary').textContent=`${pass} / ${all} 合格${pass===all?' — リリース条件を満たす':''}`;
  (window as unknown as {__uiLab:object}).__uiLab={pass,all,report};};
}

// Started last, once every table above exists.
if(embed)runEmbed(embed);else runShell();
