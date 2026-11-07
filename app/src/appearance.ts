import * as T from 'three';
import { visibleParts, type Look } from './wardrobe';
// A look is applied by (1) showing the right wardrobe meshes, (2) the brow shape keys, and (3) recolouring: every mesh
// samples a 4x4 flat-colour palette (cell = column + 4 * row), so a recolour is a copy of that palette with some cells
// replaced. Meshes that share a cell but must be coloured independently (hair, suit, tie, gloves) get their own copy.
type Cells=Record<number,string>;
const mixHex=(a:string,b:string,t:number)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16),c=(s:number)=>Math.round(((x>>s)&255)*(1-t)+((y>>s)&255)*t);return '#'+((1<<24)|(c(16)<<16)|(c(8)<<8)|c(0)).toString(16).slice(1);};
// Cell roles in the wardrobe GLB: 0 suit/hair/black, 1 shirt/eye white, 2 red (gloves, tie), 7 skin, 9 brow/mouth, 15 grey suit/frame.
function groupOf(name:string,look:Look):{key:string;cells:Cells}|null{
 if(name==='Body')return {key:'body',cells:{7:look.skin,2:look.gloveColor}};
 if(name==='Hair_skinhead')return {key:'skinhead',cells:{7:look.skin}};
 if(name.startsWith('Hair_'))return {key:'hair',cells:{0:look.hairColor}};
 if(name==='Face')return {key:'face',cells:{9:mixHex(look.hairColor,'#503f35',.55)}};
 if(name==='Outfit_suit'||name==='Details_suit')return {key:'suit',cells:{0:look.suitColor,1:look.shirtColor}};
 if(name==='Outfit_tie'||name==='Details_tie')return {key:'suit2',cells:{15:look.suitColor,0:mixHex(look.suitColor,'#000000',.45),1:look.shirtColor}};
 if(name==='Tie_red')return {key:'tie',cells:{2:look.tieColor}};
 if(name==='Tie_black')return {key:'tieb',cells:{0:look.tieColor}};
 if(name==='Glasses')return {key:'frame',cells:{15:look.frameColor}};
 return null;}
type Store={orig:Map<T.Object3D,T.Material|T.Material[]>;tex:Map<string,{sig:string;map:T.Texture;mat:T.Material}>};
function storeOf(root:T.Object3D):Store{const u=root.userData as {__look?:Store};// Object3D.clone() copies userData as JSON, so a cloned root carries a hollow store: rebuild it.
 return u.__look&&u.__look.orig instanceof Map?u.__look:(u.__look={orig:new Map(),tex:new Map()});}
function recolour(base:T.MeshStandardMaterial,cells:Cells):{map:T.Texture;mat:T.MeshStandardMaterial}{
 const src=base.map!.image as CanvasImageSource&{width:number;height:number},size=src.width||256,cv=document.createElement('canvas');cv.width=cv.height=size;const g=cv.getContext('2d')!;g.drawImage(src,0,0,size,size);
 const cell=size/4;for(const [c,color] of Object.entries(cells)){g.fillStyle=color;g.fillRect((Number(c)%4)*cell,Math.floor(Number(c)/4)*cell,cell,cell);}
 const map=new T.CanvasTexture(cv);map.flipY=false;map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;map.minFilter=T.NearestMipmapNearestFilter;map.generateMipmaps=true;
 const mat=base.clone();mat.map=map;mat.needsUpdate=true;return {map,mat};}
export function applyLook(root:T.Object3D,look:Look){const fixed=!!root.userData.characterId&&root.userData.characterId!=='wardrobe';const show=new Set(visibleParts(look)),store=storeOf(root);
 // Things carried on the body (an item in hand, a sword on the back) are not parts of the look (2026-11-06: a change of
 // clothes hid the briefcase in hand).
 root.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;if(m.userData.uniform||m.userData.carried)return;m.visible=fixed?(o.name!=='Glasses'||look.glasses):show.has(o.name);
  const dict=m.morphTargetDictionary,w=m.morphTargetInfluences;if(o.name==='Face'&&dict&&w){w.fill(0);if(dict.calm!==undefined)w[dict.calm]=1;if(dict.brow_sharp!==undefined)w[dict.brow_sharp]=Math.max(0,look.brow);if(dict.brow_soft!==undefined)w[dict.brow_soft]=Math.max(0,-look.brow);}
  if(!m.visible||fixed)return;const grp=groupOf(o.name,look);if(!grp)return;
  if(!store.orig.has(o))store.orig.set(o,m.material);const base=store.orig.get(o) as T.MeshStandardMaterial;if(!base.map)return;
  const sig=JSON.stringify(grp.cells);let entry=store.tex.get(grp.key);
  if(!entry||entry.sig!==sig){entry?.map.dispose();entry?.mat.dispose();const made=recolour(base,grp.cells);entry={sig,map:made.map,mat:made.mat};store.tex.set(grp.key,entry);}
  m.material=entry.mat;});}
