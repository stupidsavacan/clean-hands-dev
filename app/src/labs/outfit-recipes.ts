import {parseRecipe as parseLegacy,fittedModel} from './outfit-design.ts';
export type Piece={part:string;mesh:string;colors:Record<string,number>;parameters:Record<string,string|number|boolean>};
export type CharacterRecipe={schemaVersion:number;assetMode:'generated'|'fixed'|'alias';id:string;label?:string;
 body?:{profile:string;parameters:Record<string,unknown>};parts?:Piece[];output?:{meshOrder:string[];animationProfile:string;exportProfile:string};
 palette?:Record<string,unknown>;identity?:Record<string,unknown>;specialOperations?:unknown[];rig?:string;
 aliasOf?:string;appearanceColors?:Record<string,string>;mark?:unknown;surfaceMark?:unknown;[key:string]:unknown};
export type PartDef={id:string;label:string;bodies:string[];colors:string[];parameters:Record<string,(string|number|boolean)[]>;slot:string};
export type OutfitCatalog={version:number;bodies:string[];parts:PartDef[]};
export const bodyLabels:Record<string,string>={'cast.male.v1':'キャストの男性','cast.female.v1':'キャストの女性','pool.resort.v1':'プール客・ふくよか','pool.swimsuit.v1':'プール客・女性','pool.shorts.v1':'プール客・男性','pool.variant.slim.v1':'プール客・細身女性','pool.variant.lean.v1':'プール客・細身男性','pool.variant.strong.v1':'プール客・筋肉質女性'};
export const slotLabels:Record<string,string>={head:'頭',face:'顔',hair:'髪',top:'トップス',pants:'パンツ',outer:'上着',shoes:'靴',accessories:'小物',patterns:'模様'};
const words:Record<string,string>={cast:'共通',uniform:'制服',pool:'プール',legacy:'従来',head:'頭',face:'顔',male:'男性',female:'女性',hair:'髪',torso:'胴と袖',legs:'脚と靴',top:'トップス',pants:'パンツ',accessories:'小物',layer:'重ね着',dress:'衣装の飾り',chef:'料理人',cleaner:'清掃',delivery:'配達',fisher:'漁師',bodyguard:'護衛',sommelier:'ソムリエ',driver:'運転手',beachbar:'バー係',pilot:'操縦士',masseuse:'施術師',underwear:'下着',wine_merchant:'ワイン商',lawyer:'弁護士',investor:'投資家',response:'増援',collar:'襟',camera:'カメラ',glasses:'眼鏡',hat:'帽子',feet:'靴の配色',bald:'坊主',slick:'撫で付け',spiky:'立てた髪',outer:'上着','chest-details':'襟元の飾り','vest-inlay':'ベストの切り替え',photographer:'カメラマン',details:'飾り',boots:'ブーツ',underwear_dark:'下着・濃い肌色',underwear_female:'下着・女性','delivery-inlay':'反射ベスト'};
export const partLabel=(id:string)=>id.split('.').filter(x=>x!=='v1').map(x=>words[x]??x).join('・');
export function available(catalog:OutfitCatalog,profile:string,slot:string){return catalog.parts.filter(p=>p.slot===slot&&p.bodies.includes(profile)&&!(profile==='cast.female.v1'&&p.id.includes('.male.'))).map(p=>{
 if(profile==='cast.female.v1'&&p.id==='cast.chest-details.v1')return {...p,parameters:{...p.parameters,kind:['dress']}};
 if(profile.startsWith('pool.')&&p.id.startsWith('pool.')&&p.parameters.kind&&(slot!=='hair'||profile==='pool.variant.strong.v1')){
  const kind=profile==='pool.resort.v1'?'resort':['pool.shorts.v1','pool.variant.lean.v1'].includes(profile)?'shorts':'swimsuit';
  return {...p,parameters:{...p.parameters,kind:[kind]}};
 }
 return p;
});}

export function selectPiece(recipe:CharacterRecipe,catalog:OutfitCatalog,slot:string,id:string,parameters:Record<string,string|number|boolean>={}){
 if(recipe.assetMode!=='generated'||!recipe.body||!recipe.parts||!recipe.output)throw new Error('固定資産は編集できません。新しいキャラを選んでください。');
 if((recipe.specialOperations as {operation?:string}[]|undefined)?.some(op=>op.operation?.startsWith('dj.'))&&['hair','top','pants','accessories','patterns'].includes(slot))throw new Error('DJ専用の一体部品です。新しいキャラから組み合わせてください。');
 const next=structuredClone(recipe),parts=next.parts!,defs=new Map(catalog.parts.map(p=>[p.id,p]));
 const indexes=parts.flatMap((p,i)=>defs.get(p.part)?.slot===slot?[i]:[]);
 if(!id){next.parts=parts.filter((_,i)=>!indexes.includes(i));return next;}
 const def=available(catalog,recipe.body.profile,slot).find(p=>p.id===id);
 if(!def)throw new Error('体型に合わない部品です。');
 const old=parts[indexes[0]],pool=recipe.body.profile.startsWith('pool.');
 const mesh=old?.mesh??({head:pool?'Head':'Body',face:'Face',hair:'Hair',top:pool?'Body':'Outfit',pants:pool?'Legs':'Outfit',shoes:pool?'Legs':'Outfit',outer:'Accessories',accessories:pool?'Details':'Accessories',patterns:pool?'Details':'Accessories'}[slot]??'Accessories');
 const params=Object.fromEntries(Object.entries(def.parameters).map(([key,values])=>{
  const chosen=parameters[key]??(old?.parameters[key]!==undefined&&values.includes(old.parameters[key])?old.parameters[key]:values[0]);
  if(!values.includes(chosen))throw new Error('未登録の部品設定です。');return [key,chosen];
 }));
 const colors=Object.fromEntries(def.colors.map(key=>[key,old?.colors[key]??(key==='skin'?7:key==='hair'||key==='hc'?0:key==='color'&&slot==='top'?1:0)]));
 const piece={part:id,mesh,colors,parameters:params};
 if(indexes.length){next.parts=parts.map((p,i)=>i===indexes[0]?piece:p).filter((_,i)=>i===indexes[0]||!indexes.includes(i));}
 else {const order=['head','face','top','pants','shoes','hair','outer','accessories','patterns'];const at=parts.findIndex(p=>order.indexOf(defs.get(p.part)?.slot??'structure')>order.indexOf(slot));parts.splice(at<0?parts.length:at,0,piece);}
 if(!next.output!.meshOrder.includes(mesh))next.output!.meshOrder.push(mesh);
 return next;
}
export async function postBuild(base:string,recipe:CharacterRecipe,name:string){
 const response=await fetch(base+'/api/outfit/jobs',{method:'POST',headers:{'Content-Type':'application/json','X-Outfit-Lab':'1'},body:JSON.stringify({recipe,name})});
 const value=await response.json();if(!response.ok)throw new Error(value.error??'保存できませんでした。');return value as {id:string;state:string};
}
export function migrateLegacy(value:unknown,catalog:OutfitCatalog,base:CharacterRecipe){
 const old=parseLegacy(value);let next=structuredClone(base);
 for(const [slot,part,model] of [['top','legacy.top.v1',old.pieces.TShirt.model],['pants','legacy.pants.v1',old.pieces.Jeans.model],['outer','outer.layer.v1',fittedModel(old.pieces.Jacket)],['accessories','legacy.accessories.v1',old.pieces.Sunglasses.model]])next=selectPiece(next,catalog,slot,model?part:'',{model});
 next=selectPiece(next,catalog,'patterns','');next=selectPiece(next,catalog,'hair','cast.hair.v1',{kind:'swept'});
 for(const p of next.parts!)if(p.part==='cast.face.male.v1')p.colors.hair=0;
 next.id='draft';next.appearanceColors={top:old.pieces.TShirt.color,pants:old.pieces.Jeans.color,outer:old.pieces.Jacket.color,accessories:old.pieces.Sunglasses.color};
 next.mark=old.mark;next.surfaceMark={mesh:old.mark.placement?.slot==='Jacket'?'Outer':old.pieces.TShirt.model};return next;
}
