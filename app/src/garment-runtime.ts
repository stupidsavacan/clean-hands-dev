import * as T from 'three';

/**
 * Drape runtime (drape.v2): keeps a skinned garment outside the limbs it is worn over.
 *
 * The cloth is not simulated. Each frame starts again from the skinned pose, so the same pose always gives the
 * same shape, and every step is a continuous function of the pose, so the cloth does not pop between frames.
 * A cloth point may only slide along its own outward direction, which is what stops it from flipping through
 * the body or growing spikes:
 *
 *   1. limbs are capsules sized from the real collider meshes, and move with their bone;
 *   2. a point is pushed out to where its outward ray (from the character's centre line) leaves every inner
 *      capsule. The capsules are enlarged by what a flat face between such points can sag inward, so whole
 *      faces clear the limb without being tested one by one;
 *   3. the push spreads to the neighbours with a limited slope, so the cloth drapes over the limb like a tent;
 *   4. outer limbs (arms worn over the cloth) press it inward a little, never where an inner limb is pushing;
 *   5. the hem rests on the ground instead of sinking through it.
 *
 * Two styles of motion:
 *   - 'dynamic' is exactly the above: no memory, the cloth follows every step of the limbs.
 *   - 'calm' (the default) adds three things so the cloth moves like heavy fabric instead of flicking:
 *       a. a panel moves as one: points at the same height on the same side (front or back) share the push,
 *          so the front and the back swing as flat panels, not as a bump over each calf;
 *       b. the cloth is quick to give way and slow to fall back, slower still while the limbs keep moving, so
 *          over a walk it holds the shape the legs sweep out, a steady bell, and the legs move inside it;
 *       c. the push fades more gently toward the waist and the sides;
 *       d. the lower cloth leans part of the way with the legs before anything is pushed (`follow`), the way a
 *          long coat is carried by the thighs, so far less of it has to be pushed out at each step;
 *       e. `gait` asks the walk itself for shorter, lower steps, as people take in a long robe (the caller
 *          applies it to the character's locomotion, see GarmentRuntime.gait).
 *     It only ever adds outward movement on top of 'dynamic', so it clears the limbs just as well. It remembers
 *     the previous frame, so a held pose settles to the 'dynamic' shape instead of matching it at once.
 *
 * Distances are capped by what they were in the bind pose, so the bind pose itself is never changed.
 * All lengths are metres in the model's own space. Declared per garment in GLB node extras (`userData.garment`).
 */
export type GarmentMetadata={version:2;profile:'drape.v2';colliders:string[];innerBones:string[];outerBones?:string[];
 clearance:number;pinAbove:number;freeBelow:number;spread?:number;slopeDown?:number;slopeSide?:number;slopeUp?:number;maxInward?:number;floor?:boolean};
export type DrapeStyle='calm'|'dynamic';
/**
 * share: how much of a panel's largest push every point of the panel takes. slope: tent slope factor.
 * settle / hold: seconds for the cloth to fall back while the limbs are still / while they keep moving
 * (0 = at once). While walking the next step arrives before the cloth has fallen back, so it stays out;
 * once the character stops, it comes to rest quickly.
 * follow: how far the cloth below the hips leans with the legs (0 = hangs from its own skinning only).
 * gait: multipliers for the wearer's stride length and step height (1 = unchanged).
 */
export type DrapeTuning={share:number;settle:number;hold:number;slope:number;follow:number;gait:{stride:number;bounce:number}};
export const DRAPE_STYLES:Record<DrapeStyle,DrapeTuning>={
 dynamic:{share:0,settle:0,hold:0,slope:1,follow:0,gait:{stride:1,bounce:1}},
 calm:{share:.6,settle:.35,hold:1.2,slope:.8,follow:.5,gait:{stride:.72,bounce:.6}}};
export type Capsule={bone:number;name:string;outer:boolean;a:T.Vector3;b:T.Vector3;r:number};

const canon=(n:string)=>n.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const MAX_PUSH=.6,EPS=1e-5,GRAZE=.02,STRETCH=1.4;
const v0=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3(),v3=new T.Vector3(),m0=new T.Matrix4(),m1=new T.Matrix4(),m2=new T.Matrix4();

/** Length of the ray inside the capsule, set by the last rayCapsuleExit call. */
export let rayChord=0;
/** Largest t at which origin + t·dir (dir is unit) is still inside the capsule, or -Infinity when the ray misses it. */
export function rayCapsuleExit(o:T.Vector3,d:T.Vector3,a:T.Vector3,b:T.Vector3,r:number){
 let best=-Infinity,first=Infinity;const ax=b.x-a.x,ay=b.y-a.y,az=b.z-a.z,len2=ax*ax+ay*ay+az*az;
 for(let end=0;end<2;end++){const c=end?b:a,x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,B=x*d.x+y*d.y+z*d.z,C=x*x+y*y+z*z-r*r,D=B*B-C;if(D>=0){const root=Math.sqrt(D);best=Math.max(best,-B+root);first=Math.min(first,-B-root);}if(len2<1e-12)break;}
 if(len2>=1e-12){const len=Math.sqrt(len2),ux=ax/len,uy=ay/len,uz=az/len,x=o.x-a.x,y=o.y-a.y,z=o.z-a.z,du=d.x*ux+d.y*uy+d.z*uz,ou=x*ux+y*uy+z*uz;
  const px=x-ou*ux,py=y-ou*uy,pz=z-ou*uz,qx=d.x-du*ux,qy=d.y-du*uy,qz=d.z-du*uz,A=qx*qx+qy*qy+qz*qz;
  if(A>1e-12){const B=px*qx+py*qy+pz*qz,C=px*px+py*py+pz*pz-r*r,D=B*B-A*C;if(D>=0){const root=Math.sqrt(D),t=(-B+root)/A,s=ou+t*du,t0=(-B-root)/A,s0=ou+t0*du;if(s>=0&&s<=len)best=Math.max(best,t);if(s0>=0&&s0<=len)first=Math.min(first,t0);}}}
 rayChord=best>-Infinity?best-first:0;return best;
}
const segP=new T.Vector3(),segQ=new T.Vector3();
/** Closest points of two segments; returns the distance and leaves the points in segP (on p) and segQ (on q). */
function segmentSegment(p1:T.Vector3,p2:T.Vector3,q1:T.Vector3,q2:T.Vector3){
 const d1x=p2.x-p1.x,d1y=p2.y-p1.y,d1z=p2.z-p1.z,d2x=q2.x-q1.x,d2y=q2.y-q1.y,d2z=q2.z-q1.z,rx=p1.x-q1.x,ry=p1.y-q1.y,rz=p1.z-q1.z;
 const a=d1x*d1x+d1y*d1y+d1z*d1z,e=d2x*d2x+d2y*d2y+d2z*d2z,f=d2x*rx+d2y*ry+d2z*rz;let s=0,t=0;
 if(a<=1e-12&&e<=1e-12){s=0;t=0;}else if(a<=1e-12){t=T.MathUtils.clamp(f/e,0,1);}else{const c=d1x*rx+d1y*ry+d1z*rz;
  if(e<=1e-12){s=T.MathUtils.clamp(-c/a,0,1);}else{const b=d1x*d2x+d1y*d2y+d1z*d2z,den=a*e-b*b;s=den>1e-12?T.MathUtils.clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;
   if(t<0){t=0;s=T.MathUtils.clamp(-c/a,0,1);}else if(t>1){t=1;s=T.MathUtils.clamp((b-c)/a,0,1);}}}
 segP.set(p1.x+d1x*s,p1.y+d1y*s,p1.z+d1z*s);segQ.set(q1.x+d2x*t,q1.y+d2y*t,q1.z+d2z*t);return segP.distanceTo(segQ);
}
const tri=new T.Triangle(),onTri=new T.Vector3(),onSeg=new T.Vector3(),line=new T.Line3(),plane=new T.Plane(),hit=new T.Vector3(),closest=new T.Vector3();
/** Distance from segment ab to triangle pqr (0 when it passes through). Leaves the closest points in onSeg / onTri. */
export function segmentTriangleDistance(a:T.Vector3,b:T.Vector3,p:T.Vector3,q:T.Vector3,r:T.Vector3){
 tri.set(p,q,r);let best=Infinity;
 tri.getPlane(plane);line.set(a,b);
 if(plane.normal.lengthSq()>0&&plane.intersectLine(line,hit)&&tri.containsPoint(hit)){onSeg.copy(hit);onTri.copy(hit);return 0;}
 for(let k=0;k<2;k++){const end=k?b:a;tri.closestPointToPoint(end,closest);const d=closest.distanceTo(end);if(d<best){best=d;onSeg.copy(end);onTri.copy(closest);}}
 for(let k=0;k<3;k++){const d=segmentSegment(a,b,k===0?p:k===1?q:r,k===0?q:k===1?r:p);if(d<best){best=d;onSeg.copy(segP);onTri.copy(segQ);}}
 return best;
}
/** Cheap box test: true when triangle pqr cannot be within `radius` of segment ab. */
function apart(p:T.Vector3,q:T.Vector3,r:T.Vector3,a:T.Vector3,b:T.Vector3,radius:number){
 return Math.min(p.x,q.x,r.x)>Math.max(a.x,b.x)+radius||Math.max(p.x,q.x,r.x)<Math.min(a.x,b.x)-radius||Math.min(p.y,q.y,r.y)>Math.max(a.y,b.y)+radius||Math.max(p.y,q.y,r.y)<Math.min(a.y,b.y)-radius||Math.min(p.z,q.z,r.z)>Math.max(a.z,b.z)+radius||Math.max(p.z,q.z,r.z)<Math.min(a.z,b.z)-radius;}
function pointSegment(p:T.Vector3,a:T.Vector3,b:T.Vector3){v3.subVectors(b,a);const l=v3.lengthSq(),t=l>1e-12?T.MathUtils.clamp(v2.subVectors(p,a).dot(v3)/l,0,1):0;return v2.copy(a).addScaledVector(v3,t).distanceTo(p);}

/** Fits one capsule per listed bone around the collider vertices that bone mainly moves. Bind space. */
export function fitCapsules(root:T.Object3D,skeleton:T.Skeleton,meta:GarmentMetadata):Capsule[]{
 const result:Capsule[]=[],listed=[...meta.innerBones.map(n=>[n,false] as const),...(meta.outerBones??[]).map(n=>[n,true] as const)];
 const meshes:T.SkinnedMesh[]=[];root.traverse(o=>{const m=o as T.SkinnedMesh;if(m.isSkinnedMesh&&meta.colliders.includes(m.name))meshes.push(m);});
 for(const [name,outer] of listed){const bone=skeleton.bones.findIndex(b=>canon(b.name)===canon(name));if(bone<0)continue;
  const points:T.Vector3[]=[];
  for(const mesh of meshes){const index=mesh.skeleton.bones.findIndex(b=>canon(b.name)===canon(name));if(index<0)continue;
   const pos=mesh.geometry.getAttribute('position'),si=mesh.geometry.getAttribute('skinIndex'),sw=mesh.geometry.getAttribute('skinWeight');
   for(let i=0;i<pos.count;i++){let w=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===index)w+=sw.getComponent(i,k);if(w>=.4)points.push(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.bindMatrix));}}
  if(points.length<2)continue;
  // The axis runs from the bone to its child bone (thigh → shin); a leaf bone uses the spread of its own vertices.
  const head=new T.Vector3().setFromMatrixPosition(m0.copy(skeleton.boneInverses[bone]).invert()),axis=new T.Vector3();
  const child=skeleton.bones[bone].children.find(c=>(c as T.Bone).isBone&&skeleton.bones.includes(c as T.Bone));
  if(child)axis.setFromMatrixPosition(m0.copy(skeleton.boneInverses[skeleton.bones.indexOf(child as T.Bone)]).invert()).sub(head);
  if(axis.lengthSq()<1e-8){const bounds=new T.Box3().setFromPoints(points),box=bounds.getSize(v0);axis.set(box.x>=box.y&&box.x>=box.z?1:0,box.y>box.x&&box.y>=box.z?1:0,box.z>box.x&&box.z>box.y?1:0);bounds.getCenter(head);}
  axis.normalize();
  let lo=Infinity,hi=-Infinity,r=0;for(const p of points){const t=v0.subVectors(p,head).dot(axis);lo=Math.min(lo,t);hi=Math.max(hi,t);r=Math.max(r,v1.copy(head).addScaledVector(axis,t).distanceTo(p));}
  // The rounded ends reach past the vertices on purpose: a tube's flat end has to fit inside, and at a bent
  // knee or elbow the two overlapping ends fill the corner.
  result.push({bone,name:skeleton.bones[bone].name,outer,a:head.clone().addScaledVector(axis,lo),b:head.clone().addScaledVector(axis,hi),r});}
 return result;
}

type Cloth={mesh:T.SkinnedMesh;meta:Required<GarmentMetadata>;originalGeometry:T.BufferGeometry;originalMaterial:T.Material|T.Material[];
 n:number;ids:number[][];follow:Int32Array;panels:number[][];facing:Float32Array;followBone:Int32Array;followWeight:Float32Array;skinned:T.Vector3[];straight:Float32Array;scratch:Float32Array;held:Float32Array;live:boolean;was:Float32Array;bind:T.Vector3[];dirBind:T.Vector3[];axisBind:T.Vector3[];sideBind:T.Vector3[];primary:Int32Array;mobility:Float32Array;order:number[];
 faces:Uint32Array;edges:Uint32Array;edgeRest:Float32Array;links:number[][];linkSlope:number[][];
 capsules:Capsule[];inner:number[];outer:number[];reff:Float32Array[];triReff:Float32Array[];
 skinIndex:Uint16Array;skinWeight:Float32Array;
 // per frame
 skin:Float32Array;target:T.Vector3[];origin:T.Vector3[];dir:T.Vector3[];lift:T.Vector3[];point:T.Vector3[];rho:Float32Array;rho0:Float32Array;need:Float32Array;
 ca:T.Vector3[];cb:T.Vector3[];cs:Float32Array;bone:Float32Array};

function makeCloth(mesh:T.SkinnedMesh,raw:GarmentMetadata,root:T.Object3D):Cloth{
 const meta={outerBones:[],spread:.4,slopeDown:.15,slopeSide:.6,slopeUp:.8,maxInward:.03,floor:false,...raw};
 const pos=mesh.geometry.getAttribute('position'),si=mesh.geometry.getAttribute('skinIndex'),sw=mesh.geometry.getAttribute('skinWeight');
 // Flat-shaded meshes repeat a point once per face: weld them so a seam moves as one.
 const weld=new Map<string,number>(),ids:number[][]=[],bind:T.Vector3[]=[],map:number[]=[];
 for(let i=0;i<pos.count;i++){v0.fromBufferAttribute(pos,i);const w=[0,1,2,3].map(k=>[si.getComponent(i,k),sw.getComponent(i,k)]).filter(p=>p[1]>1e-6).sort((a,b)=>a[0]-b[0]);
  const key=v0.toArray().map(x=>x.toFixed(5)).join('/')+'|'+w.map(p=>p[0]+':'+p[1].toFixed(4)).join(',');let j=weld.get(key);
  if(j===undefined){j=bind.length;weld.set(key,j);bind.push(v0.clone().applyMatrix4(mesh.bindMatrix));ids.push([]);}ids[j].push(i);map.push(j);}
 const n=bind.length,index=mesh.geometry.index,count=index?.count??pos.count,faceList:number[]=[];
 for(let i=0;i<count;i+=3){const f=[0,1,2].map(k=>map[index?index.getX(i+k):i+k]);if(f[0]!==f[1]&&f[1]!==f[2]&&f[0]!==f[2])faceList.push(...f);}
 const seen=new Set<number>(),edgeList:number[]=[],neighbours=bind.map(()=>[] as number[]);
 for(let i=0;i<faceList.length;i+=3)for(let k=0;k<3;k++){const a=faceList[i+k],b=faceList[i+(k+1)%3],key=Math.min(a,b)*n+Math.max(a,b);if(!seen.has(key)){seen.add(key);edgeList.push(a,b);neighbours[a].push(b);neighbours[b].push(a);}}
 const skinIndex=new Uint16Array(n*4),skinWeight=new Float32Array(n*4);
 for(let j=0;j<n;j++)for(let k=0;k<4;k++){skinIndex[j*4+k]=si.getComponent(ids[j][0],k);skinWeight[j*4+k]=sw.getComponent(ids[j][0],k);}
 // Outward = horizontally away from the character's centre line, leaning toward front/back (`spread` < 1):
 // legs swing forward and back, and near-parallel directions move a panel as a whole instead of fanning it out.
 const dirBind=bind.map(p=>{const d=new T.Vector3(p.x*meta.spread,0,p.z);return d.lengthSq()<1e-10?d.set(Math.sign(p.x)||0,0,p.x?0:1):d.normalize();});
 const axisBind=bind.map(p=>new T.Vector3(0,p.y,0)),sideBind=bind.map(p=>new T.Vector3(Math.abs(p.x)<1e-4?0:Math.sign(p.x),Math.abs(p.x)<1e-4?1:0,0));
 const mobility=Float32Array.from(bind,p=>1-T.MathUtils.smoothstep(p.y,meta.freeBelow,meta.pinAbove));
 // Trims (a binding strip, a badge) are separate little pieces lying on the cloth. They are not solved:
 // each of their points rides on the nearest point of the main surface, so they keep their shape.
 const parent=bind.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(let e=0;e<edgeList.length;e+=2)parent[find(edgeList[e])]=find(edgeList[e+1]);
 const size=new Map<number,number>();for(let i=0;i<n;i++)size.set(find(i),(size.get(find(i))??0)+1);
 const main=[...size].sort((a,b)=>b[1]-a[1])[0]?.[0],follow=new Int32Array(n).fill(-1);
 for(let i=0;i<n;i++){if(find(i)===main)continue;let best=-1,near=.05;for(let j=0;j<n;j++)if(find(j)===main){const dist=bind[i].distanceTo(bind[j]);if(dist<near){near=dist;best=j;}}follow[i]=best;if(best>=0)mobility[i]=0;}
 const capsules=fitCapsules(root,mesh.skeleton,raw),inner=capsules.map((c,i)=>c.outer?-1:i).filter(i=>i>=0),outer=capsules.map((c,i)=>c.outer?i:-1).filter(i=>i>=0);
 // The inner limb each point mainly lies against: its direction steers the point's way out (see pose()).
 // Of a chain (thigh, shin, foot) it is the topmost one that steers: the thigh says where the whole leg points.
 const top=(i:number):number=>{const up=inner.find(k=>mesh.skeleton.bones[capsules[k].bone]===mesh.skeleton.bones[capsules[i].bone].parent);return up===undefined?i:top(up);};
 const primary=Int32Array.from(bind,p=>{let best=-1,near=Infinity;for(const i of inner){const dist=pointSegment(p,capsules[i].a,capsules[i].b);if(dist<near){near=dist;best=i;}}return best<0?best:top(best);});
 // Follow (calm style): below the top of the legs a point leans with the nearest leg roots (the thighs),
 // more the further down it hangs, shared between left and right by how close each one is.
 const roots=inner.filter(i=>top(i)===i),followBone=new Int32Array(n*2).fill(-1),followWeight=new Float32Array(n*2);
 if(roots.length)for(let i=0;i<n;i++){const near=roots.map(k=>({k,d:Math.hypot(bind[i].x-capsules[k].a.x,bind[i].z-capsules[k].a.z)})).sort((a,b)=>a.d-b.d).slice(0,2);
  const hip=Math.max(...near.map(x=>Math.max(capsules[x.k].a.y,capsules[x.k].b.y))),depth=T.MathUtils.smoothstep(hip-bind[i].y,0,.25)*mobility[i];if(depth<=0)continue;
  const weights=near.map(x=>1/(x.d*x.d+1e-4)),sum=weights.reduce((a,b)=>a+b);near.forEach((x,k)=>{followBone[i*2+k]=capsules[x.k].bone;followWeight[i*2+k]=depth*weights[k]/sum;});}
 // Panels for the calm style: points of the main surface at about the same height, on the same side.
 const panelIndex=new Map<string,number>(),panels:number[][]=[],facing=Float32Array.from(dirBind,d=>Math.abs(d.z));
 for(let i=0;i<n;i++){if(mobility[i]<=0||follow[i]>=0)continue;const key=Math.round(bind[i].y/.03)+(dirBind[i].z>=0?'f':'b');let k=panelIndex.get(key);if(k===undefined){k=panels.length;panelIndex.set(key,k);panels.push([]);}panels[k].push(i);}
 const order=bind.map((_,i)=>i).sort((a,b)=>bind[b].y-bind[a].y||a-b);
 const links=neighbours,linkSlope=neighbours.map((list,i)=>list.map(j=>{const dy=bind[j].y-bind[i].y,len=bind[i].distanceTo(bind[j]);return (dy<-1e-4?meta.slopeDown:dy>1e-4?meta.slopeUp:meta.slopeSide)*len;}));
 // Never ask for more room than the bind pose had: that is what leaves the bind pose untouched.
 const faces=Uint32Array.from(faceList);
 // A flat face between points that are all R away from a limb can dip to sqrt(R² - L²/3) at its middle
 // (L = its longest edge). Enlarging the capsule for the point test by that much clears whole faces.
 const reach=new Float32Array(n);for(let e=0;e<edgeList.length;e+=2){const len=bind[edgeList[e]].distanceTo(bind[edgeList[e+1]])*STRETCH;reach[edgeList[e]]=Math.max(reach[edgeList[e]],len);reach[edgeList[e+1]]=Math.max(reach[edgeList[e+1]],len);}
 const reff=capsules.map(c=>Float32Array.from(bind,(p,j)=>Math.min(c.outer?c.r+meta.clearance:Math.hypot(c.r+meta.clearance,reach[j]/Math.sqrt(3)),pointSegment(p,c.a,c.b))));
 const triReff=capsules.map(c=>{const out=new Float32Array(faces.length/3);for(let f=0;f<out.length;f++)out[f]=Math.min(c.r+meta.clearance,segmentTriangleDistance(c.a,c.b,bind[faces[f*3]],bind[faces[f*3+1]],bind[faces[f*3+2]]));return out;});
 const originalGeometry=mesh.geometry,originalMaterial=mesh.material;mesh.geometry=originalGeometry.clone();
 mesh.material=Array.isArray(originalMaterial)?originalMaterial.map(m=>m.clone()):originalMaterial.clone();for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])mat.side=T.DoubleSide;
 const vectors=()=>bind.map(()=>new T.Vector3());
 return {mesh,meta,originalGeometry,originalMaterial,n,ids,follow,panels,facing,followBone,followWeight,skinned:vectors(),straight:new Float32Array(mesh.skeleton.bones.length).fill(1),scratch:new Float32Array(16),held:new Float32Array(n),live:false,was:new Float32Array(capsules.length*6),bind,dirBind,axisBind,sideBind,primary,mobility,order,faces,edges:Uint32Array.from(edgeList),
  edgeRest:new Float32Array(edgeList.length/2),links,linkSlope,capsules,inner,outer,reff,triReff,skinIndex,skinWeight,
  skin:new Float32Array(n*16),target:vectors(),origin:vectors(),dir:vectors(),lift:vectors(),point:vectors(),rho:new Float32Array(n),rho0:new Float32Array(n),need:new Float32Array(n),
  ca:capsules.map(()=>new T.Vector3()),cb:capsules.map(()=>new T.Vector3()),cs:new Float32Array(capsules.length),bone:new Float32Array(mesh.skeleton.bones.length*16)};
}

export class GarmentRuntime{
 private cloth:Cloth[]=[];
 /** Count what is still inside a capsule after solving (costs a full extra pass: for audits and tests). */
 verify=false;
 private readonly root:T.Object3D;
 /** Set to false to show the plain skinned garment (for comparison). */
 enabled=true;
 /** How the cloth moves: 'calm' (heavy fabric, the default) or 'dynamic' (follows every step). See the top of this file. */
 style:DrapeStyle='calm';
 private last=-1;
 private dt=0;
 diagnostics={garments:0,capsules:0,remainingIntersections:0,maxCorrection:0,maxEdgeRatio:1,capped:0,milliseconds:0};
 constructor(root:T.Object3D){this.root=root;root.updateWorldMatrix(true,true);
  root.traverse(o=>{const mesh=o as T.SkinnedMesh,meta=o.userData.garment as GarmentMetadata|undefined;if(mesh.isSkinnedMesh&&meta?.version===2&&meta.profile==='drape.v2')this.cloth.push(makeCloth(mesh,meta,root));});
  this.diagnostics.garments=this.cloth.length;this.diagnostics.capsules=this.cloth.reduce((s,c)=>s+c.capsules.length,0);}
 /** The capsules of every garment, in bind space (for tests and review tools). */
 capsules(){return this.cloth.flatMap(c=>c.capsules);}
 /**
  * Call after the skeleton has been posed and world matrices are up to date. `seconds` is the time since the
  * previous call (for the calm style); left out, the wall clock is used. reset() forgets the previous frame.
  */
 update(seconds?:number){const d=this.diagnostics;if(!this.cloth.length)return;const start=performance.now();
  this.dt=seconds??(this.last<0?0:Math.min(.1,(start-this.last)/1000));this.last=start;d.remainingIntersections=0;d.maxCorrection=0;d.maxEdgeRatio=1;d.capped=0;
  for(const c of this.cloth){this.pose(c);if(this.enabled)this.solve(c);else c.live=false;this.write(c);}
  d.milliseconds=performance.now()-start;}
 private pose(c:Cloth){
  const bones=c.mesh.skeleton.bones,inv=c.mesh.skeleton.boneInverses,rootInv=m1.copy(this.root.matrixWorld).invert();
  for(let k=0;k<bones.length;k++)m0.multiplyMatrices(rootInv,bones[k].matrixWorld).multiply(inv[k]).toArray(c.bone,k*16);
  const s=c.skin,b=c.bone,lean=this.enabled?DRAPE_STYLES[this.style].follow:0,blend=c.scratch;
  for(let i=0;i<c.capsules.length;i++){const cap=c.capsules[i];m0.fromArray(b,cap.bone*16);c.ca[i].copy(cap.a).applyMatrix4(m0);c.cb[i].copy(cap.b).applyMatrix4(m0);
   // A scaled bone (body proportions) scales its limb: stay on the safe side with the largest axis.
   // How much this limb still hangs the way it was fitted; eased over time so a leg hovering around the limit
   // (walking in a crouch) does not switch the follow on and off.
   const hangs=1-T.MathUtils.smoothstep(v1.subVectors(c.cb[i],c.ca[i]).angleTo(v2.subVectors(cap.b,cap.a)),.6,1);
   c.straight[cap.bone]=c.live&&lean>0?c.straight[cap.bone]+(hangs-c.straight[cap.bone])*(1-Math.exp(-this.dt/.3)):hangs;
   const e=m0.elements;c.cs[i]=Math.sqrt(Math.max(e[0]*e[0]+e[1]*e[1]+e[2]*e[2],e[4]*e[4]+e[5]*e[5]+e[6]*e[6],e[8]*e[8]+e[9]*e[9]+e[10]*e[10]));}
  for(let j=0;j<c.n;j++){const o=j*16;for(let e=0;e<16;e++)s[o+e]=0;
   for(let k=0;k<4;k++){const w=c.skinWeight[j*4+k];if(w===0)continue;const q=c.skinIndex[j*4+k]*16;for(let e=0;e<16;e++)s[o+e]+=b[q+e]*w;}
   m0.fromArray(s,o);c.skinned[j].copy(c.bind[j]).applyMatrix4(m0);v0.copy(c.axisBind[j]).applyMatrix4(m0);c.target[j].copy(c.skinned[j]);
   // Calm style: where the point starts from leans with the leg roots. Its centre line and outward direction
   // stay those of its real skinning, so "outside" keeps its meaning. A leg folded far from how it hangs
   // (a crouch) is not followed.
   const b0=c.followBone[j*2],b1=c.followBone[j*2+1],f0=b0<0?0:c.followWeight[j*2]*lean*c.straight[b0],f1=b1<0?0:c.followWeight[j*2+1]*lean*c.straight[b1];
   if(f0+f1>0){const e=m0.elements;for(let k=0;k<16;k++)blend[k]=e[k]*(1-f0-f1)+b[b0*16+k]*f0+(f1>0?b[b1*16+k]*f1:0);m2.fromArray(blend);c.target[j].copy(c.bind[j]).applyMatrix4(m2);}
   const dir=c.dir[j].copy(c.dirBind[j]).transformDirection(m0),limb=c.primary[j];
   // A ray that runs along a limb would leave it only at the far end (a crouch: thighs pointing forward).
   // Take that part out of the direction and lean sideways instead, so the cloth falls beside the limb.
   if(limb>=0&&c.mobility[j]>0){v1.subVectors(c.cb[limb],c.ca[limb]).normalize();const along=dir.dot(v1);
    // Only once the limb really points along the ray (not for the swing of a walk), so a walk keeps steady directions.
    const steer=T.MathUtils.smoothstep(Math.abs(along),.5,.85);
    if(steer>0){v2.copy(c.sideBind[j]).transformDirection(m0);dir.addScaledVector(v1,-along*steer).addScaledVector(v2,along*along*steer);if(dir.lengthSq()<1e-8)dir.copy(v2);dir.normalize();}}
   // The ray starts on the character's centre line, so "outside" always means the same side of every limb.
   c.rho0[j]=c.rho[j]=Math.max(0,v1.subVectors(c.target[j],v0).dot(dir));c.origin[j].copy(c.target[j]).addScaledVector(dir,-c.rho0[j]);
   c.lift[j].set(0,0,0);c.point[j].copy(c.target[j]);}
  for(let e=0;e<c.edges.length;e+=2)c.edgeRest[e/2]=c.skinned[c.edges[e]].distanceTo(c.skinned[c.edges[e+1]]);
 }
 private place(c:Cloth,j:number){c.point[j].copy(c.origin[j]).add(c.lift[j]).addScaledVector(c.dir[j],c.rho[j]);}
 private solve(c:Cloth){const meta=c.meta,d=this.diagnostics,style=DRAPE_STYLES[this.style];
  // Out of the inner limbs. A ray that only grazes a limb eases in over the first few centimetres of chord,
  // so a limb entering a point's line from the side does not make the point jump.
  for(let j=0;j<c.n;j++){if(c.mobility[j]<=0)continue;let need=c.rho0[j],wall=-Infinity;
   for(const i of c.inner){const exit=rayCapsuleExit(c.origin[j],c.dir[j],c.ca[i],c.cb[i],c.reff[i][j]*c.cs[i]);if(exit>wall)wall=exit;if(exit<=need)continue;
    const eased=c.rho0[j]+(exit-c.rho0[j])*T.MathUtils.smoothstep(rayChord*.5,0,GRAZE);if(eased>need)need=eased;}
   c.need[j]=wall;c.rho[j]=Math.min(need,c.rho0[j]+MAX_PUSH);if(need>c.rho0[j]+MAX_PUSH)d.capped++;}
  // Tent: a pushed point carries its neighbours with it, falling back to rest at a limited slope.
  // It only ever moves points outward, so it cannot undo the clearance above.
  const tent=()=>{for(let sweep=0;sweep<4;sweep++){let raised=0;for(let o=0;o<c.n*2;o++){const i=c.order[o<c.n?o:2*c.n-1-o],push=c.rho[i]-c.rho0[i];if(push<=EPS)continue;
   const links=c.links[i],slope=c.linkSlope[i];for(let k=0;k<links.length;k++){const j=links[k],want=(push-slope[k]*style.slope)*c.mobility[j];if(want>c.rho[j]-c.rho0[j]+1e-4){c.rho[j]=c.rho0[j]+want;raised++;}}}if(!raised)break;}};
  tent();
  // Whole faces: what the enlarged capsules did not already clear (a face stretched between a pushed and a
  // resting point). Small corrections on top of the smooth shape, then the tent again.
  for(let pass=0;pass<6;pass++){let moved=0;for(let j=0;j<c.n;j++)if(c.mobility[j]>0)this.place(c,j);
   for(let f=0;f<c.faces.length;f+=3){const x=c.faces[f],y=c.faces[f+1],z=c.faces[f+2];if(c.mobility[x]<=0&&c.mobility[y]<=0&&c.mobility[z]<=0)continue;
    const p=c.point[x],q=c.point[y],r=c.point[z];
    for(const i of c.inner){const radius=c.triReff[i][f/3]*c.cs[i],a=c.ca[i],b=c.cb[i];if(apart(p,q,r,a,b,radius))continue;
     const dist=segmentTriangleDistance(a,b,p,q,r),lack=radius-dist;if(lack<=1e-4)continue;
     if(dist>1e-6)v1.subVectors(onTri,onSeg).multiplyScalar(1/dist);else v1.copy(c.dir[x]).add(c.dir[y]).add(c.dir[z]).normalize();
     for(let k=0;k<3;k++){const j=c.faces[f+k];if(c.mobility[j]<=0)continue;c.rho[j]=Math.min(c.rho[j]+lack/Math.max(.5,v1.dot(c.dir[j])),c.rho0[j]+MAX_PUSH);this.place(c,j);}moved++;}}
   if(!moved)break;tent();}
  // Calm style. Everything here only moves points further out, so the clearance above still holds.
  if(style.share>0){for(const panel of c.panels){let most=0;for(const j of panel){const push=(c.rho[j]-c.rho0[j])*c.facing[j];if(push>most)most=push;}
    if(most>EPS)for(const j of panel){const want=most*style.share*c.facing[j]*c.mobility[j];if(want>c.rho[j]-c.rho0[j])c.rho[j]=c.rho0[j]+want;}}tent();}
  // How fast the inner limbs move (m/s, in the character's own space) decides how long the cloth stays out.
  let speed=0;for(const i of c.inner){const a=c.ca[i],b=c.cb[i],o=i*6;if(c.live&&this.dt>1e-4)speed=Math.max(speed,Math.hypot(a.x-c.was[o],a.y-c.was[o+1],a.z-c.was[o+2])/this.dt,Math.hypot(b.x-c.was[o+3],b.y-c.was[o+4],b.z-c.was[o+5])/this.dt);
   c.was[o]=a.x;c.was[o+1]=a.y;c.was[o+2]=a.z;c.was[o+3]=b.x;c.was[o+4]=b.y;c.was[o+5]=b.z;}
  if(style.settle>0&&c.live){const keep=Math.exp(-this.dt/T.MathUtils.lerp(style.settle,style.hold,T.MathUtils.smoothstep(speed,.2,1)));let raised=false;
   for(let j=0;j<c.n;j++){const was=c.held[j]*keep;if(was>c.rho[j]-c.rho0[j]+1e-5){c.rho[j]=c.rho0[j]+was;raised=true;}}if(raised)tent();}
  for(let j=0;j<c.n;j++)c.held[j]=c.rho[j]-c.rho0[j];c.live=true;
  // Outer limbs press the cloth inward by twice their depth in it (so it starts from nothing), never far,
  // never where an inner limb is already pushing, and never past the surface of an inner limb.
  for(let j=0;j<c.n;j++){if(c.mobility[j]<=0)continue;this.place(c,j);if(!c.outer.length||c.rho[j]>c.rho0[j]+EPS)continue;let inward=0;
   for(const i of c.outer){const depth=c.reff[i][j]*c.cs[i]-pointSegment(c.point[j],c.ca[i],c.cb[i]);if(depth>inward)inward=depth;}
   if(inward>0){c.rho[j]=Math.min(c.rho0[j],Math.max(c.rho0[j]-meta.maxInward*c.mobility[j],c.rho0[j]-inward*2,c.need[j]+meta.clearance));this.place(c,j);}}
  // Ground: the hem rests on the floor and spreads a little instead of sinking through it.
  if(meta.floor)for(let j=0;j<c.n;j++){const lack=.01-c.point[j].y;if(lack>0&&c.mobility[j]>0){c.lift[j].y=lack;c.rho[j]+=lack*.5;this.place(c,j);}}
  for(let j=0;j<c.n;j++){const k=c.follow[j];if(k>=0)c.point[j].copy(c.target[j]).add(c.point[k]).sub(c.target[k]);}
  // Audit against the plain capsules: points, then whole faces.
  if(this.verify){for(let j=0;j<c.n;j++){if(c.mobility[j]<=0)continue;for(const i of c.inner)if(pointSegment(c.point[j],c.ca[i],c.cb[i])<Math.min(c.reff[i][j],c.capsules[i].r+meta.clearance)*c.cs[i]-1e-3){d.remainingIntersections++;break;}}
   for(let f=0;f<c.faces.length;f+=3){const x=c.faces[f],y=c.faces[f+1],z=c.faces[f+2];if(c.mobility[x]<=0&&c.mobility[y]<=0&&c.mobility[z]<=0)continue;
    for(const i of c.inner){const radius=c.triReff[i][f/3]*c.cs[i];if(!apart(c.point[x],c.point[y],c.point[z],c.ca[i],c.cb[i],radius)&&segmentTriangleDistance(c.ca[i],c.cb[i],c.point[x],c.point[y],c.point[z])<radius-1e-3){d.remainingIntersections++;break;}}}}
 }
 private write(c:Cloth){const d=this.diagnostics,position=c.mesh.geometry.getAttribute('position'),source=c.originalGeometry.getAttribute('position'),toGeometry=m1.copy(c.mesh.bindMatrix).invert();
  for(let j=0;j<c.n;j++){const moved=c.point[j].distanceTo(c.skinned[j]);
   // An unmoved point gets back exactly what was authored, not a rounded copy.
   if(moved<1e-7){for(const i of c.ids[j])position.setXYZ(i,source.getX(i),source.getY(i),source.getZ(i));continue;}
   if(moved>d.maxCorrection)d.maxCorrection=moved;
   v0.copy(c.point[j]).applyMatrix4(m0.fromArray(c.skin,j*16).invert()).applyMatrix4(toGeometry);for(const i of c.ids[j])position.setXYZ(i,v0.x,v0.y,v0.z);}
  position.needsUpdate=true;c.mesh.geometry.computeVertexNormals();c.mesh.geometry.computeBoundingSphere();
  for(let e=0;e<c.edges.length;e+=2){const rest=c.edgeRest[e/2];if(rest>1e-6){const ratio=c.point[c.edges[e]].distanceTo(c.point[c.edges[e+1]])/rest;if(ratio>d.maxEdgeRatio)d.maxEdgeRatio=ratio;}}
 }
 /** Stride and step-height multipliers the wearer's walk should use in the current style, or null without a garment. */
 get gait(){return this.cloth.length?DRAPE_STYLES[this.style].gait:null;}
 /** Forget the previous frame: the next update starts from the plain 'dynamic' shape (after a teleport or a cut). */
 reset(){for(const c of this.cloth)c.live=false;}
 dispose(){for(const c of this.cloth){c.mesh.geometry.dispose();c.mesh.geometry=c.originalGeometry;for(const mat of Array.isArray(c.mesh.material)?c.mesh.material:[c.mesh.material])mat.dispose();c.mesh.material=c.originalMaterial;}this.cloth=[];this.diagnostics.garments=0;}
}
