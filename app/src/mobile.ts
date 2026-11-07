// 2026-11-06: the one-file mobile page (clean-hands-mobile.html; iPad 9th gen in landscape first). The club and the
// hotel are both in the file; ?map=club|hotel (or the last one played) picks which one runs. Switching reloads the page,
// since each game builds its own page when it starts. Touch controls (touch.ts) send the same key events as a keyboard,
// so the games need nothing mobile-specific beyond the small window.__mobile hooks (look, aim, state, drop).
import './mobile.css';
import {TouchControls} from './touch';

type Hooks={look:(dx:number,dy:number)=>void;aim:(x:number,y:number)=>void;blocked:()=>boolean;state:()=>{crouched:boolean;hasWire:boolean;armed:boolean};drop:()=>void};
const MAPS={club:'クラブ',hotel:'ホテル'} as const;
type MapId=keyof typeof MAPS;
const STORE='clean-hands-mobile-map';
const stored=(()=>{try{return localStorage.getItem(STORE);}catch{return null;}})();
const asked=new URLSearchParams(location.search).get('map');
const map:MapId=asked==='hotel'||asked==='club'?asked:stored==='hotel'?'hotel':'club';
try{localStorage.setItem(STORE,map);}catch{/* private mode: the URL still works */}
(window as {__forceTouch?:boolean}).__forceTouch=true;
document.title=`CLEAN HANDS — ${MAPS[map]}（モバイル）`;

const key=(code:string,down:boolean)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));
const tap=(code:string)=>{key(code,true);key(code,false);};

function switchTo(next:MapId){
 if(next===map)return;
 if(!confirm(`${MAPS[next]}に切り替えます。今の作戦はここで終わります。`))return;
 try{localStorage.setItem(STORE,next);}catch{/* the URL carries it */}
 const url=new URL(location.href);url.searchParams.set('map',next);location.href=url.toString();
}

// Top-left bar: map, menu (pause), and the switch to the other place. Always reachable, above the touch layer.
function bar(){
 const nav=document.createElement('nav');nav.id='mobile-bar';nav.setAttribute('aria-label','モバイル操作');
 const other:MapId=map==='club'?'hotel':'club';
 const items:[string,string,()=>void][]=[['地図','Tab',()=>tap('Tab')],['メニュー','Escape',()=>tap('Escape')],[`${MAPS[other]}へ`,'switch',()=>switchTo(other)]];
 for(const [label,id,run] of items){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.action=id;b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();run();});nav.append(b);}
 const here=document.createElement('span');here.textContent=MAPS[map];nav.prepend(here);
 document.body.append(nav);
}

async function start(){
 if(map==='hotel')await import('./main');else await import('./club/main');
 const hooks=(window as {__mobile?:Hooks}).__mobile;const canvas=document.querySelector<HTMLCanvasElement>('#view');
 bar();
 if(!hooks||!canvas){console.error('mobile hooks missing');return;}
 const touch=new TouchControls(canvas,{blocked:hooks.blocked,key,look:hooks.look,aim:hooks.aim,
  tap:code=>{if(code==='reload'){tap('KeyR');return;}if(code==='drop'){hooks.drop();return;}tap(code);}});
 const frame=()=>{const s=hooks.state();touch.update(hooks.blocked()||document.hidden,s.crouched,s.hasWire,s.armed);requestAnimationFrame(frame);};
 requestAnimationFrame(frame);
 Object.assign(window,{__mobilePage:{map,touch,switchTo}});
}
void start();
