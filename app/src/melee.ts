// 2026-11-06 (ROADMAP S03 M07/M08/M11/M12/M13/M16): what a thing in hand does as a weapon. Shared by every map
// through M3System (m3.ts) and the engine's throw (engine/game.ts).
//  blunt: F with it in hand knocks the person out with one swing, from behind or from the front (not lethal).
//  blade: X with it in hand kills with one stab, from behind or from the front.
// Thrown (G), a blunt thing knocks out the first person it hits and a blade kills; a miss lands and is heard like a coin.
export type MeleeKind='blunt'|'blade';
// swing: the arm's motion when it is not the kind's own (a sword is a blade but cuts with an overhead swing).
export type MeleeDef={kind:MeleeKind;label:string;seconds:number;throwable:boolean;swing?:MeleeKind};
export const MELEE:Record<string,MeleeDef>={
 hammer:{kind:'blunt',label:'ハンマー',seconds:.7,throwable:true},
 crowbar:{kind:'blunt',label:'バール',seconds:.8,throwable:true},
 frying_pan:{kind:'blunt',label:'フライパン',seconds:.7,throwable:true},
 brick:{kind:'blunt',label:'レンガ',seconds:.7,throwable:true},
 wrench:{kind:'blunt',label:'スパナ',seconds:.7,throwable:true},
 bottle:{kind:'blunt',label:'ワインボトル',seconds:.6,throwable:true},
 kitchen_knife:{kind:'blade',label:'包丁',seconds:.6,throwable:true},
 // 2026-11-06 (M09/M10, M14/M15; 194-item table row 189: a lethal melee and thrown weapon): a sword cuts from the front
 // (overhead, swing) and stabs from behind (its own blade motion); it can be thrown. A briefcase is swung or thrown.
 katana:{kind:'blade',label:'刀',seconds:1.0,throwable:true,swing:'blunt'},
 briefcase:{kind:'blunt',label:'ブリーフケース',seconds:.7,throwable:true},
};
// Things carried on the back when not in hand (full spec rows 13/14/32/64/120): only the sword, up to two at once.
// Not opened to other items.
export const BACK_ITEMS=['katana'],BACK_MAX=2;
// Too big for a pocket (HITMAN: nearly anything goes in the pockets except the large things): carried in hand or on the back.
export const LARGE_ITEMS=['briefcase','katana','mop','tray'];
export const meleeOf=(item:string|undefined):MeleeDef|undefined=>item?MELEE[item]:undefined;
// How far a swing reaches and how far a thing can be thrown at someone.
export const MELEE_REACH=1.4,THROW_RANGE=12;
// Bare hands (2026-11-06, S03 M01/M02/M04/M05):
//  M01 a punch from the front knocks out someone unarmed (hold F, PUNCH_SECONDS).
//  M02 a guard faced unarmed is a fight: press the key shown (BRAWL_KEYS in turn) within BRAWL_WINDOW each; a wrong
//      key, a late press or a step away and the guard throws the agent off and fights.
//  M04 X while choking from behind turns the take-down lethal.
//  M05 X held by someone out cold finishes them (FINISH_SECONDS).
export const PUNCH_SECONDS=.9,FINISH_SECONDS=1.2,BRAWL_WINDOW=1.1,BRAWL_KEYS=['KeyF','KeyX','KeyF'];
export const keyLabel=(code:string)=>code.replace(/^Key/,'');
