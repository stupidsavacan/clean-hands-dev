import type {Pose} from './locomotion.ts';
// Small procedural gestures on the shared rig; walking and reactions always take priority.
export function schedulePose(p:Pose,action:string,time:number){const wave=Math.sin(time*2.1),slow=(1+Math.sin(time*.8))*.5;
 switch(action){
  case 'phone':case 'radio':p.arms[1].swing=-.7;p.arms[1].elbow=2.2;p.head=-.12;p.headYaw=.18;break;
  case 'drink':case 'tasting':p.arms[1].swing=-.35-slow*.7;p.arms[1].elbow=1.7;p.head=-slow*.12;break;
  case 'speech':case 'chat':p.arms[1].swing=-.35+wave*.2;p.arms[1].elbow=.8+slow*.5;p.headYaw=wave*.13;break;
  case 'camera':p.arms.forEach(a=>{a.swing=-1.1;a.elbow=1.6;});p.head=-.12;break;
  case 'photo':p.headYaw=.14;p.arms[1].elbow=.4;p.chestRoll=.02;break;
  case 'tour':case 'inspect':p.headYaw=Math.sin(time*.7)*.45;p.arms[1].swing=-.4;p.arms[1].elbow=.8;break;
  case 'cook':case 'clean':case 'massage_work':p.spine=.16;p.arms.forEach((a,i)=>{a.swing=-.6+Math.sin(time*3+i)*.16;a.elbow=1.1;});break;
  case 'work':p.head=.2;p.arms.forEach(a=>{a.swing=-.45;a.elbow=1.2;});break;
  case 'serve':p.arms[0].swing=-.25;p.arms[0].elbow=1.6;break;
  case 'dance':p.pelvisRoll=wave*.05;p.chestRoll=-wave*.07;p.arms.forEach((a,i)=>{a.swing=Math.sin(time*2+i*2)*.35;a.elbow=.9;});break;
  case 'massage':p.head=.18;p.arms.forEach(a=>{a.swing=.12;a.elbow=.5;});break;
 }
 return p;
}
