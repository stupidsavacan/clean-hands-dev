// The HITMAN-style HUD (2026-11-06), moved out of hud.ts on 2026-11-07 so the game shows its earlier HUD until this one
// is finished in the UI lab (ui-lab.html). Same drawing code as it was in the game; the state it needs is HudState below.
// The in-game HUD, drawn every frame on one 2D canvas over the 3D view.
// 2026-11-06: laid out the way the HITMAN games arrange theirs (information design only; CLEAN HANDS' own colours
// and type): the map in the bottom-left corner with the current situation written under it, the outfit, the
// suspicion and health bars and the Silent Assassin (ghost) mark beside it; objectives top-left; what is in hand
// bottom-right; who is getting suspicious as marks around the centre of the screen; the action prompt as a key and a
// verb, red when the act is a crime.
export type Perm='allow'|'caution'|'deny';
// face: the white gauge of someone who knows the current outfit's faces (0..1), undefined for everyone else.
export type HudMark={x:number;y:number;edge:boolean;angle:number;pct:number;glyph:string;color:string;hot:boolean;face?:number};
export type RadarNpc={x:number;z:number;heading:number;guard:boolean;color:string;active:boolean};
export type HudState={
 objectives:{text:string;state:'todo'|'done'|'failed';bonus?:boolean}[];hint:string;codename:string;
 floor:string;zone:string;perm:Perm;perms:{label:string;perm:Perm;here:boolean}[];disguise:string;
 suspicion:number;suspicionColor:string;who:string;alerts:number;coins:number;
 alarm:{text:string;level:number};toast:{text:string;age:number}|null;prompt:{text:string;progress:number}|null;
 marks:HudMark[];labels:{x:number;y:number;text:string}[];reticle:boolean;mode:string;hints:[string,string][];
 radar:{x:number;z:number;heading:number;yaw:number;floor:number;npcs:RadarNpc[];targets:{x:number;z:number;kind:'panel'|'exit'}[]};time:number;
 // The situation, most serious first (TRESPASSING, HOSTILE AREA, SEARCHING, COMPROMISED, HUNTED, COMBAT, and the
 // agent's own: blending, hidden, an illegal thing in view, on camera). Maps that leave it out show none.
 status?:HudStatus[];
 /** 0..1, or undefined to hide the bar. */ health?:number;
 /** The ghost rating: still on, on only if the recording is erased, or lost. */ ghost?:'ok'|'erase'|'lost';
 /** What the agent carries, bottom-right. */ inventory?:{hand?:string;gun?:string;back?:string;inCase?:string;coins?:number;pocket?:string;
  // The inventory row (HITMAN-style), shown while choosing: every thing carried, the one picked and the one in hand.
  strip?:{items:{label:string;kind:string}[];cursor:number;current:number}}};
export type HudStatus={text:string;en:string;tone:'red'|'amber'|'teal'|'dim'};
type Box={x:number;z:number;w:number;d:number;floor?:number};
type Area={minX:number;maxX:number;minZ:number;maxZ:number};
type Level={walls:Box[];blockers:(Box&{id:string;floor?:number})[];floors:{floor:number;y:number;areas:Area[]}[];zones:(Area&{type:string;floor:number})[];stairs:(Area&{low:number;high:number;floor?:number})[];name?:string};
export const INK='#0b0f12',PAPER='#f3efe6',DIM='rgba(243,239,230,.56)',FAINT='rgba(243,239,230,.16)',RED='#e2362b',AMBER='#f0b43c',TEAL='#5fc7b0';
export const LATIN='Bahnschrift, "Segoe UI", system-ui, sans-serif',JP='"Yu Gothic UI", "Hiragino Sans", Meiryo, system-ui, sans-serif';
const PERM_TEXT:Record<Perm,string>={allow:'可',caution:'注意',deny:'不可'},PERM_COLOR:Record<Perm,string>={allow:TEAL,caution:AMBER,deny:RED};
const RADAR_RANGE=15;
export class HitmanHud{
 private c:CanvasRenderingContext2D;private w=0;private h=0;private dpr=1;
 // Where the status tags under the map end, so the key hints along the bottom stop short of them.
 private statusEnd=0;
 constructor(readonly canvas:HTMLCanvasElement,readonly level:Level){this.c=canvas.getContext('2d')!;this.resize();}
 resize(){this.dpr=Math.min(devicePixelRatio||1,2);this.w=innerWidth;this.h=innerHeight;this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);}
 get compact(){return this.w<820;}
 draw(s:HudState){const c=this.c;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);
  this.vignette(s);this.backdrops();for(const l of s.labels)this.label(l.x,l.y,l.text);
  if(s.reticle){c.fillStyle='rgba(243,239,230,.7)';c.beginPath();c.arc(this.w/2,this.h/2,2.2,0,Math.PI*2);c.fill();}
  for(const m of s.marks)this.mark(m,s.time);
  this.watchers(s);this.objectives(s);this.radar(s);this.situation(s);this.inventory(s);this.hints(s);this.alarm(s);this.prompt(s);this.toast(s);}
 // The bottom-left block: the map square, under it the situation; beside it the outfit, suspicion and health.
 private get corner(){const S=this.compact?118:164,x=28,touch=document.body.classList.contains('touch-enabled')?190:0,bottom=this.h-30-touch;return {S,x,y:bottom-30-S,bottom};}
 private situation(s:HudState){const c=this.c,{S,x,y,bottom}=this.corner,tone={red:RED,amber:AMBER,teal:TEAL,dim:DIM};
  // Under the map: the most serious state large, the rest as small tags after it.
  const list=s.status??[];let sx=x;this.statusEnd=0;list.slice(0,4).forEach((st,i)=>{const big=i===0,size=big?13:10.5,label=big?`${st.text}`:st.text,w=this.measure(label,size,700)+(big?this.measure(st.en,8.5,700,LATIN)+st.en.length*1.5+40:16),h=big?24:18,yy=bottom-h;
   c.fillStyle=big?tone[st.tone]+(st.tone==='red'&&st.en==='COMBAT'?Math.round(200+55*Math.sin(s.time*7)).toString(16).padStart(2,'0'):'e6'):'rgba(11,15,18,.72)';c.fillRect(sx,yy,w,h);
   if(!big){c.fillStyle=tone[st.tone];c.fillRect(sx,yy,2.5,h);}
   this.text(label,sx+(big?10:8),yy+(big?16.5:13),size,big?(st.tone==='amber'||st.tone==='teal'?INK:'#fff'):PAPER,{weight:700});
   if(big)this.text(st.en,sx+w-8,yy+16,8.5,st.tone==='amber'||st.tone==='teal'?'rgba(11,15,18,.7)':'rgba(255,255,255,.75)',{font:LATIN,weight:700,align:'right',spacing:1.5});sx+=w+6;this.statusEnd=sx;});
  // Beside the map: where, the outfit and where it may go, then suspicion and health, then the ghost mark.
  const tx=x+S+16,top=y+4;this.text(`${s.floor}  ${s.zone}`,tx,top+10,12,s.perm==='deny'?RED:s.perm==='caution'?AMBER:PAPER,{weight:600});
  this.text('DISGUISE',tx,top+32,8.5,DIM,{font:LATIN,spacing:2});this.text(s.disguise,tx,top+50,15,PAPER,{weight:600});
  let px=tx;for(const p of s.perms){const label=`${p.label} ${PERM_TEXT[p.perm]}`,w=this.measure(label,10)+12;c.fillStyle=p.here?PERM_COLOR[p.perm]+'40':'rgba(243,239,230,.06)';c.fillRect(px,top+58,w,17);
   if(p.here){c.fillStyle=PERM_COLOR[p.perm];c.fillRect(px,top+73,w,2);}this.text(label,px+6,top+70.5,10,p.here?PAPER:PERM_COLOR[p.perm]);px+=w+3;}
  const bw=Math.max(150,Math.min(230,px-tx)),by=top+94,v=Math.min(1,s.suspicion/100);
  this.text('SUSPICION',tx,by,8.5,DIM,{font:LATIN,spacing:2});this.text(s.who,tx+bw,by,10.5,v>0?PAPER:DIM,{align:'right'});
  c.fillStyle='rgba(243,239,230,.12)';c.fillRect(tx,by+5,bw,6);if(v>0){c.fillStyle=s.suspicionColor;c.fillRect(tx,by+5,bw*v,6);}for(const t of [.3,.6]){c.fillStyle='rgba(11,15,18,.8)';c.fillRect(tx+bw*t-1,by+4,2,8);}
  if(s.health!==undefined){const hy=by+26,hv=Math.max(0,Math.min(1,s.health));this.text('HEALTH',tx,hy,8.5,DIM,{font:LATIN,spacing:2});c.fillStyle='rgba(243,239,230,.12)';c.fillRect(tx,hy+5,bw,4);c.fillStyle=hv<.35?RED:PAPER;c.fillRect(tx,hy+5,bw*hv,4);}
  if(s.ghost){const gx=x+S-14,gy=y+14,col=s.ghost==='ok'?PAPER:s.ghost==='erase'?AMBER:RED;c.save();c.translate(gx,gy);c.rotate(Math.PI/4);c.lineWidth=2;c.strokeStyle=col;c.strokeRect(-6,-6,12,12);if(s.ghost==='ok'){c.fillStyle=col;c.fillRect(-3,-3,6,6);}c.restore();
   this.text(s.ghost==='ok'?'GHOST':s.ghost==='erase'?'GHOST · 録画を消す':'GHOST ×',gx-14,gy+4,9,col,{font:LATIN,weight:700,align:'right',spacing:1});}
  if(s.coins&&!s.inventory)this.text(`G コイン ×${s.coins}`,tx,by+52,11,DIM);}
 // Bottom-right: what is in hand, on the back, in the case; the gun and its rounds sit above it (#combat-status).
 private inventory(s:HudState){const inv=s.inventory;if(!inv)return;const x=this.w-28,touch=document.body.classList.contains('touch-enabled');let y=this.h-(touch?250:84);
  const line=(k:string,v:string,strong=false)=>{this.text(v,x,y,strong?15:12,strong?PAPER:DIM,{weight:strong?600:400,align:'right'});const w=this.measure(v,strong?15:12,strong?600:400);this.text(k,x-w-10,y,8.5,DIM,{font:LATIN,spacing:2,align:'right'});y-=strong?24:19;};
  if(inv.strip)this.strip(inv.strip);if(inv.coins!==undefined)line('COINS',`コイン ×${inv.coins}`);if(inv.pocket)line('POCKET',inv.pocket);if(inv.gun)line('WEAPON',inv.gun);if(inv.inCase)line('CASE',inv.inCase);if(inv.back)line('BACK',inv.back);line('IN HAND',inv.hand||'なし',true);}
 // The inventory row along the bottom middle: one card per thing, the cursor framed, the one in hand marked.
 private strip(st:{items:{label:string;kind:string}[];cursor:number;current:number}){const c=this.c,cw=112,ch=58,gap=6,n=st.items.length,w=n*cw+(n-1)*gap,x0=this.w/2-w/2,y=this.h*.70;
  st.items.forEach((it,i)=>{const x=x0+i*(cw+gap),on=i===st.cursor;c.fillStyle=on?'rgba(243,239,230,.16)':'rgba(11,15,18,.78)';c.fillRect(x,y,cw,ch);c.strokeStyle=on?PAPER:'rgba(243,239,230,.2)';c.lineWidth=on?2:1;c.strokeRect(x+.5,y+.5,cw-1,ch-1);
   if(i===st.current){c.fillStyle=RED;c.fillRect(x,y+ch-3,cw,3);}this.text(String(i+1),x+7,y+15,10,DIM,{font:LATIN,weight:700});this.text(it.kind,x+cw-7,y+15,8.5,DIM,{font:LATIN,align:'right',spacing:1});
   let t=it.label;while(this.measure(t,13,600)>cw-14&&t.length>2)t=t.slice(0,-2)+'…';this.text(t,x+cw/2,y+40,13,on?PAPER:'rgba(243,239,230,.8)',{weight:600,align:'center'});});
  this.text('ホイール・数字キーで選ぶ',this.w/2,y-10,10.5,DIM,{align:'center'});}
 // Around the centre of the screen: one mark per person getting suspicious, pointing their way and filling as they do.
 private watchers(s:HudState){const c=this.c,cx=this.w/2,cy=this.h/2,R=Math.min(this.w,this.h)*.13;for(const m of s.marks){if(m.pct<=1&&!m.hot)continue;const a=Math.atan2(m.y-cy,m.x-cx),k=Math.min(1,m.pct/100);
   c.save();c.translate(cx+Math.cos(a)*R,cy+Math.sin(a)*R);c.rotate(a);c.lineWidth=3;c.lineCap='round';c.strokeStyle='rgba(11,15,18,.55)';c.beginPath();c.moveTo(-6,-11);c.lineTo(4,0);c.lineTo(-6,11);c.stroke();
   c.strokeStyle=m.hot?RED:k>.6?'#ff8a3d':AMBER;c.globalAlpha=.35+.65*k;c.lineWidth=2.5;c.beginPath();c.moveTo(-6,-11*k-2);c.lineTo(4,0);c.lineTo(-6,11*k+2);c.stroke();c.restore();}c.globalAlpha=1;}
 // Dark edges, warming to red while someone is hunting the agent.
 private vignette(s:HudState){const c=this.c,g=c.createRadialGradient(this.w/2,this.h/2,Math.min(this.w,this.h)*.35,this.w/2,this.h/2,Math.max(this.w,this.h)*.75);
  const hot=s.alarm.level>=2?.22+.08*Math.sin(s.time*6):s.suspicion/100*.12;g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,hot>.02?`rgba(120,14,10,${hot})`:'rgba(5,8,10,.32)');c.fillStyle=g;c.fillRect(0,0,this.w,this.h);}
 // Soft dark fields behind the text blocks so thin type stays readable over a bright pool deck.
 private backdrops(){const c=this.c,fade=(x0:number,y0:number,x1:number,y1:number,r:number)=>{const g=c.createRadialGradient(x0,y0,0,x0,y0,r);g.addColorStop(0,'rgba(5,8,10,.5)');g.addColorStop(1,'rgba(5,8,10,0)');c.fillStyle=g;c.fillRect(x0-r,y0-r,r*2,r*2);void x1;void y1;};
  fade(90,110,0,0,300);fade(this.w/2,44,0,0,170);fade(150,this.h-90,0,0,280);const g=c.createLinearGradient(0,this.h-70,0,this.h);g.addColorStop(0,'rgba(5,8,10,0)');g.addColorStop(1,'rgba(5,8,10,.45)');c.fillStyle=g;c.fillRect(this.w*.45,this.h-70,this.w*.55,70);}
 private text(t:string,x:number,y:number,size:number,color=PAPER,o:{font?:string;weight?:number;align?:CanvasTextAlign;spacing?:number;base?:CanvasTextBaseline}={}){const c=this.c;c.font=`${o.weight??400} ${size}px ${o.font??JP}`;c.fillStyle=color;c.textAlign=o.align??'left';c.textBaseline=o.base??'alphabetic';
  (c as CanvasRenderingContext2D&{letterSpacing:string}).letterSpacing=`${o.spacing??0}px`;c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=5;c.fillText(t,x,y);c.shadowBlur=0;(c as CanvasRenderingContext2D&{letterSpacing:string}).letterSpacing='0px';return c.measureText(t).width;}
 private label(x:number,y:number,t:string){const c=this.c;c.strokeStyle='rgba(243,239,230,.45)';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x,y-14);c.stroke();this.text(t,x,y-18,10,'rgba(243,239,230,.75)',{font:LATIN,align:'center',spacing:2});}
 private objectives(s:HudState){const x=28,y=30;this.text(s.codename.toUpperCase(),x,y,11,DIM,{font:LATIN,spacing:3});
  this.text(this.level.name??'グランド・マリーナ・ホテル',x,y+24,this.compact?14:17,PAPER,{weight:600});
  const c=this.c;c.fillStyle=RED;c.fillRect(x,y+36,26,2);this.text('OBJECTIVES',x,y+60,10,DIM,{font:LATIN,spacing:3});
  s.objectives.forEach((o,i)=>{const yy=y+84+i*25,cx=x+7,color=o.state==='done'?TEAL:o.state==='failed'?RED:o.bonus?DIM:PAPER;
   c.save();c.translate(cx,yy-5);c.rotate(Math.PI/4);c.strokeStyle=color;c.lineWidth=1.4;c.strokeRect(-4.5,-4.5,9,9);if(o.state==='done'){c.fillStyle=TEAL;c.fillRect(-2.5,-2.5,5,5);}c.restore();
   const wdt=this.text(o.text,x+22,yy,o.bonus?12:13.5,color,{weight:o.bonus?400:500});if(o.state==='failed'){c.strokeStyle=RED;c.beginPath();c.moveTo(x+22,yy-5);c.lineTo(x+22+wdt,yy-5);c.stroke();}});
  if(s.hint&&!this.compact)this.text(s.hint,x,y+84+s.objectives.length*25+10,11.5,DIM);}
 private measure(t:string,size:number,weight=400,font=JP){this.c.font=`${weight} ${size}px ${font}`;return this.c.measureText(t).width;}
 // Player-centred radar that turns with the camera: walls, the staff zone, the pool, NPCs with view cones, objective pins.
 private radar(s:HudState){const c=this.c,{S,x:cx0,y:cy0}=this.corner,R=S/2,cx=cx0+R,cy=cy0+R,r=s.radar,sc=R/RADAR_RANGE,fwd={x:Math.sin(r.yaw),z:Math.cos(r.yaw)},right={x:-Math.cos(r.yaw),z:Math.sin(r.yaw)};
  const P=(x:number,z:number)=>{const dx=x-r.x,dz=z-r.z;return [cx+(dx*right.x+dz*right.z)*sc,cy-(dx*fwd.x+dz*fwd.z)*sc] as const;};
  const poly=(x0:number,z0:number,x1:number,z1:number)=>{c.beginPath();for(const [x,z] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]] as const){const [a,b]=P(x,z);c.lineTo(a,b);}c.closePath();};
  c.save();c.beginPath();c.rect(cx-R,cy-R,S,S);c.fillStyle='rgba(8,12,14,.74)';c.fill();c.clip();
  for(let i=1;i<=3;i++){c.beginPath();c.arc(cx,cy,R*i/3,0,Math.PI*2);c.strokeStyle='rgba(243,239,230,.06)';c.lineWidth=1;c.stroke();}
  // Only what is near: the radar covers RADAR_RANGE metres, so far parts of the hotel are skipped.
  const near=(a:Area)=>a.maxX>r.x-RADAR_RANGE*1.5&&a.minX<r.x+RADAR_RANGE*1.5&&a.maxZ>r.z-RADAR_RANGE*1.5&&a.minZ<r.z+RADAR_RANGE*1.5;
  for(const f of this.level.floors)if(f.floor===r.floor)for(const a of f.areas)if(near(a)){poly(a.minX,a.minZ,a.maxX,a.maxZ);c.fillStyle='rgba(243,239,230,.08)';c.fill();}
  for(const z of this.level.zones)if(z.floor===r.floor&&z.type!=='public'&&near(z)){poly(z.minX,z.minZ,z.maxX,z.maxZ);c.fillStyle=z.type==='secure'?'rgba(226,54,43,.16)':z.type==='outer'?'rgba(150,150,140,.14)':'rgba(240,180,60,.16)';c.fill();}
  if(r.floor===0)for(const p of this.level.blockers)if((p.id==='pool'||p.id.startsWith('water'))&&near({minX:p.x-p.w/2,maxX:p.x+p.w/2,minZ:p.z-p.d/2,maxZ:p.z+p.d/2})){poly(p.x-p.w/2,p.z-p.d/2,p.x+p.w/2,p.z+p.d/2);c.fillStyle='rgba(95,199,176,.28)';c.fill();}
  for(const st of this.level.stairs)if(((st.floor??0)===r.floor||st.low<0&&r.floor===0||st.high>0&&Math.round(st.high/3.5)===r.floor)&&near(st)){poly(st.minX,st.minZ,st.maxX,st.maxZ);c.strokeStyle='rgba(243,239,230,.25)';c.setLineDash([2,2]);c.stroke();c.setLineDash([]);}
  for(const b of this.level.walls)if((b.floor??0)===r.floor&&Math.abs(b.x-r.x)<RADAR_RANGE*1.5+b.w&&Math.abs(b.z-r.z)<RADAR_RANGE*1.5+b.d){poly(b.x-b.w/2-.05,b.z-b.d/2-.05,b.x+b.w/2+.05,b.z+b.d/2+.05);c.fillStyle='rgba(243,239,230,.62)';c.fill();}
  for(const n of r.npcs){const [x,y]=P(n.x,n.z),a=Math.atan2(-(Math.sin(n.heading)*fwd.x+Math.cos(n.heading)*fwd.z),Math.sin(n.heading)*right.x+Math.cos(n.heading)*right.z);
   if(n.guard){const g=c.createRadialGradient(x,y,0,x,y,4.5*sc);g.addColorStop(0,n.active?n.color+'aa':'rgba(243,239,230,.28)');g.addColorStop(1,'rgba(243,239,230,0)');c.beginPath();c.moveTo(x,y);c.arc(x,y,4.5*sc,a-.87,a+.87);c.closePath();c.fillStyle=g;c.fill();}
   c.beginPath();c.arc(x,y,n.guard?3.6:2.4,0,Math.PI*2);c.fillStyle=n.guard?(n.active?n.color:'#8fa6d8'):'rgba(243,239,230,.7)';c.fill();}
  c.restore();
  for(const t of r.targets){let [x,y]=P(t.x,t.z);const e=Math.max(Math.abs(x-cx),Math.abs(y-cy));if(e>R-7){x=cx+(x-cx)*(R-7)/e;y=cy+(y-cy)*(R-7)/e;}
   c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle=t.kind==='panel'?AMBER:TEAL;c.fillRect(-4,-4,8,8);c.strokeStyle=INK;c.lineWidth=1.5;c.strokeRect(-4,-4,8,8);c.restore();}
  // The agent is always the centre arrow; heading relative to the view.
  const ha=r.heading-r.yaw;c.save();c.translate(cx,cy);c.rotate(-ha);c.beginPath();c.moveTo(0,-7);c.lineTo(5,5);c.lineTo(0,2.5);c.lineTo(-5,5);c.closePath();c.fillStyle=PAPER;c.fill();c.restore();
  c.strokeStyle='rgba(243,239,230,.35)';c.lineWidth=1;c.strokeRect(cx-R+.5,cy-R+.5,S-1,S-1);c.fillStyle=RED;c.fillRect(cx-R,cy-R,22,2);
  const n=P(r.x,r.z-RADAR_RANGE),na=Math.atan2(n[1]-cy,n[0]-cx),ne=Math.max(Math.abs(Math.cos(na)),Math.abs(Math.sin(na)));this.text('N',cx+Math.cos(na)/ne*(R-9),cy+Math.sin(na)/ne*(R-9)+4,10,DIM,{font:LATIN,align:'center',weight:700});
  this.text('Tab 区画図',cx+R-6,cy+R-7,9.5,DIM,{align:'right'});}
 private hints(s:HudState){if(this.compact||document.body.classList.contains('touch-enabled'))return;const c=this.c;let x=this.w-28;const y=this.h-30;
  for(const [k,label] of [...s.hints].reverse()){const lw=this.measure(label,11),kw=this.measure(k,10,600,LATIN)+12;if(x-lw-kw-6<this.statusEnd+24)break;x-=lw;this.text(label,x,y,11,DIM);x-=kw+6;c.strokeStyle='rgba(243,239,230,.4)';c.lineWidth=1;c.strokeRect(x+.5,y-13.5,kw,18);this.text(k,x+kw/2,y-1,10,PAPER,{font:LATIN,weight:600,align:'center'});x-=18;}
  this.text(s.mode,this.w-28,y-26,11,AMBER,{align:'right',spacing:1});}
 private alarm(s:HudState){if(!s.alarm.text)return;const c=this.c,cx=this.w/2,y=96,hot=s.alarm.level>=2,w=this.measure(s.alarm.text,13,600)+56;
  c.fillStyle=hot?`rgba(226,54,43,${.82+.12*Math.sin(s.time*8)})`:'rgba(240,180,60,.9)';c.beginPath();c.moveTo(cx-w/2+10,y-14);c.lineTo(cx+w/2,y-14);c.lineTo(cx+w/2-10,y+12);c.lineTo(cx-w/2,y+12);c.closePath();c.fill();
  this.text(s.alarm.text,cx,y+4,13,hot?'#fff':INK,{weight:700,align:'center',spacing:2});}
 private prompt(s:HudState){if(!s.prompt)return;const c=this.c,t=s.prompt.text,m=/^([A-Z])\s+(.*)$/.exec(t),key=m?m[1]:'',rest=m?m[2]:t,crime=/致死|排除|刺す|斬る|殺|毒|壊す|とどめ|突き落/.test(t),col=crime?RED:AMBER;
  const [verb,...more]=rest.split(' · '),cx=this.w/2,cy=this.h*.64,vw=this.measure(verb,14,600),total=(key?40:0)+vw,x0=cx-total/2;
  if(key){const kx=x0+14;c.fillStyle='rgba(11,15,18,.72)';c.fillRect(kx-14,cy-14,28,28);c.strokeStyle=crime?RED:'rgba(243,239,230,.55)';c.lineWidth=1.5;c.strokeRect(kx-13.5,cy-13.5,27,27);
   if(s.prompt.progress>0){c.lineWidth=3;c.strokeStyle=col;c.beginPath();c.arc(kx,cy,21,-Math.PI/2,-Math.PI/2+Math.PI*2*s.prompt.progress);c.stroke();}this.text(key,kx,cy+5.5,15,crime?'#ff8b7f':PAPER,{font:LATIN,weight:700,align:'center'});}
  else if(s.prompt.progress>0){c.fillStyle=col;c.fillRect(cx-60,cy+14,120*s.prompt.progress,2);}
  this.text(verb,x0+(key?40:0),cy+5,14,crime?'#ff8b7f':PAPER,{weight:600});if(more.length)this.text(more.join(' · '),cx,cy+30,11,DIM,{align:'center'});}
 private toast(s:HudState){if(!s.toast)return;const a=Math.min(1,s.toast.age*6,(3.4-s.toast.age)*2);if(a<=0)return;const c=this.c,cx=this.w/2,y=this.h*.64+66;c.globalAlpha=a;
  const w=this.measure(s.toast.text,13.5,500)+40;const g=c.createLinearGradient(cx-w/2,0,cx+w/2,0);g.addColorStop(0,'rgba(8,12,14,0)');g.addColorStop(.15,'rgba(8,12,14,.78)');g.addColorStop(.85,'rgba(8,12,14,.78)');g.addColorStop(1,'rgba(8,12,14,0)');c.fillStyle=g;c.fillRect(cx-w/2,y-20,w,30);
  c.fillStyle=RED;c.fillRect(cx-w/2+20,y-20,18,1.5);this.text(s.toast.text,cx,y,13.5,PAPER,{weight:500,align:'center'});c.globalAlpha=1;}
 private mark(m:HudMark,time:number){const c=this.c,r=13;c.save();c.translate(m.x,m.y);if(m.edge)c.scale(.85,.85);
  c.lineWidth=3.5;c.strokeStyle='rgba(8,12,14,.6)';c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();
  c.strokeStyle=m.color;c.beginPath();c.arc(0,0,r,-Math.PI/2,-Math.PI/2+Math.PI*2*m.pct/100);c.stroke();
  if(m.hot){c.strokeStyle=`rgba(226,54,43,${.5+.5*Math.sin(time*9)})`;c.lineWidth=1.5;c.beginPath();c.arc(0,0,r+5,0,Math.PI*2);c.stroke();}
  if(m.glyph){c.font=`700 15px Georgia, serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.55)';c.strokeText(m.glyph,0,1);c.fillStyle=m.hot?'#ff8b7f':'#fff';c.fillText(m.glyph,0,1);}
  if(m.face!==undefined){c.fillStyle='#fff';c.strokeStyle='rgba(8,12,14,.6)';c.lineWidth=2;c.beginPath();c.arc(0,-r-9,4,0,Math.PI*2);c.stroke();c.fill();
   c.fillStyle='rgba(8,12,14,.6)';c.fillRect(-14,r+6,28,5);c.fillStyle='#fff';c.fillRect(-13,r+7,26*m.face,3);}
  if(m.edge){c.rotate(m.angle);c.fillStyle=m.color;c.beginPath();c.moveTo(r+12,0);c.lineTo(r+4,-6);c.lineTo(r+4,6);c.closePath();c.fill();}
  c.restore();}
}
