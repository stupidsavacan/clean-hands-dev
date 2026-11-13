// The observatory's own read-out (2026-11-13): a small panel that shows what the world simulation is doing where the
// player stands — the storm, where the power comes from, this room's light, temperature and oxygen — and, once the
// weather monitor has been read, when lightning will next hit the rod. It only reads the world.
// This is a new stage's own panel, not one of the game's shared screens; it sits under the game's top-left status.
import type {ObservatoryWorld} from './world';

export type PanelState={world:ObservatoryWorld;here:{label:string;temp:number;o2:number;lit:boolean;outdoor:boolean};forecast:boolean};

const CSS=`
#obs-panel{position:fixed;right:12px;top:300px;z-index:6;width:212px;padding:9px 11px 10px;border-radius:10px;background:rgba(12,17,24,.78);
 border:1px solid rgba(160,185,215,.22);color:#dbe5ef;font:12px/1.45 system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif;pointer-events:none;
 backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#obs-panel .row{display:flex;justify-content:space-between;align-items:center;gap:8px;white-space:nowrap}
#obs-panel .k{color:#8ea0b4}
#obs-panel .bar{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
#obs-panel .bar i{display:block;height:100%;background:#7fb2e6;border-radius:3px}
#obs-panel .sep{height:1px;background:rgba(160,185,215,.18);margin:6px 0}
#obs-panel b{font-weight:600}
#obs-panel .warn{color:#ffcf5a}#obs-panel .bad{color:#ff7a66}#obs-panel .ok{color:#8fe0ad}
#obs-panel .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
#obs-panel .tag{padding:1px 6px;border-radius:8px;background:rgba(255,207,90,.16);color:#ffcf5a;font-size:11px}
#obs-panel .tag.bad{background:rgba(255,122,102,.18);color:#ff8f7d}
#obs-sound{position:fixed;right:12px;top:30px;z-index:7;padding:3px 9px;border-radius:9px;border:1px solid rgba(160,185,215,.3);background:rgba(12,17,24,.78);
 color:#dbe5ef;font:12px system-ui,sans-serif;cursor:pointer}
@media (max-width:1100px){#obs-panel{width:190px;font-size:11px}}
`;
const clock=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const SOURCE={line:['送電線','ok'],generator:['発電機','warn'],ups:['蓄電池のみ','bad'],none:['停電','bad']} as const;

export class Panel{
 private readonly root:HTMLDivElement;
 private last='';private lastAt=0;
 constructor(onSound:(on:boolean)=>void){
  const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
  this.root=document.createElement('div');this.root.id='obs-panel';document.body.append(this.root);
  const button=document.createElement('button');button.id='obs-sound';button.textContent='音 切';let on=false;
  button.addEventListener('click',()=>{on=!on;button.textContent=on?'音 入':'音 切';onSound(on);button.blur();});
  document.body.append(button);
 }
 update(s:PanelState,now:number){
  if(now-this.lastAt<.25)return;
  this.lastAt=now;
  const w=s.world,t=w.time,weather=w.weather.at(t),g=w.grid,o=w.def.oxygen;
  const [source,sourceClass]=SOURCE[g.source];
  const o2Class=s.here.o2<o.collapse?'bad':s.here.o2<o.dizzy?'bad':s.here.o2<o.alarm?'warn':'';
  const tempClass=s.here.temp<w.def.comfort.cold?'warn':'';
  const tags:string[]=[];
  if(w.o2Alarm)tags.push('<span class="tag bad">酸素警報</span>');
  if(w.detectorAlarm)tags.push('<span class="tag">検出器 昇温</span>');
  if(w.slit>.05)tags.push(`<span class="tag">シャッター 開 ${Math.round(w.slit*100)}%</span>`);
  if(!w.groundCable)tags.push('<span class="tag bad">避雷針 接地なし</span>');
  if(w.valveOpen&&w.gasLeft>0)tags.push('<span class="tag bad">窒素 放出中</span>');
  const tripped=g.def.circuits.filter(c=>g.breakers.get(c.id)!.tripped||!g.breakers.get(c.id)!.closed).map(c=>c.label.replace(/（.*/,''));
  if(tripped.length)tags.push(`<span class="tag">遮断：${tripped.join('・')}</span>`);
  if(g.shed.size)tags.push('<span class="tag">節電：'+[...g.shed].map(id=>g.circuit(id).label.replace(/（.*/,'')).join('・')+'</span>');
  const next=s.forecast?w.weather.next(t,'rod'):undefined;
  const html=`
<div class="row"><span class="k">嵐</span><span class="bar"><i style="width:${Math.round(weather.intensity*100)}%"></i></span><b>${weather.intensity>.8?'猛烈':weather.intensity>.5?'強い':weather.intensity>.25?'雨':'小康'}</b></div>
<div class="row"><span class="k">電源</span><b class="${sourceClass}">${source}${g.source==='generator'?` ${g.load.toFixed(0)}/${g.def.generator.kw}kW`:g.source==='ups'?` 残${Math.round(g.ups)}秒`:''}</b></div>
${next?`<div class="row"><span class="k">避雷針への落雷</span><b class="warn">${clock(next.time)}（あと${Math.max(0,Math.round(next.time-t))}秒）</b></div>`:s.forecast?'<div class="row"><span class="k">避雷針への落雷</span><b>予報なし</b></div>':''}
<div class="sep"></div>
<div class="row"><span class="k">${s.here.label}</span><b class="${s.here.outdoor||s.here.lit?'':'warn'}">${s.here.outdoor?'屋外':s.here.lit?'点灯':'消灯'}</b></div>
<div class="row"><span class="k">気温</span><b class="${tempClass}">${s.here.temp.toFixed(0)}℃</b><span class="k">酸素</span><b class="${o2Class}">${s.here.o2.toFixed(1)}%</b></div>
${tags.length?`<div class="tags">${tags.join('')}</div>`:''}`;
  if(html!==this.last){this.last=html;this.root.innerHTML=html;}
 }
}
