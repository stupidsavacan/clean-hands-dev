import * as T from 'three';
import type { Rig } from './rig.ts';
import { applyMotion, reach } from './motion-runtime.ts';
import { POUCH, UPPER, type CombatFrame, type HandGoal, type WeaponClass } from './combat-motion.ts';

/** A loaded weapon GLB (assets/m55-combat) with its anchors measured once in the weapon's own space. */
export type Weapon={object:T.Object3D;cls:WeaponClass;anchors:Record<string,T.Vector3>};
export function prepareWeapon(scene:T.Object3D,cls:WeaponClass):Weapon{
 scene.updateMatrixWorld(true);const inv=scene.matrixWorld.clone().invert(),anchors:Record<string,T.Vector3>={};
 scene.traverse(o=>{if(/^(GRIP_R|GRIP_L|MUZZLE|STOCK)$/.test(o.name))anchors[o.name]=o.getWorldPosition(new T.Vector3()).applyMatrix4(inv);});
 // Points the support hand visits while reloading, in weapon space (+Z muzzle, +Y up).
 anchors.MAG=cls==='pistol'?new T.Vector3(0,-.075,-.02):new T.Vector3(0,-.07,.09);
 anchors.SLIDE=cls==='pistol'?new T.Vector3(.02,.06,-.04):new T.Vector3(.04,.06,.02);
 return {object:scene,cls,anchors};
}
// Wrist positions relative to the point each hand holds, in weapon space: the palm wraps the grip, so the wrist sits
// below and behind it (right) or under the fore-end (left).
const WRIST:Record<HandGoal,T.Vector3>={GRIP_R:new T.Vector3(.005,-.035,-.045),GRIP_L:new T.Vector3(-.01,-.045,-.03),MAG:new T.Vector3(0,-.05,0),SLIDE:new T.Vector3(.02,.0,-.04),POUCH:new T.Vector3()};
const q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3();

/** Rotate only the upper-body channels, on top of whatever the legs already have (Locomotion through Rig.apply). */
export function layerUpper(rig:Rig,pose:CombatFrame['pose']){for(const n of UPPER){const r=pose.bones[n];if(r)rig.rotate(n,r[0],r[1],r[2]);}}

/** Poses the body, places the weapon in the actor's space and closes both hands on it.
 * Full-body frames reset the rig; upper-only frames expect the legs to be posed already. Returns the worst hand error (m). */
export function poseCombat(rig:Rig,actor:T.Object3D,model:T.Object3D,frame:CombatFrame,weapon:Weapon|null){
 if(frame.upperOnly){layerUpper(rig,frame.pose);model.updateMatrixWorld(true);}else applyMotion(rig,model,frame.pose);
 actor.updateMatrixWorld(true);
 if(!weapon||!frame.weapon)return 0;
 const w=weapon.object,hold=frame.weapon;
 w.quaternion.copy(actor.getWorldQuaternion(q)).multiply(new T.Quaternion().setFromEuler(e.set(...hold.rot,'XYZ')));
 const target=actor.localToWorld(new T.Vector3(...hold.pos)),anchor=weapon.anchors[hold.anchor].clone().applyQuaternion(w.quaternion);
 w.position.copy(target.sub(anchor));if(w.parent){w.parent.updateMatrixWorld(true);w.position.applyMatrix4(w.parent.matrixWorld.clone().invert());w.quaternion.premultiply(w.parent.getWorldQuaternion(new T.Quaternion()).invert());}
 w.updateMatrixWorld(true);
 let error=0;
 for(const [side,goal] of [['r',frame.right],['l',frame.left]] as const){if(goal.weight<=0)continue;
  const point=goal.to==='POUCH'?actor.localToWorld(new T.Vector3(...POUCH)):w.localToWorld(weapon.anchors[goal.to].clone().add(WRIST[goal.to]));
  error=Math.max(error,reach(rig,side,point,goal.weight)*(goal.weight>=1?1:0));}
 return error;
}
/** World position of the muzzle (for the flash and the shot ray). */
export function muzzle(weapon:Weapon){return weapon.object.localToWorld(v.copy(weapon.anchors.MUZZLE??new T.Vector3()));}
