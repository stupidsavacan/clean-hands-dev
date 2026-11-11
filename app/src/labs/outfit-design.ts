export const parts=[
 {id:'TShirt',label:'トップス',variants:[['TShirt','半袖Tシャツ'],['Shirt','襟付きシャツ']],base:'#e7e1d3',colors:['#e7e1d3','#f3f3ef','#2b2e35','#8c4947','#526981'],cells:[[1,0],[11,-.14]]},
 {id:'Jeans',label:'パンツ',variants:[['Jeans','ジーンズ'],['WideJeans','ワイドデニム'],['Trousers','スラックス']],base:'#345880',colors:['#345880','#7394ab','#26374d','#403a35','#33383d'],cells:[[5,0],[6,.10],[13,-.24]]},
 {id:'Jacket',label:'上着',variants:[['Jacket','フィールドジャケット'],['Bomber','フライトジャケット'],['Blazer','ブレザー'],['','なし']],base:'#53634b',colors:['#53634b','#2b2e35','#826448','#3b5b8a','#743e3a'],cells:[[4,0],[10,-.25]]},
 {id:'Sunglasses',label:'アクセサリー',variants:[['Sunglasses','サングラス'],['Cap','キャップ'],['Tie','ネクタイ'],['','なし']],base:'#18202a',colors:['#18202a','#342820','#2a394f','#48323f'],cells:[[0,0]]},
] as const;
export type Part=(typeof parts)[number];
export type Choice={color:string;model:string;collar?:boolean;long?:boolean};
export const jacketModels:Record<string,readonly string[]>={
 Jacket:['Jacket','JacketCollar','JacketLong','JacketLongCollar'],
 Bomber:['Bomber','BomberCollar','BomberLong','BomberLongCollar'],
};
export const fittedModel=(choice:Choice)=>jacketModels[choice.model]?.[(choice.collar?1:0)+(choice.long?2:0)]??choice.model;
export type Outfit=Record<Part['id'],Choice>;
export const defaults:Outfit={
 TShirt:{color:parts[0].base,model:'TShirt'},
 Jeans:{color:parts[1].base,model:'Jeans'},
 Jacket:{color:parts[2].base,model:'Jacket'},
 Sunglasses:{color:parts[3].base,model:'Sunglasses'},
};

export type MarkPlacement={slot:'TShirt'|'Jacket';point:[number,number,number];normal:[number,number,number];size:number;angle:number};
export type Mark={text:string;color:string;png?:string;placement?:MarkPlacement};
export type Recipe={version:1;pieces:Outfit;mark:Mark};
export const defaultMark:Mark={text:'',color:'#ffffff'};
export const MAX_PNG_BYTES=256*1024;
const hex=/^#[0-9a-f]{6}$/i;
const pngUrl=/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/;

function parsePlacement(value:MarkPlacement|undefined){
 if(value===undefined)return undefined;
 const vector=(v:unknown)=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n));
 if(!value||!['TShirt','Jacket'].includes(value.slot)||!vector(value.point)||!vector(value.normal)
  ||value.point.some(n=>Math.abs(n)>4)||Math.abs(Math.hypot(...value.normal)-1)>.05
  ||!Number.isFinite(value.size)||value.size<.03||value.size>.35
  ||!Number.isFinite(value.angle)||Math.abs(value.angle)>180)throw new Error('マークの位置・角度・大きさを確認してください。');
 return structuredClone(value);
}

export function parseRecipe(value:unknown):Recipe{
 if(!value||typeof value!=='object')throw new Error('服装JSONが必要です。');
 const raw=value as Partial<Recipe>;
 if(raw.version!==1||!raw.pieces||!raw.mark)throw new Error('服装JSONの形式が違います。');
 const entries=parts.map(part=>{
  const choice=raw.pieces![part.id];
  if(!choice||typeof choice.color!=='string'||!hex.test(choice.color)||!part.variants.some(([id])=>id===choice.model)
   ||(choice.collar!==undefined&&typeof choice.collar!=='boolean')||(choice.long!==undefined&&typeof choice.long!=='boolean'))
   throw new Error(`${part.label}の設定が無効です。`);
  return [part.id,{model:choice.model,color:choice.color.toLowerCase(),collar:!!choice.collar,long:!!choice.long}];
 });
 const {text,color,png}=raw.mark;
 const placement=parsePlacement(raw.mark.placement);
 if(typeof text!=='string'||[...text].length>12||typeof color!=='string'||!hex.test(color)
  ||(png!==undefined&&(typeof png!=='string'||png.length>22+Math.ceil(MAX_PNG_BYTES/3)*4||!pngUrl.test(png))))
  throw new Error('マークは12文字以内、色は #RRGGBB、画像は256 KB以内のPNGを使ってください。');
 return {version:1,pieces:Object.fromEntries(entries) as Outfit,mark:{text,color:color.toLowerCase(),...(png?{png}:{}),...(placement?{placement}:{})}};
}
