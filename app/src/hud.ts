// The in-game HUD, drawn every frame on one 2D canvas over the 3D view.
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
 radar:{x:number;z:number;heading:number;yaw:number;floor:number;npcs:RadarNpc[];targets:{x:number;z:number;kind:'panel'|'exit'}[]};time:number};
type Box={x:number;z:number;w:number;d:number;floor?:number};
type Area={minX:number;maxX:number;minZ:number;maxZ:number};
type Level={walls:Box[];blockers:(Box&{id:string;floor?:number})[];floors:{floor:number;y:number;areas:Area[]}[];zones:(Area&{type:string;floor:number})[];stairs:(Area&{low:number;high:number;floor?:number})[];name?:string};
export const INK='#0b0f12',PAPER='#f3efe6',DIM='rgba(243,239,230,.56)',FAINT='rgba(243,239,230,.16)',RED='#e2362b',AMBER='#f0b43c',TEAL='#5fc7b0';
export const LATIN='Bahnschrift, "Segoe UI", system-ui, sans-serif',JP='"Yu Gothic UI", "Hiragino Sans", Meiryo, system-ui, sans-serif';
const PERM_TEXT:Record<Perm,string>={allow:'可',caution:'注意',deny:'不可'},PERM_COLOR:Record<Perm,string>={allow:TEAL,caution:AMBER,deny:RED};
const RADAR_RANGE=15;
export class Hud{
 private c:CanvasRenderingContext2D;private w=0;private h=0;private dpr=1;
 constructor(readonly canvas:HTMLCanvasElement,readonly level:Level){this.c=canvas.getContext('2d')!;this.resize();}
 resize(){this.dpr=Math.min(devicePixelRatio||1,2);this.w=innerWidth;this.h=innerHeight;this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);}
 get compact(){return this.w<820;}
 draw(s:HudState){const c=this.c;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);
  this.vignette(s);this.backdrops();for(const l of s.labels)this.label(l.x,l.y,l.text);
  if(s.reticle){c.fillStyle='rgba(243,239,230,.7)';c.beginPath();c.arc(this.w/2,this.h/2,2.2,0,Math.PI*2);c.fill();}
  for(const m of s.marks)this.mark(m,s.time);
  this.objectives(s);this.location(s);this.radar(s);this.suspicion(s);this.hints(s);this.alarm(s);this.prompt(s);this.toast(s);}
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
 private location(s:HudState){const c=this.c,cx=this.w/2,y=34,deny=s.perm==='deny';
  const tw=this.text(s.zone,cx+18,y,15,PAPER,{weight:600,align:'center'});void tw;
  this.text(s.floor,cx-this.measure(s.zone,15,600)/2-6,y,12,deny?RED:AMBER,{font:LATIN,weight:700,align:'right',spacing:1});
  const lw=Math.max(120,this.measure(s.zone,15,600)+70);c.fillStyle=deny?RED:FAINT;c.fillRect(cx-lw/2,y+10,lw,deny?2:1);
  if(s.perm!=='allow')this.text(deny?'立入不可 — 見られると疑われる':'注意 — 長居すると疑われる',cx,y+28,11,PERM_COLOR[s.perm],{align:'center',spacing:1});}
 private measure(t:string,size:number,weight=400,font=JP){this.c.font=`${weight} ${size}px ${font}`;return this.c.measureText(t).width;}
 // Player-centred radar that turns with the camera: walls, the staff zone, the pool, NPCs with view cones, objective pins.
 private radar(s:HudState){const c=this.c,R=this.compact?62:84,cx=this.w-28-R,cy=74+R,r=s.radar,sc=R/RADAR_RANGE,fwd={x:Math.sin(r.yaw),z:Math.cos(r.yaw)},right={x:-Math.cos(r.yaw),z:Math.sin(r.yaw)};
  const P=(x:number,z:number)=>{const dx=x-r.x,dz=z-r.z;return [cx+(dx*right.x+dz*right.z)*sc,cy-(dx*fwd.x+dz*fwd.z)*sc] as const;};
  const poly=(x0:number,z0:number,x1:number,z1:number)=>{c.beginPath();for(const [x,z] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]] as const){const [a,b]=P(x,z);c.lineTo(a,b);}c.closePath();};
  c.save();c.beginPath();c.arc(cx,cy,R,0,Math.PI*2);c.fillStyle='rgba(8,12,14,.72)';c.fill();c.clip();
  for(let i=1;i<=3;i++){c.beginPath();c.arc(cx,cy,R*i/3,0,Math.PI*2);c.strokeStyle='rgba(243,239,230,.07)';c.lineWidth=1;c.stroke();}
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
  for(const t of r.targets){let [x,y]=P(t.x,t.z);const d=Math.hypot(x-cx,y-cy);if(d>R-7){x=cx+(x-cx)*(R-7)/d;y=cy+(y-cy)*(R-7)/d;}
   c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle=t.kind==='panel'?AMBER:TEAL;c.fillRect(-4,-4,8,8);c.strokeStyle=INK;c.lineWidth=1.5;c.strokeRect(-4,-4,8,8);c.restore();}
  // The agent is always the centre arrow; heading relative to the view.
  const ha=r.heading-r.yaw;c.save();c.translate(cx,cy);c.rotate(-ha);c.beginPath();c.moveTo(0,-7);c.lineTo(5,5);c.lineTo(0,2.5);c.lineTo(-5,5);c.closePath();c.fillStyle=PAPER;c.fill();c.restore();
  c.beginPath();c.arc(cx,cy,R,0,Math.PI*2);c.strokeStyle='rgba(243,239,230,.35)';c.lineWidth=1;c.stroke();
  const n=P(r.x,r.z-RADAR_RANGE),na=Math.atan2(n[1]-cy,n[0]-cx);this.text('N',cx+Math.cos(na)*(R+10),cy+Math.sin(na)*(R+10)+4,10,DIM,{font:LATIN,align:'center',weight:700});
  this.text('Tab  区画図',cx,cy+R+20,10.5,DIM,{align:'center',spacing:1});}
 // Suspicion: a 240° gauge with the percentage, who is watching, the disguise and where it is allowed.
 // On a touch screen (the mobile page, touch.ts) the move stick takes the bottom-left corner: the panel sits above it.
 private suspicion(s:HudState){const c=this.c,x=28,base=this.h-34-(document.body.classList.contains('touch-enabled')?190:0),R=this.compact?40:52,cx=x+R+4,cy=base-82-(this.compact?0:12),from=Math.PI*.83,span=Math.PI*1.34,v=s.suspicion/100;
  c.lineCap='butt';c.lineWidth=7;c.strokeStyle='rgba(243,239,230,.12)';c.beginPath();c.arc(cx,cy,R,from,from+span);c.stroke();
  for(const t of [.3,.6]){const a=from+span*t;c.strokeStyle='rgba(243,239,230,.4)';c.lineWidth=1.5;c.beginPath();c.moveTo(cx+Math.cos(a)*(R-6),cy+Math.sin(a)*(R-6));c.lineTo(cx+Math.cos(a)*(R+6),cy+Math.sin(a)*(R+6));c.stroke();}
  if(v>0){c.lineWidth=7;c.strokeStyle=s.suspicionColor;c.beginPath();c.arc(cx,cy,R,from,from+span*v);c.stroke();}
  this.text(String(Math.round(s.suspicion)),cx,cy+8,this.compact?24:32,v>0?s.suspicionColor:PAPER,{font:LATIN,weight:300,align:'center'});
  this.text('SUSPICION',cx,cy+24,8.5,DIM,{font:LATIN,align:'center',spacing:2});
  const tx=cx+R+18;this.text(s.who,tx,cy-14,12.5,v>0?PAPER:DIM,{weight:500});
  this.text('DISGUISE',tx,cy+6,8.5,DIM,{font:LATIN,spacing:2});this.text(s.disguise,tx+62,cy+6,12,PAPER);
  let px=tx;for(const p of s.perms){const label=`${p.label} ${PERM_TEXT[p.perm]}`,w=this.measure(label,10.5)+14;c.fillStyle=p.here?PERM_COLOR[p.perm]+'40':'rgba(243,239,230,.06)';c.fillRect(px,cy+15,w,19);
   if(p.here){c.fillStyle=PERM_COLOR[p.perm];c.fillRect(px,cy+32,w,2);}this.text(label,px+7,cy+28.5,10.5,p.here?PAPER:PERM_COLOR[p.perm]);px+=w+4;}
  // Coins as stacked discs, plus the alert count.
  for(let i=0;i<3;i++){c.beginPath();c.arc(tx+7+i*15,cy+52,5.5,0,Math.PI*2);c.fillStyle=i<s.coins?AMBER:'rgba(243,239,230,.12)';c.fill();}
  this.text(`G コイン ×${s.coins}`,tx+52,cy+56,11,DIM);if(s.alerts)this.text(`警戒 ${s.alerts}回`,tx+140,cy+56,11,RED,{weight:600});}
 private hints(s:HudState){if(this.compact||document.body.classList.contains('touch-enabled'))return;const c=this.c;let x=this.w-28;const y=this.h-30;
  for(const [k,label] of [...s.hints].reverse()){const lw=this.measure(label,11),kw=this.measure(k,10,600,LATIN)+12;x-=lw;this.text(label,x,y,11,DIM);x-=kw+6;c.strokeStyle='rgba(243,239,230,.4)';c.lineWidth=1;c.strokeRect(x+.5,y-13.5,kw,18);this.text(k,x+kw/2,y-1,10,PAPER,{font:LATIN,weight:600,align:'center'});x-=18;}
  this.text(s.mode,this.w-28,y-26,11,AMBER,{align:'right',spacing:1});}
 private alarm(s:HudState){if(!s.alarm.text)return;const c=this.c,cx=this.w/2,y=96,hot=s.alarm.level>=2,w=this.measure(s.alarm.text,13,600)+56;
  c.fillStyle=hot?`rgba(226,54,43,${.82+.12*Math.sin(s.time*8)})`:'rgba(240,180,60,.9)';c.beginPath();c.moveTo(cx-w/2+10,y-14);c.lineTo(cx+w/2,y-14);c.lineTo(cx+w/2-10,y+12);c.lineTo(cx-w/2,y+12);c.closePath();c.fill();
  this.text(s.alarm.text,cx,y+4,13,hot?'#fff':INK,{weight:700,align:'center',spacing:2});}
 private prompt(s:HudState){if(!s.prompt)return;const c=this.c,cx=this.w/2,cy=this.h*.62;c.lineWidth=3;c.strokeStyle='rgba(243,239,230,.2)';c.beginPath();c.arc(cx,cy,19,0,Math.PI*2);c.stroke();
  c.strokeStyle=AMBER;c.beginPath();c.arc(cx,cy,19,-Math.PI/2,-Math.PI/2+Math.PI*2*s.prompt.progress);c.stroke();this.text(s.prompt.text.startsWith('R')?'R':s.prompt.text.startsWith('F')?'F':s.prompt.text.startsWith('X')?'X':'E',cx,cy+5,14,PAPER,{font:LATIN,weight:700,align:'center'});const lines:string[]=[];let line='';for(const char of s.prompt.text){if(this.measure(line+char,12,500)>this.w-48){lines.push(line);line=char;}else line+=char;}lines.push(line);lines.forEach((t,i)=>this.text(t,cx,cy+43+i*18,12,PAPER,{weight:500,align:'center'}));}
 private toast(s:HudState){if(!s.toast)return;const a=Math.min(1,s.toast.age*6,(3.4-s.toast.age)*2);if(a<=0)return;const c=this.c,cx=this.w/2,y=this.h-128;c.globalAlpha=a;
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
