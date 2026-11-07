// Every key and touch button in one table (2026-11-07). This is the spec for controls:
// - Adding a key: add a row here first, then read it in the owner's file. tests/controls.test.ts fails when a file reads a
//   key that has no row, when two rows share a key (unless both say shared), or when a row's owner no longer reads it.
// - Touch: rows with `touch` become the iPad buttons (touch.ts builds its rings and tool chips from them, in this order).
// - docs/controls.md is generated from this table (node scripts/spec-docs.ts); the test checks it is current.
// Keep this file free of DOM and of TS-only syntax (it is loaded by node's type stripping in the tests).
export type Owner='game'|'m3'|'m4'|'m53'|'m57'|'move';
// at: place in its group when it differs from table order; code: what the button sends when it is not the key itself.
export type TouchSpec={group:'action'|'toggle'|'tool'|'weapon';label:string;sub:string;kind:'hold'|'tap';at?:number;code?:string};
export type Control={
 id:string;
 /** KeyboardEvent.code, or a touch-only id (run, more, drop, reload) that the game handles as an action. */
 code:string;
 label:string;
 /** The file that reads the key for this action ('move': every system reads it to know the agent is moving). */
 owner:Owner;
 /** E and the movement keys are read by several systems on purpose; the prompt on screen says which use applies. */
 shared?:boolean;
 touch?:TouchSpec;
 note?:string};

export const CONTROLS:Control[]=[
 // Movement
 {id:'move-up',code:'KeyW',label:'前へ',owner:'move',shared:true},{id:'move-left',code:'KeyA',label:'左へ',owner:'move',shared:true},
 {id:'move-down',code:'KeyS',label:'後ろへ',owner:'move',shared:true},{id:'move-right',code:'KeyD',label:'右へ',owner:'move',shared:true},
 {id:'arrow-up',code:'ArrowUp',label:'前へ',owner:'move',shared:true},{id:'arrow-left',code:'ArrowLeft',label:'左へ',owner:'move',shared:true},
 {id:'arrow-down',code:'ArrowDown',label:'後ろへ',owner:'move',shared:true},{id:'arrow-right',code:'ArrowRight',label:'右へ',owner:'move',shared:true},
 {id:'run',code:'ShiftLeft',label:'走る',owner:'game',touch:{group:'toggle',label:'走る',sub:'RUN',kind:'tap',code:'run'},note:'ShiftRight も同じ'},
 {id:'run-right',code:'ShiftRight',label:'走る',owner:'game'},
 {id:'crouch',code:'KeyC',label:'しゃがむ',owner:'game',touch:{group:'toggle',label:'しゃがむ',sub:'CROUCH',kind:'tap'}},
 {id:'tools',code:'more',label:'道具の列を開く（タッチだけ）',owner:'game',touch:{group:'toggle',label:'道具',sub:'TOOLS',kind:'tap'}},
 // Actions (the right-thumb ring)
 {id:'use',code:'KeyE',label:'使う・拾う・運ぶ・はしご・隠れる',owner:'game',shared:true,touch:{group:'tool',label:'使う・拾う',sub:'USE / PICK UP',kind:'hold',at:5.5},note:'タッチの大きな丸ボタンも E（銃を構えている時は撃つ）'},
 {id:'subdue',code:'KeyF',label:'気絶させる・格闘・鈍器で殴る・投降する（ふり、M06）',owner:'m3',touch:{group:'action',label:'気絶・格闘',sub:'SUBDUE · FIGHT',kind:'hold'}},
 {id:'lethal',code:'KeyX',label:'排除・刺す・とどめ・格闘の2打目',owner:'m3',touch:{group:'action',label:'排除',sub:'LETHAL',kind:'hold'}},
 {id:'disguise',code:'KeyT',label:'着替える',owner:'m4',touch:{group:'action',label:'着替え',sub:'DISGUISE',kind:'hold'}},
 // Tools (the chip row)
 {id:'throw',code:'KeyG',label:'コイン・持ち物を投げる',owner:'game',touch:{group:'tool',label:'投げる',sub:'COIN / ITEM',kind:'tap'}},
 {id:'wire',code:'KeyH',label:'ワイヤーを置く・取る',owner:'m4',touch:{group:'tool',label:'ワイヤー置く',sub:'PLACE / TAKE',kind:'hold'}},
 {id:'view',code:'KeyV',label:'視点を切り替える',owner:'game',touch:{group:'tool',label:'視点',sub:'VIEW',kind:'tap'}},
 {id:'zoom',code:'KeyZ',label:'ズーム',owner:'game',touch:{group:'tool',label:'ズーム',sub:'ZOOM',kind:'tap'}},
 {id:'talk',code:'KeyJ',label:'話す・誘う',owner:'m53',touch:{group:'tool',label:'話す・誘う',sub:'TALK / LURE',kind:'hold'}},
 {id:'push',code:'KeyP',label:'突き落とす',owner:'m53',touch:{group:'tool',label:'突き落とす',sub:'HOLD · LETHAL',kind:'hold'}},
 {id:'put-down',code:'KeyU',label:'持ち物を置く',owner:'game',touch:{group:'tool',label:'持ち物を置く',sub:'PUT DOWN',kind:'tap'}},
 {id:'frisk',code:'KeyB',label:'検査を受ける',owner:'m4',touch:{group:'tool',label:'検査',sub:'FRISK',kind:'hold'}},
 {id:'sword-back',code:'KeyK',label:'刀を背中に背負う・抜く',owner:'game',touch:{group:'tool',label:'背中の刀',sub:'SWORD · BACK',kind:'tap'}},
 {id:'case',code:'KeyI',label:'銃をブリーフケースに出し入れする',owner:'game',touch:{group:'tool',label:'ケース出し入れ',sub:'CASE',kind:'tap'}},
 {id:'drop-gun',code:'drop',label:'銃を捨てる（タッチだけ。キーは Q 長押し）',owner:'game',touch:{group:'tool',label:'銃を捨てる',sub:'HOLD · DROP',kind:'hold'}},
 // Weapon
 {id:'gun',code:'KeyQ',label:'銃を構える・しまう（長押しで捨てる）',owner:'game',touch:{group:'weapon',label:'銃',sub:'DRAW / HOLSTER',kind:'tap'}},
 {id:'reload',code:'KeyR',label:'装填（長押しでやり直し）',owner:'game',touch:{group:'weapon',label:'装填',sub:'RELOAD',kind:'tap',code:'reload'},note:'タッチの装填ボタンは reload'},
 {id:'fire',code:'Space',label:'撃つ',owner:'game'},
 // Screens
 {id:'explore',code:'KeyN',label:'探索表示（標的・チャンス）',owner:'game'},
 {id:'map',code:'Tab',label:'地図',owner:'game'},
 {id:'pause',code:'Escape',label:'一時停止',owner:'game'},
 {id:'confirm',code:'Enter',label:'決める（画面）',owner:'game'},
];

/** The touch buttons of one group, in table order: [code,label,sub,kind]. */
export function touchControls(group:TouchSpec['group']):[string,string,string,'hold'|'tap'][]{
 const rows=CONTROLS.filter(c=>c.touch?.group===group).map((c,i)=>({c,at:c.touch!.at??i+1})).sort((a,b)=>a.at-b.at);
 return rows.map(({c})=>[c.touch!.code??c.code,c.touch!.label,c.touch!.sub,c.touch!.kind]);}

/** Files that read keys, and which owner they are. Used by the test to scan the sources. */
export const OWNER_FILES:Record<Exclude<Owner,'move'>,string>={game:'engine/game.ts',m3:'m3.ts',m4:'m4.ts',m53:'m53.ts',m57:'m57.ts'};
