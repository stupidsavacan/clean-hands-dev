import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stickDirections,touchLayout,TouchControls,type TouchButton} from '../src/touch.ts';

test('mobile controls stay reachable and separate, including gun controls and the expanded tools menu',()=>{
 for(const [w,h] of [[844,390],[667,375],[932,430],[390,844],[375,667],[320,568],[1080/1.446,810/1.446]])for(const armed of [false,true]){
  const l=touchLayout(w,h,{top:0,left:0,right:0,bottom:20},armed),size=(b:TouchButton)=>[b.w?b.w/2:b.r,b.h?b.h/2:b.r];
  for(const b of [...l.buttons,...l.tools]){const [rx,ry]=size(b);assert.ok(b.x-rx>=0&&b.x+rx<=w&&b.y-ry>=0&&b.y+ry<=h,`${b.id} within ${w}x${h}`);}
  for(const a of l.tools)for(const b of l.buttons){const [rx,ry]=size(b);assert.ok(Math.abs(a.x-b.x)>=a.w!/2+rx+4||Math.abs(a.y-b.y)>=a.h!/2+ry+4,`${a.id}/${b.id} on ${w}x${h}`);}
  assert.equal(l.buttons.find(b=>b.id==='primary')!.code,armed?'Space':'KeyE');
 }
 assert.deepEqual(stickDirections(0,0),[]);assert.deepEqual(stickDirections(40,-40),['KeyD','KeyW']);
});

// Small DOM stand-in: exercise the real pointer handlers and input lifecycle without WebGL.
function controls(){
 const saved=new Map<string,PropertyDescriptor|undefined>(),events:any[]=[],aim:any[]=[];let now=0;
 const ctx=new Proxy({},{get:()=>()=>{}});
 const fake=()=>({style:{},hidden:false,width:0,height:0,handlers:new Map<string,Function>(),setAttribute(){},append(){},getContext:()=>ctx,setPointerCapture(){},addEventListener(t:string,f:Function){this.handlers.set(t,f);}});
 const canvas=fake();
 for(const [k,v] of Object.entries({document:{createElement:(tag:string)=>tag==='canvas'?canvas:fake(),querySelector:()=>fake(),body:{classList:{toggle(){}}},addEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){}}),getComputedStyle:()=>({paddingTop:'0',paddingRight:'0',paddingBottom:'0',paddingLeft:'0'}),innerWidth:844,innerHeight:390,devicePixelRatio:1,addEventListener(){},performance:{now:()=>now}})){
  saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 }
 const c=new TouchControls(canvas as any,{blocked:()=>false,key:(...x)=>events.push(x),tap:x=>events.push(['tap',x]),look(){},aim:(...x)=>aim.push(x)});c.update(false,false,true,true);
 const layout=touchLayout(844,390,undefined,true);
 const pointer=(type:string,id:number,x:number,y:number)=>canvas.handlers.get(type)!({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 const button=(id:string)=>[...layout.buttons,...layout.tools].find(b=>b.id===id)!;
 const at=(type:string,id:number,b:TouchButton)=>pointer(type,id,b.x,b.y);
 return {c,events,aim,layout,pointer,button,at,time:(x:number)=>now=x,restore:()=>{for(const [k,d]of saved)if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k];}};
}
test('releasing a second finger does not release shooting; modal cancellation releases every held input',()=>{const t=controls();try{
 t.at('pointerdown',1,t.button('primary'));t.pointer('pointerdown',2,t.layout.stick.x,t.layout.stick.y-35);t.pointer('pointerup',2,t.layout.stick.x,t.layout.stick.y-35);
 assert.ok(t.events.some(e=>e[0]==='Space'&&e[1]===true));assert.ok(!t.events.some(e=>e[0]==='Space'&&e[1]===false));
 t.c.update(true,false,true,true);assert.ok(t.events.some(e=>e[0]==='Space'&&e[1]===false&&e[2]===true));assert.equal(t.c.root.hidden,true);
 }finally{t.restore();}});
test('dropping a gun requires a completed deliberate hold; cancellation and quick taps do nothing',()=>{const t=controls();try{
 t.at('pointerdown',1,t.button('more'));t.at('pointerup',1,t.button('more'));
 t.at('pointerdown',2,t.button('tool-drop'));t.time(800);t.at('pointercancel',2,t.button('tool-drop'));assert.ok(!t.events.some(e=>e[0]==='tap'&&e[1]==='drop'));
 t.at('pointerdown',3,t.button('tool-drop'));t.at('pointerup',3,t.button('tool-drop'));assert.ok(!t.events.some(e=>e[0]==='tap'&&e[1]==='drop'));
 t.at('pointerdown',4,t.button('tool-drop'));t.time(1600);t.at('pointerup',4,t.button('tool-drop'));assert.equal(t.events.filter(e=>e[0]==='tap'&&e[1]==='drop').length,1);
 }finally{t.restore();}});
test('empty-space touch and drag update overhead aim without stealing the movement stick',()=>{const t=controls();try{
 t.pointer('pointerdown',1,400,190);t.pointer('pointermove',1,420,200);assert.deepEqual(t.aim,[[400,190],[420,200]]);
 }finally{t.restore();}});
