import club from '../data/club-map.json' with {type:'json'};
import plans from '../data/club-schedule.json' with {type:'json'};
import rules from '../data/club-rules.json' with {type:'json'};
import definitions from '../data/club-chances.json' with {type:'json'};
import {Chances,type ChancesData,type Done} from '../chances.ts';
import {MissionEvents,type MissionEvent} from '../events.ts';
import type {ScheduleData} from '../schedule.ts';

type Row=Record<string,unknown>;
type RecordRun={meta?:Row;events?:Row[];telemetry?:Row[];samples?:Row[];end?:Row};
const actors=(plans as ScheduleData).actors;
const places=club.schedulePlaces as Record<string,{label:string}>;
const mmss=(time:number)=>Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');
const clock=(row:Row)=>Number(row.t??row.time??row.play??0);
// The recorder saves {success,reason} when a mission ends and a short word when the page is closed (playtest/server.py).
const REASONS:Record<string,string>={caught:'捕まった',killed:'倒された',target_escaped:'標的が逃げた'};
const outcome=(run:RecordRun)=>{
 const o=run.end?.outcome as {success?:boolean;reason?:string}|string|undefined;
 if(o&&typeof o==='object')return o.success?'成功（脱出）':'失敗：'+(REASONS[String(o.reason)]??String(o.reason));
 return String(o??run.end?.why??'未終了');
};
const mean=(values:number[])=>values.length?values.reduce((sum,n)=>sum+n,0)/values.length:null;
const amount=(v:number|null)=>v===null?'記録なし':v.toFixed(2);
const samples=(run:RecordRun,key:string)=>mean((run.samples??[]).flatMap(s=>typeof s[key]==='number'&&Number.isFinite(s[key])?[s[key]]:[]));

export function mountDevelopmentInspector(panel:HTMLElement){
 panel.innerHTML=`<details><summary>NPC予定・AI判断・プレイ記録</summary>
  <p>クラブの通常予定と、記録された判断・移動・復帰を同じ時刻で確認します。性能の時間はCPU計測です。</p>
  <label>NPC <select data-npc></select></label>
  <label>ゲーム時刻（秒） <input data-clock type="number" min="0" value="0" step="1"></label>
  <label>記録A <input data-file="0" type="file" accept=".json,application/json"></label>
  <label>記録B <input data-file="1" type="file" accept=".json,application/json"></label>
  <p data-record-status role="status"></p><pre data-comparison></pre><pre data-schedule></pre>
  <label>判断・イベント <select data-trace></select></label><pre data-row></pre>
 </details>
 <details><summary>ミッションチャンス編集・検証</summary>
  <textarea rows="10" data-chances aria-label="チャンスのJSON" spellcheck="false"></textarea>
  <div class="lab-row"><button type="button" data-validate>検証する</button><button type="button" data-save>JSONを保存</button></div>
  <pre data-chance-result></pre>
 </details>`;
 const style=document.createElement('style');
 style.textContent='#development-inspector{margin-top:14px}#development-inspector details{margin:8px 0}#development-inspector label{display:block;margin:5px 0}#development-inspector input,#development-inspector select,#development-inspector textarea{max-width:100%}#development-inspector textarea{box-sizing:border-box;width:100%}#development-inspector pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#15171b;padding:5px}';
 document.head.append(style);
 const $=<E extends HTMLElement=HTMLElement>(attr:string)=>panel.querySelector<E>('[data-'+attr+']')!;
 const select=$<HTMLSelectElement>('npc'),time=$<HTMLInputElement>('clock'),trace=$<HTMLSelectElement>('trace');
 const chanceText=$<HTMLTextAreaElement>('chances');
 const runs:Array<RecordRun|undefined>=[undefined,undefined];
 const names=new Map(club.npcs.map(n=>[n.id,n.label]));
 const match=(r:Row,id:string)=>r.id===id||r.npc===id||r.target===id;
 chanceText.value=JSON.stringify(definitions,null,2);
 time.max=String(rules.schedule.loop-1);
 for(const [id,label] of names)select.add(new Option(label+' · '+id,id));
 const showRow=()=>{$('row').textContent=trace.selectedIndex<0?'該当する記録がありません':JSON.stringify(rows[trace.selectedIndex],null,2);};
 let rows:Row[]=[];
 function update(){
  const id=select.value,plan=actors[id],actual=runs[0];
  const source=plan?.follow?actors[plan.follow]:plan;
  const seconds=Math.max(0,Number(time.value)||0),phase=seconds%rules.schedule.loop;
  const lines=(source?.plan??[]).map(e=>(phase>=e.from&&phase<e.to?'▶ ':'  ')+mmss(e.from)+'–'+mmss(e.to)+' '+(plan.follow?'escort':e.do)+' · '+(places[e.place]?.label??e.place));
  const report=[...(actual?.telemetry??[])].filter(r=>r.kind==='npc-decision'&&r.id===id&&clock(r)<=seconds).sort((a,b)=>clock(a)-clock(b)).at(-1);
  $('schedule').textContent=['通常予定（クラブ）',...(lines.length?lines:['予定なし']), '', '記録Aの実際の行動',report
   ?[mmss(clock(report)),report.phase,report.actual||report.planned,report.cause,report.navigation,report.timedOut?'予定の移動時間超過':''].filter(Boolean).join(' · ')
   :'この時刻の判断記録なし'].join('\n');
  const current=rows[trace.selectedIndex];
  rows=[...(actual?.events??[]),...(actual?.telemetry??[])].filter(r=>match(r,id)).sort((a,b)=>clock(a)-clock(b));
  trace.replaceChildren(...rows.map((r,i)=>new Option(mmss(clock(r))+' · '+String(r.type??r.kind)+' '+String(r.reason??r.navigation??''),String(i))));
  if(current){
   const index=rows.indexOf(current);
   if(index>=0)trace.selectedIndex=index;
  }
  showRow();
  const summary=runs.map((run,i)=>run?String.fromCharCode(65+i)+' · '+outcome(run)+' · '+(run.events?.length??0)+' イベント\n'+
   ['fps','jsFrameMs','simulationMs','aiMs','renderSubmitMs','playerCollisionMs','drawCalls','triangles','traversalErrorCm'].map(key=>key+' '+amount(samples(run,key))).join(' / '):'').filter(Boolean);
  if(runs[0]&&runs[1]){
   const [a,b]=runs;
   const similar=!!a.meta?.map&&!!a.meta?.scenario&&['scenario','map','startTime','loadout','viewport'].every(key=>JSON.stringify(a.meta?.[key])===JSON.stringify(b.meta?.[key]));
   const delta=(key:string)=>{const x=samples(a,key),y=samples(b,key);return amount(x===null||y===null?null:y-x);};
   summary.push((similar?'同じ記録設定':'記録設定が異なります')+' · B−A\nFPS '+delta('fps')+' / JS ms '+delta('jsFrameMs')+' / IK cm '+delta('traversalErrorCm')+' / イベント数 '+((b.events?.length??0)-(a.events?.length??0)));
  }
  $('comparison').textContent=summary.join('\n');
 }
 select.onchange=update;time.oninput=update;trace.onchange=showRow;
 panel.querySelectorAll<HTMLInputElement>('[data-file]').forEach((input,i)=>{
  input.onchange=async()=>{
   const file=input.files?.[0];if(!file)return;
   try{
    const json=JSON.parse(await file.text()) as RecordRun;
    if(!json||![json.events,json.telemetry,json.samples].some(Array.isArray)||
     [json.events,json.telemetry,json.samples].some(r=>r!==undefined&&(!Array.isArray(r)||r.some(x=>!x||typeof x!=='object'))))
     throw new Error('プレイ記録の JSON を選んでください');
    runs[i]=json;$('record-status').textContent=file.name;update();
   }catch(error){$('record-status').textContent=String(error);}finally{input.value='';}
  };
 });
 function checkedChances(){
  const parsed=JSON.parse(chanceText.value) as ChancesData;
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('チャンスをJSONオブジェクトで指定してください');
  const done=(x:Done):boolean=>!!x&&typeof x==='object'&&(x.any!==undefined
   ?Array.isArray(x.any)&&x.any.length>0&&x.any.every(done)
   :[x.disguise,x.talked,x.event,x.armed,x.flag,x.killed].filter(v=>typeof v==='string'&&v.length>0).length===1);
  for(const [id,c] of Object.entries(parsed)){
   if(!c||typeof c.title!=='string'||!names.has(c.target)||typeof c.trigger?.heard!=='string'||
    !Array.isArray(c.window)||c.window.length!==2||!c.window.every(Number.isFinite)||c.window[0]<0||
    c.window[0]>=c.window[1]||c.window[1]>rules.schedule.loop||
    !Array.isArray(c.steps)||!c.steps.length||!c.steps.every(step=>step&&typeof step.text==='string'&&done(step.done)))
    throw new Error(id+' の標的・発見条件・時間帯・手順を確認してください');
  }
  return parsed;
 }
 function validate(){
  try{
   const parsed=checkedChances(),events=new MissionEvents(),chances=new Chances(parsed,events);
   for(const row of runs[0]?.events??[]){
    if(typeof row.type==='string')events.emit({...row,time:clock(row)} as MissionEvent);
   }
   $('chance-result').textContent=Object.entries(parsed).map(([id,def])=>{
    const state=chances.states.get(id)!;
    return def.title+' · 発見 '+def.trigger.heard+' · '+mmss(def.window[0])+'–'+mmss(def.window[1])+'\n'+
     def.steps.map((step,i)=>(i+1)+'. '+step.text+' '+JSON.stringify(step.done)).join('\n')+
     (runs[0]?'\n記録Aのイベント結果 '+state.status+' '+state.stage+'/'+def.steps.length:'');
   }).join('\n\n');
   return parsed;
  }catch(error){$('chance-result').textContent=String(error);return null;}
 }
 $('validate').onclick=validate;
 $('save').onclick=()=>{
  const value=validate();if(!value)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,1)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='club-chances.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 update();
}
