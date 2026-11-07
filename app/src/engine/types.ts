// The contract between the shared engine (engine/game.ts) and one map (2026-11-04).
// A new map is data in the club formats plus this object; it never copies engine code. Anything the engine learns
// (AI, security, combat, crowd, camera, HUD) reaches every map that calls runGame.
import type * as T from 'three';
import type {Director,Npc,PlayerView} from '../ai';
import type {M3System} from '../m3';
import type {M4System} from '../m4';
import type {MissionClock,ScheduleSystem} from '../schedule';
import type {MissionEvents} from '../events';
import type {Chances,ChancesData} from '../chances';
import type {NpcView} from '../npc-view';
import type {Position} from '../world';
import type {ClubCrowd as Crowd,CrowdData} from './crowd';
import type lookShape from '../data/club-look.json';
import type rulesShape from '../data/club-rules.json';
import type combatShape from '../data/club-combat.json';
import type dialogueShape from '../data/club-dialogue.json';

// What the engine asks of a map's mission script (the club's is club/chances.ts). Optional members are features a
// map may leave out.
export interface MissionScript {
 readonly chances:Pick<Chances,'track'>;
 readonly flags:Set<string>;
 notices:string[];reactionText:string;reactionUntil:number;poison:number;
 readonly locked:boolean;readonly tampering:boolean;
 // Lights-out (the club's drop); the engine calls the map's decorate().blackout when it changes.
 readonly blackout?:boolean;
 // The target ran and got away: the mission fails.
 escaped?:boolean;
 onTargetDown?:(at:Position,time:number)=>void;
 step(dt:number,p:PlayerView,keys:Set<string>,suppressed?:boolean):boolean;
 prompt(p:PlayerView):{text:string;progress:number}|null;
 seek():void;beforeAi():void;afterAi(p:PlayerView):void;
 chanceSnapshot():ReturnType<Chances['snapshot']>;
 snapshot():{kills:readonly unknown[]};
 applyBlackout?(crowd:Crowd):void;
 // Something happened near the target (VIP protection): a shot, a scream, a body the target or escort found.
 alarm?(at:Position,reason:'gunshot'|'scream'|'body'|'witness',kind?:'small'|'loud'):void;
 bodyFound?(body:Npc,witness:Npc):void;
}
export type ScriptContext={director:Director;m3:M3System;m4:M4System;clock:MissionClock;events:MissionEvents;chances:ChancesData;schedule:ScheduleSystem};

// Drawing helpers the engine lends to decorate() (the same ones it builds the map with).
export type DecorContext={
 scene:T.Scene;hemi:T.HemisphereLight;look:LookData;
 group:(floor:number)=>T.Object3D;
 box:(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent?:T.Object3D,fade?:boolean)=>T.Mesh;
 material:(color:string)=>T.MeshStandardMaterial;
};
// Map-only scenery and effects (club: mirror ball, dance-floor dots, lasers, the DJ's headphones, the blackout).
export type Decor={
 // Spun or moved every frame: kept out of the static freeze. `spin` is also kept out of section culling.
 spin?:T.Object3D;animated?:T.Object3D[];
 // Called once the static scenery is frozen (things added now keep animating).
 afterFreeze?():void;
 step?(seconds:number,frameSeconds:number,dark:boolean,missionSeconds:number):void;
 blackout?(dark:boolean,lights:{points:T.PointLight[];emitters:Map<string,T.Mesh>}):void;
 dressNpc?(view:NpcView):void;
};

export type LookData=typeof lookShape;
export type RulesData=typeof rulesShape;
export type CombatData=typeof combatShape;
export type DialogueData=typeof dialogueShape;

export type GameDef={
 // Built by scripts/build-club.ts from the map's sources (same format for every map).
 map:unknown;schedule:unknown;mission:unknown;detection:unknown;
 look:LookData;rules:RulesData;combat:CombatData;dialogue:DialogueData;
 chances:ChancesData;actions:unknown;crowd:CrowdData;
 createScript(ctx:ScriptContext):MissionScript;
 decorate?(ctx:DecorContext):Decor;
 // Words on screen that name the map.
 text:{mapTitle:string;mapLabel:string;pause:string;help:string;prepEyebrow:string;loadSmall:string;loading:string;brief:string;targetDown:string};
};
