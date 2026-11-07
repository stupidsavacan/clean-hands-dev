// 2026-11-06: brought over from the M5.8 mobile build (outputs/m55-mobile) for the one-file mobile page (mobile.ts),
// with the buttons of today's actions: X (kill, stab, finish, the fight's second key) sits by F for the fight.
// Touch controls drawn on their own canvas in the HUD's visual language; they feed the same key codes as the keyboard.
// Same palette and fonts as hud.ts (kept local so the layout stays testable without the DOM-bound HUD module).
const INK='#0b0f12',PAPER='#f3efe6',DIM='rgba(243,239,230,.56)',FAINT='rgba(243,239,230,.16)',RED='#e2362b',TEAL='#5fc7b0';
const LATIN='Bahnschrift, "Segoe UI", system-ui, sans-serif',JP='"Yu Gothic UI", "Hiragino Sans", Meiryo, system-ui, sans-serif';
export function stickDirections(dx:number,dy:number,radius=48):string[]{
 const d=Math.hypot(dx,dy);if(d<radius*.22)return [];
 const out:string[]=[];if(Math.abs(dx)/d>.38)out.push(dx>0?'KeyD':'KeyA');if(Math.abs(dy)/d>.38)out.push(dy>0?'KeyS':'KeyW');return out;
}
type Options={key:(code:string,down:boolean,cancelled?:boolean)=>void;tap:(code:string)=>void;look:(dx:number,dy:number)=>void;aim:(x:number,y:number)=>void;blocked:()=>boolean};
type Kind='hold'|'tap';
export type TouchButton={id:string;code:string;kind:Kind;label:string;sub:string;x:number;y:number;r:number;w?:number;h?:number;primary?:boolean};
export type TouchLayout={stick:{x:number;y:number;r:number};buttons:TouchButton[];tools:TouchButton[]};
type Insets={top:number;right:number;bottom:number;left:number};
const ACTIONS:[string,string,string,string][]=[['KeyF','気絶・格闘','SUBDUE · FIGHT','hold'],['KeyX','排除','LETHAL','hold'],['KeyT','着替え','DISGUISE','hold']];
const TOGGLES:[string,string,string][]=[['run','走る','RUN'],['KeyC','しゃがむ','CROUCH'],['more','道具','TOOLS']];
const TOOLS:[string,string,string,Kind][]=[['KeyG','投げる','COIN / ITEM','tap'],['KeyH','ワイヤー置く','PLACE / TAKE','hold'],['KeyV','視点','VIEW','tap'],['KeyZ','ズーム','ZOOM','tap'],['KeyE','使う・拾う','USE / PICK UP','hold'],['KeyJ','話す・誘う','TALK / LURE','hold'],['KeyP','突き落とす','HOLD · LETHAL','hold'],['KeyU','持ち物を置く','PUT DOWN','tap'],['KeyB','検査','FRISK','hold'],['KeyO','持ち物','INVENTORY','tap'],['KeyK','背中の刀','SWORD · BACK','tap'],['KeyI','ケース出し入れ','CASE','tap'],['drop','銃を捨てる','HOLD · DROP','hold']];
// A radial cluster around the primary button for the right thumb, a stick for the left; tools open as a row of chips.
/** UI scale for touch screens: 1 on phones, up to 1.5 on tablets (an iPad in landscape is 1080x810 → 1.45), so the
 * controls, the canvas HUD and the overlays keep the thumb reach and text size they were drawn for. */
export function uiScale(w=innerWidth,h=innerHeight){if(!document.body?.classList.contains?.('touch-enabled'))return 1;return Math.min(1.5,Math.max(1,Math.min(w,h)/560));}
export function touchLayout(w:number,h:number,inset:Insets={top:0,right:0,bottom:0,left:0},armed=false):TouchLayout{
 const land=h<520||w>h,m=land?16:22,P=land?33:38,S=land?23:26,T=land?19:21;
 const sr=land?50:60,stick={x:inset.left+m+sr+4,y:h-inset.bottom-m-sr-(land?2:18),r:sr};
 const px=w-inset.right-m-P,py=h-inset.bottom-m-P-(land?0:16);
 const at=(deg:number,d:number)=>({x:px+Math.cos(deg*Math.PI/180)*d,y:py+Math.sin(deg*Math.PI/180)*d});
 const d1=P+S+12,d2=d1+S+T+12;
 const buttons:TouchButton[]=[{id:'primary',code:armed?'Space':'KeyE',kind:'hold',label:armed?'撃つ':'使う',sub:armed?'FIRE':'USE · CARRY',x:px,y:py,r:P,primary:true}];
 ACTIONS.forEach(([code,label,sub],i)=>buttons.push({id:code,code,kind:'hold',label,sub,...at(180+i*45,d1),r:S}));
 TOGGLES.forEach(([code,label,sub],i)=>buttons.push({id:code,code,kind:'tap',label,sub,...at(202+i*34,d2),r:T}));
 const top=Math.min(stick.y-sr,...buttons.map(b=>b.y-b.r));
 const cols=land?8:3,gap=6,cw=Math.min(land?76:112,(w-inset.left-inset.right-2*m-(cols-1)*gap)/cols),ch=40;
 const total=cols*cw+(cols-1)*gap,rowY=top-54;
 // Weapon controls remain visible while the tools panel is closed.
 buttons.push({id:'weapon',code:'KeyQ',kind:'tap',label:'銃',sub:'DRAW / HOLSTER',x:w-inset.right-m-122,y:rowY+20,r:0,w:96,h:ch},
  {id:'reload',code:'reload',kind:'tap',label:'装填',sub:'RELOAD',x:w-inset.right-m-32,y:rowY+20,r:0,w:64,h:ch});
 const rows=Math.ceil(TOOLS.length/cols),tools=TOOLS.map(([code,label,sub,kind],i)=>({id:'tool-'+code,code,kind,label,sub,x:(w-total)/2+(i%cols)*(cw+gap)+cw/2,y:Math.max(inset.top+52,rowY-rows*(ch+gap)-8)+Math.floor(i/cols)*(ch+gap)+ch/2,r:0,w:cw,h:ch}));
 return {stick,buttons,tools};
}
function hit(b:TouchButton,x:number,y:number){return b.w?Math.abs(x-b.x)<=b.w/2+4&&Math.abs(y-b.y)<=b.h!/2+4:Math.hypot(x-b.x,y-b.y)<=b.r+8;}
type Grab={role:'stick'}|{role:'look';x:number;y:number}|{role:'hold';code:string;id:string;started:number}|{role:'tap';id:string};
export class TouchControls{
 readonly root:HTMLCanvasElement;enabled=false;private c:CanvasRenderingContext2D;private w=0;private h=0;private dpr=1;private inset:Insets={top:0,right:0,bottom:0,left:0};
 private layout!:TouchLayout;private grabs=new Map<number,Grab>();private walking:string[]=[];private knob={x:0,y:0};
 private running=false;private crouched=false;private toolsOpen=false;private frozen=true;private armed=false;private k=1;private options:Options;private probe:HTMLDivElement;
 constructor(_view:HTMLCanvasElement,options:Options){this.options=options;
  this.root=document.createElement('canvas');this.root.id='touch-controls';this.root.setAttribute('aria-label','タッチ操作。左下で移動、右下で行動、空いた場所をなぞって見回す');this.c=this.root.getContext('2d')!;
  this.probe=document.createElement('div');this.probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.querySelector('#app')!.append(this.root,this.probe);
  const media=matchMedia('(pointer:coarse),(max-width:920px)');// The one-file mobile page (mobile.ts) always shows them, also on a large touch screen that reports a fine pointer.
  const update=()=>{this.enabled=media.matches||!!(window as {__forceTouch?:boolean}).__forceTouch;document.body.classList.toggle('touch-enabled',this.enabled);if(!this.enabled)this.release();if(this.layout)this.resize();};
  // iPad Safari: no pinch or double-tap zoom over the game (the canvas already has touch-action:none).
  for(const t of ['gesturestart','gesturechange'])document.addEventListener(t,e=>e.preventDefault());media.addEventListener('change',update);update();
  this.resize();addEventListener('resize',()=>this.resize());
  this.root.addEventListener('pointerdown',e=>this.down(e));this.root.addEventListener('pointermove',e=>this.move(e));
  for(const t of ['pointerup','pointercancel','lostpointercapture'])this.root.addEventListener(t,e=>this.up(e as PointerEvent,t==='pointerup'));
  this.root.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('blur',()=>this.release());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.release();});
 }
 private resize(){this.release();const cs=getComputedStyle(this.probe);this.inset={top:parseFloat(cs.paddingTop)||0,right:parseFloat(cs.paddingRight)||0,bottom:parseFloat(cs.paddingBottom)||0,left:parseFloat(cs.paddingLeft)||0};
  this.k=uiScale();document.documentElement?.style.setProperty('--ui',String(this.k));for(const s of ['top','right','bottom','left'] as const)this.inset[s]/=this.k;
  this.dpr=Math.min(devicePixelRatio||1,2);this.w=innerWidth/this.k;this.h=innerHeight/this.k;this.root.width=Math.round(innerWidth*this.dpr);this.root.height=Math.round(innerHeight*this.dpr);this.layout=touchLayout(this.w,this.h,this.inset,this.armed);}
 private find(x:number,y:number){if(this.toolsOpen)for(const b of this.layout.tools)if(hit(b,x,y))return b;for(const b of this.layout.buttons)if(hit(b,x,y))return b;return null;}
 private pressed(id:string){for(const g of this.grabs.values())if((g.role==='hold'||g.role==='tap')&&g.id===id)return true;return false;}
 private down(e:PointerEvent){if(this.options.blocked())return;e.preventDefault();try{this.root.setPointerCapture(e.pointerId);}catch{}const x=e.clientX/this.k,y=e.clientY/this.k,s=this.layout.stick;
  const b=this.find(x,y);
  if(b){if(this.pressed(b.id))return;if(b.kind==='hold'){this.grabs.set(e.pointerId,{role:'hold',code:b.code,id:b.id,started:performance.now()});if(b.code!=='drop')this.options.key(b.code,true);}else this.grabs.set(e.pointerId,{role:'tap',id:b.id});return;}
  if(Math.hypot(x-s.x,y-s.y)<=s.r*1.35&&![...this.grabs.values()].some(g=>g.role==='stick')){this.grabs.set(e.pointerId,{role:'stick'});this.steer(x,y);return;}
  if(this.toolsOpen){this.toolsOpen=false;}
  this.options.aim(e.clientX,e.clientY);this.grabs.set(e.pointerId,{role:'look',x:e.clientX,y:e.clientY});}
 private move(e:PointerEvent){const g=this.grabs.get(e.pointerId);if(!g)return;if(g.role==='stick')this.steer(e.clientX/this.k,e.clientY/this.k);else if(g.role==='look'){this.options.look(e.clientX-g.x,e.clientY-g.y);this.options.aim(e.clientX,e.clientY);g.x=e.clientX;g.y=e.clientY;}}
 private up(e:PointerEvent,released:boolean){const g=this.grabs.get(e.pointerId);if(!g)return;this.grabs.delete(e.pointerId);
  if(g.role==='stick')this.stopWalking();else if(g.role==='hold'){if(g.code==='drop'){const b=this.find(e.clientX/this.k,e.clientY/this.k);if(released&&b?.id===g.id&&performance.now()-g.started>=700&&!this.options.blocked())this.options.tap('drop');}else this.options.key(g.code,false,!released);}
  else if(g.role==='tap'&&released){const b=this.find(e.clientX/this.k,e.clientY/this.k);if(b?.id===g.id)this.tap(b.code);}}
 private tap(code:string){if(this.options.blocked())return;if(code==='run'){this.running=!this.running;this.options.key('ShiftLeft',this.running);}else if(code==='more')this.toolsOpen=!this.toolsOpen;else{if(this.layout.tools.some(t=>t.code===code))this.toolsOpen=false;this.options.tap(code);}}
 private steer(x:number,y:number){const s=this.layout.stick,dx=x-s.x,dy=y-s.y,d=Math.hypot(dx,dy),lim=s.r*.8,k=d>lim?lim/d:1;this.knob={x:dx*k,y:dy*k};
  const next=stickDirections(dx,dy,s.r*.8);for(const key of this.walking)if(!next.includes(key))this.options.key(key,false);for(const key of next)if(!this.walking.includes(key))this.options.key(key,true);this.walking=next;}
 private stopWalking(){for(const k of this.walking)this.options.key(k,false);this.walking=[];this.knob={x:0,y:0};}
 release(){for(const g of this.grabs.values())if(g.role==='hold'&&g.code!=='drop')this.options.key(g.code,false,true);this.grabs.clear();this.stopWalking();if(this.running)this.options.key('ShiftLeft',false);this.running=false;this.toolsOpen=false;}
 update(blocked:boolean,crouched:boolean,hasWire:boolean,armed=false){if(this.armed!==armed){for(const [id,g] of this.grabs)if(g.role==='hold'&&g.id==='primary'){this.options.key(g.code,false,true);this.grabs.delete(id);}this.armed=armed;this.layout=touchLayout(this.w,this.h,this.inset,armed);}if(blocked&&!this.frozen)this.release();this.frozen=blocked;this.crouched=crouched;void hasWire;
  this.root.hidden=blocked||!this.enabled;if(!this.root.hidden)this.draw();}
 // ---------------------------------------------------------------- drawing
 private text(t:string,x:number,y:number,size:number,color:string,font=JP,weight=600,spacing=0){const c=this.c;c.font=`${weight} ${size}px ${font}`;c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';
  if('letterSpacing' in c)(c as any).letterSpacing=spacing+'px';c.fillText(t,x+spacing/2,y);if('letterSpacing' in c)(c as any).letterSpacing='0px';}
 private draw(){const c=this.c,L=this.layout;c.setTransform(this.dpr*this.k,0,0,this.dpr*this.k,0,0);c.clearRect(0,0,this.w,this.h);
  this.drawStick();
  for(const b of L.buttons)if(b.w)this.drawChip(b);else this.drawButton(b);
  if(this.toolsOpen)for(const b of L.tools)this.drawChip(b);}
 private drawStick(){const c=this.c,s=this.layout.stick,active=this.walking.length>0||[...this.grabs.values()].some(g=>g.role==='stick');
  c.fillStyle='rgba(11,15,18,.34)';c.beginPath();c.arc(s.x,s.y,s.r,0,Math.PI*2);c.fill();
  c.strokeStyle=active?'rgba(243,239,230,.42)':FAINT;c.lineWidth=1;c.beginPath();c.arc(s.x,s.y,s.r,0,Math.PI*2);c.stroke();
  c.setLineDash([2,5]);c.beginPath();c.arc(s.x,s.y,s.r*.56,0,Math.PI*2);c.stroke();c.setLineDash([]);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,l=i%2?4:8;c.strokeStyle=i%2?FAINT:DIM;c.beginPath();c.moveTo(s.x+Math.cos(a)*(s.r-l),s.y+Math.sin(a)*(s.r-l));c.lineTo(s.x+Math.cos(a)*s.r,s.y+Math.sin(a)*s.r);c.stroke();}
  const k=this.knob,mag=Math.hypot(k.x,k.y);
  if(mag>4){const a=Math.atan2(k.y,k.x);c.strokeStyle=RED;c.lineWidth=3;c.beginPath();c.arc(s.x,s.y,s.r-1.5,a-.42,a+.42);c.stroke();c.lineWidth=1;
   c.strokeStyle='rgba(226,54,43,.5)';c.beginPath();c.moveTo(s.x,s.y);c.lineTo(s.x+k.x,s.y+k.y);c.stroke();}
  const kx=s.x+k.x,ky=s.y+k.y,kr=s.r*.34;c.fillStyle=active?'rgba(243,239,230,.9)':'rgba(243,239,230,.72)';c.beginPath();c.arc(kx,ky,kr,0,Math.PI*2);c.fill();
  c.strokeStyle=INK;c.globalAlpha=.35;c.beginPath();c.arc(kx,ky,kr*.55,0,Math.PI*2);c.stroke();c.globalAlpha=1;
  this.text(this.running?'MOVE · RUN':'MOVE',s.x,s.y-s.r-12,9,this.running?TEAL:DIM,LATIN,600,2.5);}
 private drawButton(b:TouchButton){const c=this.c,down=this.pressed(b.id),on=(b.code==='run'&&this.running)||(b.code==='KeyC'&&this.crouched)||(b.code==='more'&&this.toolsOpen);
  c.fillStyle=down?(b.primary?'rgba(226,54,43,.72)':'rgba(226,54,43,.5)'):b.primary?'rgba(70,22,18,.62)':'rgba(11,15,18,.5)';c.beginPath();c.arc(b.x,b.y,b.r,0,Math.PI*2);c.fill();
  c.lineWidth=b.primary?1.5:1;c.strokeStyle=down?RED:on?TEAL:b.primary?'rgba(226,54,43,.85)':'rgba(243,239,230,.3)';c.beginPath();c.arc(b.x,b.y,b.r,0,Math.PI*2);c.stroke();
  if(b.primary){c.strokeStyle='rgba(226,54,43,.35)';c.beginPath();c.arc(b.x,b.y,b.r+5,-Math.PI*.85,-Math.PI*.15);c.stroke();}
  if(on){c.fillStyle=TEAL;c.beginPath();c.arc(b.x,b.y-b.r+5,2,0,Math.PI*2);c.fill();}
  const big=b.r>=30,size=big?16:b.label.length>3?10:b.r<22?11:12;
  this.text(b.label,b.x,b.y-(b.r>=22?4:3),size,on?TEAL:PAPER,JP,700);
  this.text(b.sub.split(' · ')[0],b.x,b.y+(big?13:b.r>=22?9:8),big?8:6.5,down?PAPER:on?TEAL:DIM,LATIN,600,1.2);
  if(b.kind==='hold'&&!b.primary){c.strokeStyle=down?PAPER:FAINT;c.beginPath();c.arc(b.x,b.y,b.r-3,Math.PI*.62,Math.PI*.38,true);c.stroke();}}
 private drawChip(b:TouchButton){const c=this.c,down=this.pressed(b.id),off=false,w=b.w!,h=b.h!,x=b.x-w/2,y=b.y-h/2;
  c.globalAlpha=off?.38:1;c.fillStyle=down?'rgba(226,54,43,.55)':'rgba(11,15,18,.82)';c.fillRect(x,y,w,h);
  c.strokeStyle=down?RED:'rgba(243,239,230,.28)';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);c.fillStyle=b.code==='KeyX'?RED:TEAL;c.fillRect(x,y,2,h);
  this.text(b.label,b.x,b.y-6,12,PAPER,JP,700);this.text(b.sub,b.x,b.y+10,7,DIM,LATIN,600,1.2);c.globalAlpha=1;}
}
