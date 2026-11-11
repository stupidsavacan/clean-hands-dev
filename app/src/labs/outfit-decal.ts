import * as T from 'three';
import type {MarkPlacement} from './outfit-design';

type Corner={point:T.Vector3;projected:T.Vector3;weights:Map<number,number>};
const xyz=['x','y','z'] as const;

export function isClothFace(mesh:T.SkinnedMesh,indices:readonly number[]){
 if(mesh.name!=='TShirt')return true;
 const uv=mesh.geometry.getAttribute('uv');
 // Skin and cloth share the T-shirt mesh. Only the two fabric palette cells accept marks.
 const u=indices.reduce((sum,i)=>sum+uv.getX(i),0)/3,v=indices.reduce((sum,i)=>sum+uv.getY(i),0)/3;
 const cell=Math.floor(u*4)+4*Math.floor(v*4);
 return cell===1||cell===11;
}

export function placementFromHit(mesh:T.SkinnedMesh,hit:T.Intersection,slot:MarkPlacement['slot'],size:number,angle:number,rayDirection:T.Vector3):MarkPlacement|null{
 if(!hit.face)return null;
 const ids=[hit.face.a,hit.face.b,hit.face.c];
 if(!isClothFace(mesh,ids))return null;
 const posed=ids.map(i=>mesh.getVertexPosition(i,new T.Vector3()));
 const local=mesh.worldToLocal(hit.point.clone());
 const mix=T.Triangle.getBarycoord(local,posed[0],posed[1],posed[2],new T.Vector3());
 if(!mix)return null;
 const p=mesh.geometry.getAttribute('position');
 const bind=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i));
 const point=new T.Vector3().addScaledVector(bind[0],mix.x).addScaledVector(bind[1],mix.y).addScaledVector(bind[2],mix.z);
 const normal=T.Triangle.getNormal(bind[0],bind[1],bind[2],new T.Vector3());
 const localRay=rayDirection.clone().transformDirection(mesh.matrixWorld.clone().invert());
 const posedNormal=T.Triangle.getNormal(posed[0],posed[1],posed[2],new T.Vector3());
 if(posedNormal.dot(localRay)>0)normal.negate();
 return {slot,point:point.toArray(),normal:normal.toArray(),size,angle};
}

function cut(poly:Corner[],axis:(typeof xyz)[number],limit:number,sign:number){
 const clipped:Corner[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];
  const da=sign*(a.projected[axis]-limit),db=sign*(b.projected[axis]-limit);
  if(da<=0)clipped.push(a);
  if((da<=0)===(db<=0))continue;
  const t=da/(da-db),weights=new Map<number,number>();
  for(const [bone,w] of a.weights)weights.set(bone,w*(1-t));
  for(const [bone,w] of b.weights)weights.set(bone,(weights.get(bone)??0)+w*t);
  clipped.push({point:a.point.clone().lerp(b.point,t),projected:a.projected.clone().lerp(b.projected,t),weights});
 }
 return clipped;
}

/** Clip the garment's bind-pose triangles and interpolate their skinning onto the mark. */
export function projectMark(mesh:T.SkinnedMesh,placement:MarkPlacement,material:T.Material){
 const {geometry}=mesh;
 const p=geometry.getAttribute('position'),j=geometry.getAttribute('skinIndex'),w=geometry.getAttribute('skinWeight');
 const center=new T.Vector3(...placement.point),normal=new T.Vector3(...placement.normal).normalize();
 const vertical=Math.abs(normal.y)<.94?new T.Vector3(0,1,0):new T.Vector3(0,0,1);
 const right=vertical.cross(normal).normalize().applyAxisAngle(normal,T.MathUtils.degToRad(placement.angle));
 const up=new T.Vector3().crossVectors(normal,right);
 const radius=placement.size/2,depth=Math.min(.065,placement.size*.65);
 const points:number[]=[],uvs:number[]=[],bones:number[]=[],weights:number[]=[];
 const at=(i:number)=>geometry.index?.getX(i)??i;
 function emit(c:Corner,faceNormal:T.Vector3){
  points.push(...c.point.clone().addScaledVector(faceNormal,.002).toArray());
  uvs.push(c.projected.x/placement.size+.5,.5-c.projected.y/placement.size);
  const ranked=[...c.weights].sort((a,b)=>b[1]-a[1]).slice(0,4);
  const sum=ranked.reduce((value,entry)=>value+entry[1],0);
  for(let i=0;i<4;i++){bones.push(ranked[i]?.[0]??0);weights.push((ranked[i]?.[1]??0)/sum);}
 }
 for(let offset=0;offset<(geometry.index?.count??p.count);offset+=3){
  const ids=[at(offset),at(offset+1),at(offset+2)];
  if(!isClothFace(mesh,ids))continue;
  const pos=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i));
  const faceNormal=T.Triangle.getNormal(pos[0],pos[1],pos[2],new T.Vector3());
  // Some legacy garment panels are double-sided and use reversed winding.
  const alignment=faceNormal.dot(normal);
  if(Math.abs(alignment)<.25)continue;
  if(alignment<0)faceNormal.negate();
  let poly=pos.map((point,k)=>{
   const d=point.clone().sub(center),i=ids[k],weights=new Map<number,number>();
   const indices=[j.getX(i),j.getY(i),j.getZ(i),j.getW(i)];
   [w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].forEach((value,k)=>{
    if(value>0)weights.set(indices[k],(weights.get(indices[k])??0)+value);
   });
   return {point,projected:new T.Vector3(d.dot(right),d.dot(up),d.dot(normal)),weights};
  });
  for(const axis of xyz){
   const limit=axis==='z'?depth:radius;
   poly=cut(cut(poly,axis,limit,1),axis,-limit,-1);
  }
  for(let i=1;i+1<poly.length;i++){
   if(new T.Triangle(poly[0].point,poly[i].point,poly[i+1].point).getArea()<1e-10)continue;
   const triangle=alignment>0?[poly[0],poly[i],poly[i+1]]:[poly[0],poly[i+1],poly[i]];
   for(const corner of triangle)emit(corner,faceNormal);
  }
 }
 if(!points.length)return null;
 const decal=new T.BufferGeometry();
 decal.setAttribute('position',new T.Float32BufferAttribute(points,3));
 decal.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 decal.setAttribute('skinIndex',new T.Uint16BufferAttribute(bones,4));
 decal.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 decal.computeVertexNormals();
 const mark=new T.SkinnedMesh(decal,material);
 mark.name='Mark_Surface';
 mark.position.copy(mesh.position);mark.quaternion.copy(mesh.quaternion);mark.scale.copy(mesh.scale);
 mark.frustumCulled=false;mark.renderOrder=1;
 mesh.parent?.add(mark);
 mark.bind(mesh.skeleton,mesh.bindMatrix);
 return mark;
}
