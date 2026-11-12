// Run against the real window.__outfitLab in a browser (the report records its result).
// This function uses the public facade exclusively; it does not edit the DOM or server files.
export async function checkOutfitLab(api) {
 const expect=(ok,message)=>{if(!ok)throw new Error(message);};
 await api.ready;
 const ids=api.getInventory().map(e=>e.id),opened=[];
 expect(ids.length===38,'expected all 38 recipes');
 for(const id of ids){await api.loadRecipe(id);expect(api.getRecipe().id===id,'loaded wrong recipe: '+id);expect(!api.status().dirty,'existing recipe became dirty: '+id);opened.push(id);}
 await api.loadRecipe('guest_dress');
 let incompatible=false;try{api.selectPart('outer','outer.layer.v1',{model:'Jacket'});}catch{incompatible=true;}
 expect(incompatible,'incompatible outer layer was accepted');
 await api.setBody('cast.male.v1');
 const saved=api.getRecipe();api.setRecipe(saved);
 api.selectPart('top','legacy.top.v1',{model:'Shirt'});
 api.setPart('Jacket',{model:'Blazer',color:'#33383d'});
 api.setMark({text:'API',color:'#2b2e35'});
 const built=await api.saveAndBuild('操作APIの検証キャラ');
 expect(built.state==='complete','build did not finish');
 expect(!api.status().dirty,'finished model remained dirty');
 const bytes=await api.exportGLB();expect(bytes.byteLength>1000,'GLB is empty');
 api.setMotion('gesture-dance',1.2);
 return {opened,incompatibleRejected:incompatible,recipeLoad:true,partSelection:true,mark:true,savedAndBuilt:true,newId:built.id,sha256:built.sha256,glbBytes:bytes.byteLength};
}
