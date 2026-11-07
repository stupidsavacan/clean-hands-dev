import {Group} from 'three';
// Scene.updateMatrixWorld otherwise visits every bone of an invisible actor.
// NPC simulation uses its own positions; a visible actor catches up before rendering.
export class NpcGroup extends Group{
 override updateMatrixWorld(force?:boolean){if(this.visible)super.updateMatrixWorld(force);}
}
