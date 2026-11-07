import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraMovement,cameraRight,lookDirection} from '../src/camera.ts';
const near=(a:number,b:number)=>Math.abs(a-b)<1e-9;
test('W walks straight along the view and A/D strafe at right angles',()=>{for(const yaw of [0,Math.PI/2,Math.PI,-2.2]){const f=lookDirection(yaw,0),w=cameraMovement(0,1,yaw),d=cameraMovement(1,0,yaw),a=cameraMovement(-1,0,yaw);assert.ok(near(w.x,f.x)&&near(w.z,f.z));assert.ok(near(w.x*d.x+w.z*d.z,0));assert.ok(near(a.x,-d.x)&&near(a.z,-d.z));}});
test('right is screen right: yaw 0 looks along +Z, so right is -X',()=>{const r=cameraRight(0);assert.ok(near(r.x,-1)&&near(r.z,0));});
test('diagonals keep unit speed and pitch does not change the ground direction',()=>{for(const [x,y] of [[1,1],[-1,1],[1,-1]]){const v=cameraMovement(x,y,.7);assert.ok(near(Math.hypot(v.x,v.z),1));}const d=lookDirection(.7,.9);assert.ok(d.y<0);assert.ok(near(Math.atan2(d.x,d.z),.7));});
