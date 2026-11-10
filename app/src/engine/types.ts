// The contract between the shared engine (engine/game.ts) and one map (2026-11-04).
// A new map is data in the club formats plus this object; it never copies engine code. Anything the engine learns
// (AI, security, combat, crowd, camera, HUD) reaches every map that calls runGame.
import type * as T from 'three';
import type {Director,Npc,PlayerView,Rules} from '../ai';
import type {M3System,M3Rules} from '../m3';
import type {M4System,M4Rules} from '../m4';
import type {MissionClock,ScheduleSystem,ScheduleData,ScheduleRules,SchedulePlace} from '../schedule';
import type {MissionEvents} from '../events';
import type {Chances,ChancesData} from '../chances';
import type {NpcView} from '../npc-view';
import type {Position,Rect} from '../world';
import type {CrowdData} from './crowd';
import type {CombatRules} from '../combat';
import type {DialogueData,DialogueRules} from '../dialogue';
import type {Traversal} from '../party/traversal';

// What the engine asks of a map's mission script (the club's is club/chances.ts). Optional members are features a
// map may leave out.
export interface MissionScript {
 readonly chances:Pick<Chances,'track'>;
 readonly flags:Set<string>;
 notices:string[];reactionText:string;reactionUntil:number;
 // Doses of the mission's lethal poison left (a map without one leaves it out).
 poison?:number;
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
 // Zones dark now and how far sight reaches in each (0..1); engine/lighting.ts applies it to NPCs and the crowd.
 darkZones?():Record<string,number>;
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

type Lighting=Position&{color:string;intensity:number;distance:number};
type DecorBlock={x:number;z:number;w:number;d:number;h:number;color:string};
export type LookData={
 background:string;ambientSky:string;ambientGround:string;ambientIntensity:number;
 sunColor:string;sunIntensity:number;exposure:number;street:string;rail:string;
 floors:Record<string,(string|number)[]>;walls:string[][];stairs:Record<string,string>;props:string[][];
 linings:DecorBlock[];ceilings:Array<Rect&{y:number;color:string;emissive:string}>;
 points:Lighting[];emissive:Array<DecorBlock&{id:string;y:number}>;
};
export type RulesData=Omit<Rules,'m4'>&{
 m3:M3Rules;m4:M4Rules&Rules['m4'];schedule:ScheduleRules;dialogue:DialogueRules;
 render:{pixelRatioCap:number;npcShadowCullRadius:number;npcOcclusionMargin:number;hudFps:number};
 controls:{restartHoldSeconds:number};
};
export type CombatData=Omit<CombatRules,'placed'>&{placed:unknown[];weaponRecoveryScanSeconds:number};
export type EngineSchedule=ScheduleSystem&{step?:(dt:number)=>void};
type ScheduleContext={data:ScheduleData;places:Record<string,SchedulePlace>;director:Director;clock:MissionClock;events:MissionEvents;traversals:Traversal[]};

export type TrainingDef={
 player:{x:number;z:number;heading:number};
 // Everyone else is put out of the way; these stand (or lie, `down`) here. `zone` gives a guard that post.
 actors:{id:string;x:number;z:number;heading:number;down?:boolean;zone?:string}[];
 clothes?:{id:string;disguise:string;x:number;z:number}[];
 text:string;hint?:string;
 objectives?:{text:string;done:'changes'|'frisks'|'upstairs'|'downed'|'hidden'}[];
 // The "make them look" button: who turns, which way, and what it says.
 discover?:{id:string;heading:number;text:string};
};
export type GameDef={
 // Built by scripts/build-club.ts from the map's sources (same format for every map).
 map:unknown;schedule:ScheduleData;mission:unknown;detection:unknown;
 look:LookData;rules:RulesData;combat:CombatData;dialogue:DialogueData;
 chances:ChancesData;actions:unknown;crowd:CrowdData;
 createSchedule?:(ctx:ScheduleContext)=>EngineSchedule;
 // Only what the map has: missing members get stand-ins (engine/script.ts).
 createScript(ctx:ScriptContext):Partial<MissionScript>;
 // Blockers whose visuals are supplied by the map's decoration. Physics still uses the map.
 decoratedBlockers?:ReadonlySet<string>;
 decorate?(ctx:DecorContext):Decor;
 // Words on screen that name the map.
 text:{mapTitle:string;mapLabel:string;pause:string;help:string;prepEyebrow:string;loadSmall:string;loading:string;brief:string;targetDown:string;
  // The standing hint at the bottom of the HUD while nothing more urgent is shown.
  hint?:string;
  // The place word put into shared sentences for {場所} (failure screen, body notice). Without it: ホテル.
  venue?:string};
 // Practice set-ups behind the debug panel's buttons (none: the buttons are hidden).
 training?:{m3?:TrainingDef;m4?:TrainingDef};
};
