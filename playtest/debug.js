// CLEAN HANDS playtest debug panel (F9). Loaded by playtest/server.py after playtest.js, on top of the unchanged game.
// Everything goes through window.__cleanHands; each use is put on the mission's event bus as `debug.cheat`,
// so the recorder keeps it with the run.
(() => {
 const C = () => window.__cleanHands;
 const safe = f => { try { return f(); } catch { return undefined; } };
 const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
 const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
 const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
 // The hotel at /, the party prototype at /party. The party has its own chance acts (party-actions.json), flags and
 // traversals; the hotel's A1, M5.7 acts and traps exist only at /.
 const MAP = location.pathname.startsWith('/club') ? 'club' : location.pathname.startsWith('/party') ? 'party' : 'hotel', CLUB = MAP === 'club', PARTY = MAP !== 'hotel';
 const FLOOR_Y = {'-1': -3.5, 0: 0, 1: 3.5, 2: 7}, FLOOR = {'-1': 'B1', 0: '1F', 1: '2F', 2: PARTY ? '屋根裏' : 'RF'};
 const TARGETS = CLUB ? ['investor'] : PARTY ? ['host'] : ['wine_merchant', 'lawyer', 'investor'];
 let partyActs = [];
 if (PARTY) fetch('/api/actions?map=' + MAP).then(r => r.json()).then(j => { partyActs = j.acts ?? []; }).catch(() => {});
 // Things to put in the hand: every item in this map's rules except guns and the ones that are not held (2026-11-08: read
 // from the game's own table, so new items such as the hammer, the katana or the cases appear without editing this file).
 const NOT_HELD = ['wire', 'poison_lethal', 'keycard', 'cellar_key', 'coin'];
 const handItems = (items, weapons) => Object.keys(items).filter(id => !NOT_HELD.includes(id) && !(weapons && weapons[id]));
 const STATE = {patrol: '通常', curious: '気になる', investigate: '調べに来る', distracted: '音を見に', verify: '顔を確認', alert: '警戒', search: '捜索', report: '通報', combat: '戦闘', flee: '逃走'};
 const LIFE = {active: '', unconscious: '気絶', dead: '死亡'};
 // Chance steps done beside a person: whom to go to (m57.ts BESIDE).
 const BESIDE = {photo_pose: 'wine_merchant', chef_emetic: 'head_chef', serve_dish: 'lawyer', escort_start: 'lawyer', greet_investor: 'investor', massage_wire: 'investor'};
 const A1_ACTS = [['greet', '給仕長に挨拶（セラーの鍵）'], ['poison', '樽に致死毒を仕込む'], ['serve', '毒入りの一杯を出す'], ['invite', 'セラー奥へ誘う']];
 const TRAPS = ['pool_light', 'yacht_crane', 'chandelier', 'gas_leak', 'balcony_rail', 'boat_fuel', 'fireworks'];
 const TRAP_LABEL = {pool_light: 'プールの照明', yacht_crane: 'クレーンの荷', chandelier: 'シャンデリア', gas_leak: '厨房のガス', balcony_rail: 'バルコニーの手すり', boat_fuel: '避難ボートの燃料', fireworks: '花火'};

 // ---------------------------------------------------------------- switches (kept on every frame while on)
 const SW = [
  ['ghost', '誰にも見えない（人）', '人の視界に入っても見えない。疑惑・顔の確認・捕まるのも起きない'],
  ['noCams', '監視カメラに映らない', ''],
  ['noFace', '顔見知りに見抜かれない', '白いゲージが溜まらない'],
  ['noBlown', '服がバレない', 'バレた服を毎フレーム消す'],
  ['god', '体力が減らない', ''],
  ['ammo', '弾が減らない', ''],
  ['poison', '致死毒が減らない', '常に1つ以上'],
  ['pass', '検問を素通り', '全部の検問を検査済みにする'],
  ['alert0', '警戒度を0に固定', ''],
  ['freeze', '人を止める', 'その場から動かない（見る・気づくは続く）'],
  ['noBodies', '死体・気絶が見つからない', ''],
 ];
 const on = Object.fromEntries(SW.map(([k]) => [k, false]));
 try { Object.assign(on, JSON.parse(localStorage.getItem('clean-hands.debug.switches') || '{}')); } catch {}
 const keep = () => { try { localStorage.setItem('clean-hands.debug.switches', JSON.stringify(on)); } catch {} };
 // The recorder (playtest.js) does not record a mission that starts with any of these on.
 window.__ptDebug = {active: () => SW.some(([k]) => on[k])};

 // NPCs share one class for the whole page; the systems below are made again for every mission.
 let protoDone = false;
 const patched = new WeakSet();
 function patch(c) {
  const d = c.director(), npc = d.npcs[0];
  if (!protoDone && npc) {
   protoDone = true; const P = Object.getPrototypeOf(npc), perceive = P.perceive, watchFace = P.watchFace, move = P.move;
   P.perceive = function (...args) {
    if (!on.ghost) return perceive.apply(this, args);
    const [p,,,inspect] = args, distance = flat(this.pos, p);
    if (inspect) Object.assign(inspect, {reason:'debug_hidden', visibility:0, distance, blockedBy:[]});
    else { this.visibility = 0; this.distance = distance; }
   };
   P.watchFace = function (...a) { if (!on.noFace) return watchFace.apply(this, a); this.face = 0; if (this.state === 'verify') this.state = 'patrol'; return []; };
   P.move = function (...a) { if (!on.freeze) return move.apply(this, a); this.speed = 0; };
  }
  const det = c.detectionSystem(), m3 = c.field().m3;
  if (!patched.has(det)) { patched.add(det); const sees = det.sees; det.sees = function (...a) { return on.noCams ? false : sees.apply(this, a); }; }
  if (!patched.has(m3)) { patched.add(m3); const discover = m3.discover; m3.discover = function (...a) { if (!on.noBodies) return discover.apply(this, a); }; }
 }
 function hold(c) {
  const d = c.director(), m53 = c.field(), m4 = m53.m4, cb = c.combatSystem();
  if (on.god) cb.hp = cb.rules.player.health;
  if (on.ammo) for (const g of cb.guns) g.mag = cb.def(g.id).mag;
  if (on.poison && m53.poison < 1) m53.poison = 1;
  if (on.noBlown && d.compromised.size) d.compromised.clear();
  if (on.alert0) c.hotel().level = 0;
  if (on.pass) for (const cp of m4.checkpoints) m4.passes.set(cp.id, {until: m4.elapsed + 60, disguise: m4.disguise, wire: m4.hasWire});
 }

 // ---------------------------------------------------------------- helpers
 function log(id, value) {
  const c = C(), bus = safe(() => c.eventBus());
  safe(() => bus.emit({type: 'debug.cheat', time: c.clock().elapsed, id, value}));
  toast = `${id}${value === undefined ? '' : '：' + value}`;
 }
 const view = c => { const st = c.state(), m4 = c.field().m4; return {...st.position, floor: st.currentFloor, speed: 0, running: false, crouched: false, tampering: false, disguise: m4.disguise}; };
 function go(c, x, y, z) {
  // The nearest free floor within 3 m (a room's centre is often a table).
  const w = c.director().world;
  for (let r = 0; r <= 3; r += .4) for (let a = 0; a < Math.PI * 2; a += r ? .4 / r : 7) {
   const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
   if (!w.blocked(px, y, pz, 1.8)) { c.teleport(px, pz, y); return true; }
  }
  toast = 'そこは壁の中です'; return false;
 }
 const npcById = (c, id) => c.director().npcs.find(n => n.id === id);
 function goNpc(c, n) {
  // Stand a step in front of them.
  for (const r of [1.2, 1.6, 2.2]) for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
   const h = n.heading + a, x = n.pos.x + Math.sin(h) * r, z = n.pos.z + Math.cos(h) * r;
   if (!c.director().world.blocked(x, n.pos.y, z, 1.8)) { c.teleport(x, z, n.pos.y); c.view(Math.atan2(n.pos.x - x, n.pos.z - z), .2); return; }
  }
  c.teleport(n.pos.x, n.pos.z, n.pos.y);
 }
 function calm(n) { n.suspicion = 0; n.face = 0; n.lastSeen = null; n.evidenceGoal = null; n.witness = null; if (n.active && !['combat', 'flee'].includes(n.state)) { n.state = 'patrol'; n.goal = null; } }
 function down(c, n, kind) {
  // The same fields as a knock-out or kill by hand (m3.ts, kills.ts markDead); M5.3 then publishes npc.killed.
  n.life = kind; n.deathKind = 'murder'; n.deathMethod = 'debug'; n.bodyMode = 'ground'; n.busy = false; n.speed = 0; n.suspicion = 0; n.visibility = 0;
  n.fall = 0; n.evidenceGoal = null; n.goal = null; n.state = 'patrol'; n.scheduleTarget = null; n.scheduleAction = '';
 }

 // ---------------------------------------------------------------- panel
 const css = `
 #dbg{position:fixed;top:8px;right:8px;bottom:44px;width:min(440px,46vw);z-index:10001;display:none;flex-direction:column;background:rgba(14,17,19,.93);border:1px solid #3a4146;border-top:3px solid #7dd3fc;border-radius:10px;color:#f3efe6;font:13px "Yu Gothic UI","Hiragino Sans",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)}
 #dbg .top{display:flex;justify-content:space-between;align-items:center;padding:8px 10px 4px}#dbg .top b{color:#7dd3fc;letter-spacing:.06em}
 #dbg .info{padding:0 10px 6px;color:#b9b3a4;font-size:12px;line-height:1.5}
 #dbg .tabs{display:flex;gap:2px;padding:0 8px;border-bottom:1px solid #3a4146}
 #dbg .tabs button{background:none;border:0;border-bottom:2px solid transparent;color:#b9b3a4;padding:6px 9px;font:inherit;cursor:pointer}#dbg .tabs button.on{color:#f3efe6;border-color:#7dd3fc}
 #dbg .body{flex:1;overflow:auto;padding:8px 10px 10px}
 #dbg h3{font-size:12px;color:#7dd3fc;margin:12px 0 5px;font-weight:600}#dbg h3:first-child{margin-top:2px}
 #dbg button.b{font:inherit;font-size:12px;background:#22282c;color:#f3efe6;border:1px solid #3a4146;border-radius:5px;padding:2px 8px;cursor:pointer;margin:0 3px 3px 0}
 #dbg button.b:hover{border-color:#7dd3fc}#dbg button.b.on{background:#7dd3fc;color:#0e1113;border-color:#7dd3fc}#dbg button.b.warn{border-color:#e2362b}
 #dbg .sw{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #22282c;cursor:pointer}#dbg .sw small{color:#8d887c;display:block}
 #dbg .knob{flex:none;width:34px;height:18px;border-radius:9px;background:#3a4146;position:relative}#dbg .knob::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#b9b3a4;transition:left .12s}
 #dbg .sw.on .knob{background:#7dd3fc}#dbg .sw.on .knob::after{left:18px;background:#0e1113}
 #dbg .row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:3px 0;border-bottom:1px solid #22282c}#dbg .row .l{flex:1;min-width:150px}#dbg .row small{color:#8d887c}
 #dbg .pill{display:inline-block;border-radius:999px;padding:0 7px;font-size:11px;background:#3a4146}#dbg .pill.active{background:#ffd36b;color:#15171b}#dbg .pill.complete{background:#4fc1b2;color:#0e1113}#dbg .pill.lost{background:#e2362b}
 #dbg input,#dbg select{font:inherit;background:#0f1214;color:#f3efe6;border:1px solid #3a4146;border-radius:5px;padding:2px 6px}
 #dbg input[type=range]{width:180px;padding:0}#dbg canvas{width:100%;background:#0b0d0e;border:1px solid #3a4146;border-radius:6px;cursor:crosshair}
 #dbg .foot{padding:5px 10px;border-top:1px solid #3a4146;color:#ffd36b;font-size:12px;min-height:18px}
 #dbg-strip{position:fixed;top:8px;right:8px;z-index:9997;display:none;background:rgba(14,17,19,.72);border:1px solid #7dd3fc;border-radius:6px;color:#7dd3fc;font:12px "Yu Gothic UI",system-ui,sans-serif;padding:3px 9px;pointer-events:none;max-width:44vw}`;
 document.head.append(Object.assign(document.createElement('style'), {textContent: css}));
 const box = document.createElement('div'); box.id = 'dbg';
 const strip = document.createElement('div'); strip.id = 'dbg-strip';
 const TABS = [['self', '自分'], ['switch', 'オンオフ'], ['events', 'イベント'], ['people', '人'], ['move', '移動・時間']];
 let open = false, tab = 'self', toast = '', mapFloor = null, filter = '', wasPaused = false;
 try { tab = localStorage.getItem('clean-hands.debug.tab') || tab; } catch {}

 function ready(c) { const st = safe(() => c.state()), m = safe(() => c.mission()); return !!st?.modelReady && !st.creatorOpen && !!m && !m.prepOpen; }
 function info(c) {
  const st = c.state(), cb = c.combat(), m53 = c.field(), det = c.detectionSystem(), hot = c.director().hottest();
  const p = st.position;
  return `${mmss(st.clock.time)}（${st.clock.rate ?? 1}倍）　${FLOOR[st.currentFloor] ?? st.currentFloor} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})<br>
   服：${esc(m53.m4.label)}${m53.m4.compromised ? '（バレ）' : ''}　体力 ${cb.hp}　警戒度 ${st.alert}　手：${esc(det.data.items[det.held]?.label ?? (cb.hand ? cb.weapons[cb.hand]?.label : '') ?? 'なし') || 'なし'}　疑惑 ${hot ? Math.round(hot.suspicion) + '（' + esc(hot.label) + '）' : 0}`;
 }

 function tabSelf(c) {
  const d = c.director(), m53 = c.field(), m4 = m53.m4, m57 = c.m57System(), cb = c.combatSystem(), det = c.detectionSystem();
  const dis = d.rules.disguises, items = det.data.items, max = cb.rules.player.health;
  const guns = Object.entries(cb.weapons).filter(([, w]) => typeof w === 'object' && !w.npcOnly);
  return `<h3>体力</h3><div class="row"><input type="range" min="1" max="${max}" value="${Math.max(1, Math.round(cb.hp))}" data-hp><b>${Math.round(cb.hp)} / ${max}</b><button class="b" data-a="heal">全回復</button></div>
  <h3>服装</h3>${Object.entries(dis).map(([id, v]) => `<button class="b${m4.disguise === id ? ' on' : ''}${d.compromised.has(id) ? ' warn' : ''}" data-a="disguise" data-id="${id}" title="${d.compromised.has(id) ? 'バレている' : ''}">${esc(v.label)}</button>`).join('')}
  <div class="row"><span class="l">バレた服：${[...d.compromised].map(id => esc(dis[id]?.label ?? id)).join('、') || 'なし'}</span><button class="b" data-a="unblow">バレを消す</button></div>
  <h3>持ち物</h3>
  <div class="row"><span class="l">ワイヤー</span><button class="b${m4.hasWire ? ' on' : ''}" data-a="wire">${m4.hasWire ? '持っている' : 'なし'}</button></div>
  <div class="row"><span class="l">致死毒</span><button class="b" data-a="poison" data-v="-1">−</button><b>${m53.poison}</b><button class="b" data-a="poison" data-v="1">＋</button></div>
  ${PARTY ? '' : `<div class="row"><span class="l">セラーの鍵</span><button class="b${m53.cellarKey ? ' on' : ''}" data-a="cellarKey">${m53.cellarKey ? '持っている' : 'なし'}</button></div>
  <div class="row"><span class="l">ペントハウスのカードキー</span><button class="b${m57.keycard ? ' on' : ''}" data-a="keycard">${m57.keycard ? '持っている' : 'なし'}</button></div>`}
  <div class="row"><span class="l">コイン</span><small>${c.state().coins} 枚（ゲームの外からは変えられません）</small></div>
  <h3>手に持つ物</h3><button class="b${!det.held ? ' on' : ''}" data-a="held" data-id="">なし</button>${handItems(items, cb.weapons).map(id => `<button class="b${det.held === id ? ' on' : ''}" data-a="held" data-id="${id}">${esc(items[id].label)}</button>`).join('')}
  <h3>銃</h3>${guns.map(([id, w]) => { const g = cb.guns.find(g => g.id === id); return `<div class="row"><span class="l">${esc(w.label)}${g ? `<small>　${g.mag}/${w.mag}・予備 ${g.reserve}</small>` : ''}</span>${g ? `<button class="b" data-a="ammo" data-id="${id}">弾を満タン</button><button class="b" data-a="ungun" data-id="${id}">外す</button>` : `<button class="b" data-a="gun" data-id="${id}">持つ</button>`}</div>`; }).join('')}
  <small>手に構えるのはゲームのキーで（銃の持ち替え）。</small>`;
 }
 function tabSwitch(c) {
  const lv = c.state().alert;
  return `<h3>オンオフ（作戦をまたいで残ります）</h3>${SW.map(([k, label, note]) => `<div class="sw${on[k] ? ' on' : ''}" data-sw="${k}"><span class="knob"></span><span>${label}${note ? `<small>${note}</small>` : ''}</span></div>`).join('')}
  <h3>警戒度</h3>${[0, 1, 2, 3].map(v => `<button class="b${lv === v ? ' on' : ''}" data-a="alert" data-v="${v}">${v}</button>`).join('')}
  <h3>人</h3><button class="b" data-a="calmAll">全員を落ち着かせる</button><small>疑惑・顔のゲージ・警戒・通報をやめさせる</small>`;
 }
 function tabEvents(c) {
  if (CLUB) return '<h3>クラブ</h3><p>第2.5段階ではチャンスの操作はありません。</p>';
  const m53 = c.field(), m57 = c.m57System(), ch = m53.chances;
  const acts = PARTY ? {} : c.director().mission.m57.acts, flagSet = PARTY ? m53.flags : m57.flags;
  const flags = new Set([...flagSet]);
  for (const def of Object.values(ch.data)) for (const s of def.steps) for (const dn of [s.done, ...(s.done.any ?? [])]) if (dn.flag) flags.add(dn.flag);
  const rows = Object.entries(ch.data).map(([id, def]) => {
   const s = ch.states.get(id), step = def.steps[s.stage]?.text ?? '';
   return `<div class="row"><span class="l">${PARTY ? '' : `<b>${id.toUpperCase()}</b> `}${esc(def.title)} <span class="pill ${s.status}">${({undiscovered: '未発見', active: `${s.stage}/${def.steps.length}`, complete: '完了', lost: '失敗'})[s.status]}</span>${ch.tracked === id ? ' <small>追跡中</small>' : ''}<br><small>${s.status === 'active' ? '次：' + esc(step) : ''}　時間 ${mmss(def.window[0])}〜${mmss(def.window[1])}</small></span>
    <span><button class="b" data-a="chance" data-id="${id}" data-v="discover">発見</button><button class="b" data-a="chance" data-id="${id}" data-v="back">◀</button><button class="b" data-a="chance" data-id="${id}" data-v="next">▶</button><button class="b" data-a="chance" data-id="${id}" data-v="complete">完了</button><button class="b" data-a="chance" data-id="${id}" data-v="reset">未発見</button><button class="b" data-a="chance" data-id="${id}" data-v="track">追跡</button><button class="b" data-a="chance" data-id="${id}" data-v="time">時間へ</button></span></div>`;
  }).join('');
  const act = (group, id, label) => `<div class="row"><span class="l">${esc(label)}</span><button class="b" data-a="actGo" data-g="${group}" data-id="${id}">そこへ</button><button class="b" data-a="actDo" data-g="${group}" data-id="${id}">実行</button></div>`;
  const head = `<h3>チャンス（${Object.keys(ch.data).length}）</h3><small>◀▶は手順を1つ戻す・進める。実際の仕掛けは下の「行動」で起こす。</small>${rows}`;
  const flagRow = `<h3>フラグ</h3>${[...flags].sort().map(f => `<button class="b${flagSet.has(f) ? ' on' : ''}" data-a="flag" data-id="${f}">${f}</button>`).join('') || '<small>なし</small>'}`;
  if (PARTY) return `${head}<h3>行動</h3>${partyActs.map(a => act('party', a.id, a.label)).join('')}${flagRow}
  <div class="row"><span class="l">致死毒</span><b>${m53.poison}</b><small>（「自分」の欄で増減）</small></div>`;
  return `${head}
  <h3>行動（A1）</h3>${A1_ACTS.map(([id, l]) => act('m53', id, l)).join('')}
  <h3>行動（その他のチャンス）</h3>${Object.entries(acts).map(([id, a]) => act('m57', id, a.label)).join('')}
  <h3>仕掛け</h3>
  <div class="row"><span class="l">限定ワインの樽</span>${['ready', 'armed', 'fired', 'result'].map(v => `<button class="b${m53.barrel === v ? ' on' : ''}" data-a="barrel" data-v="${v}">${({ready: '未', armed: '仕込み済み', fired: '作動', result: '終了'})[v]}</button>`).join('')}</div>
  ${TRAPS.map(t => `<div class="row"><span class="l">${TRAP_LABEL[t]}</span><button class="b${m57.armed.has(t) ? ' on' : ''}" data-a="arm" data-id="${t}">準備済み</button><button class="b${m57.fired.has(t) ? ' on' : ''}" data-a="fired" data-id="${t}">作動済み</button>${m57.map.areas[t] ? `<button class="b" data-a="fire" data-id="${t}">今すぐ作動</button>` : ''}</div>`).join('')}
  ${flagRow}
  <div class="row"><span class="l">運転席に座っている</span><button class="b${m57.inCar ? ' on' : ''}" data-a="inCar">${m57.inCar ? 'はい' : 'いいえ'}</button></div>`;
 }
 function tabPeople(c) {
  const st = c.state(), P = st.position, npcs = c.director().npcs.slice();
  const f = filter.trim().toLowerCase();
  const list = npcs.filter(n => !f || n.label.toLowerCase().includes(f) || n.id.includes(f))
   .sort((a, b) => (TARGETS.includes(b.id) - TARGETS.includes(a.id)) || flat(a.pos, P) - flat(b.pos, P));
  return `<div class="row"><input id="dbg-filter" placeholder="名前で絞り込む" value="${esc(filter)}" style="flex:1"><button class="b" data-a="calmAll">全員を落ち着かせる</button></div>
  ${list.map(n => `<div class="row"><span class="l">${TARGETS.includes(n.id) ? '🎯 ' : ''}<b>${esc(n.label)}</b> <small>${n.id}　${FLOOR[Math.round(n.pos.y / 3.5)] ?? ''} ${flat(n.pos, P).toFixed(0)}m　${LIFE[n.life] || (n.scheduledAway ? '不在' : STATE[n.state] ?? n.state)}${n.suspicion > .5 ? '　疑惑 ' + Math.round(n.suspicion) : ''}${n.face > 0 ? '　顔 ' + Math.round(n.face * 100) + '%' : ''}${n.scheduleAction || n.scriptedAction ? '　' + esc(n.scriptedAction || n.scheduleAction) : ''}</small></span>
   <span><button class="b" data-a="npcGo" data-id="${n.id}">そこへ</button>${n.life === 'active' ? `<button class="b" data-a="npcCalm" data-id="${n.id}">落ち着かせる</button><button class="b" data-a="npcKo" data-id="${n.id}">気絶</button><button class="b warn" data-a="npcKill" data-id="${n.id}">殺す</button>` : ''}</span></div>`).join('')}`;
 }
 function tabMove(c) {
  const st = c.state(), mission = c.director().mission, rate = st.clock.rate ?? 1;
  mapFloor ??= st.currentFloor;
  const rooms = (mission.rooms ?? []).filter(r => r.label);
  const spots = spotsOf(c);
  return `<h3>時間</h3><div class="row"><b style="font-size:16px">${mmss(st.clock.time)}</b>
   <button class="b${rate === 1 ? ' on' : ''}" data-a="rate" data-v="1">1倍</button><button class="b${rate !== 1 ? ' on' : ''}" data-a="rate" data-v="4">4倍</button>
   ${[-300, -60, 60, 300].map(s => `<button class="b" data-a="time" data-v="${s}">${s > 0 ? '+' : '−'}${Math.abs(s) / 60}分</button>`).join('')}</div>
   <div class="row"><input id="dbg-time" placeholder="例 19:00" size="7"><button class="b" data-a="timeTo">その時刻へ</button><small>ミッション内の時刻（分:秒）</small></div>
  <h3>地図（クリックでその場所へ・ゲームの地図と同じ向き）</h3><div class="row">${(CLUB ? [0, 1] : [-1, 0, 1, 2]).map(f => `<button class="b${mapFloor === f ? ' on' : ''}" data-a="mapFloor" data-v="${f}">${FLOOR[f]}</button>`).join('')}<small><span style="color:#7dd3fc">●</span> 自分　<span style="color:#ffd36b">●</span> 標的　<span style="color:#e2362b">●</span> 警備　<span style="color:#4fc1b2">●</span> その他　<span style="color:#ff8a3d">●</span> 疑惑30以上　<span style="color:#5b5f62">●</span> 倒れた人　<span style="color:#e2362b">━</span> 検問</small></div>
  <canvas id="dbg-map" width="860" height="560"></canvas>
  <h3>場所</h3>${spots.map(([l, p], i) => `<button class="b" data-a="spot" data-v="${i}">${esc(l)}</button>`).join('')}
  <h3>部屋</h3>${rooms.map((r, i) => `<button class="b" data-a="room" data-v="${i}">${FLOOR[r.floor]} ${esc(r.label)}</button>`).join('')}`;
 }
 // Places to jump to, as [label, position]: the map's chance spots, checkpoints, exits and (party) both ends of each traversal.
 function spotsOf(c) {
  const m = c.director().mission, room = p => safe(() => m.rooms.find(r => r.floor === Math.round(p.y / 3.5) && p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ)?.label) ?? '';
  const common = [...(m.checkpoints ?? []).map(cp => [cp.label, {x: cp.x + cp.normal.x * 1.2, y: cp.y ?? 0, z: cp.z + cp.normal.z * 1.2}]),
   ...(m.exits ?? []).map(e => [`出口：${e.label}`, {x: e.x, y: FLOOR_Y[e.floor ?? 0], z: e.z}])];
  if (!PARTY) return [['樽（A1）', m.m53.barrel.approach], ['試飲の一杯（A1）', m.m53.glass.approach], ['セラー奥の試飲室', m.m53.privatePlace], ...common];
  const KIND = {ladder: 'はしご', drainpipe: '雨どい', pipe: '雨どい', window: '窓', ledge: '縁・塀'};
  return [...partyActs.map(a => [a.label, a.at]), ...common,
   ...(m.traversals ?? []).flatMap(t => [[`${KIND[t.kind] ?? t.kind}${t.id}：${room(t.start) || t.a}側`, t.start], [`${KIND[t.kind] ?? t.kind}${t.id}：${room(t.end) || t.b}側`, t.end]])];
 }

 // ---------------------------------------------------------------- map
 let mapK = null;
 function drawMap(c) {
  const cv = box.querySelector('#dbg-map'); if (!cv) return;
  const g = cv.getContext('2d'), m = c.director().mission, gr = m.ground, pad = 10;
  const k = Math.min((cv.width - pad * 2) / (gr.maxX - gr.minX), (cv.height - pad * 2) / (gr.maxZ - gr.minZ));
  // Seen from above with north (-z) up: x to the right, z down.
  const X = x => pad + (x - gr.minX) * k, Z = z => pad + (z - gr.minZ) * k;
  mapK = {k, pad, gr};
  g.clearRect(0, 0, cv.width, cv.height);
  const fl = mapFloor;
  g.fillStyle = 'rgba(125,211,252,.06)';
  if (fl === 0) g.fillRect(X(gr.minX), Z(gr.minZ), (gr.maxX - gr.minX) * k, (gr.maxZ - gr.minZ) * k);
  for (const f of m.floors) if (f.floor === fl) for (const a of f.areas) g.fillRect(X(a.minX), Z(a.minZ), (a.maxX - a.minX) * k, (a.maxZ - a.minZ) * k);
  g.strokeStyle = 'rgba(243,239,230,.18)'; g.fillStyle = 'rgba(243,239,230,.5)'; g.font = '11px "Yu Gothic UI",sans-serif';
  for (const r of m.rooms ?? []) if (r.floor === fl) { g.strokeRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * k, (r.maxZ - r.minZ) * k); if (r.label) g.fillText(r.label, X(r.minX) + 3, Z(r.minZ) + 12); }
  g.fillStyle = '#8d887c';
  for (const w of [...m.walls, ...(m.blockers ?? [])]) if ((w.floor ?? 0) === fl) { g.fillStyle = w.id?.startsWith('water') ? 'rgba(80,140,190,.35)' : '#8d887c'; g.fillRect(X(w.x - w.w / 2), Z(w.z - w.d / 2), Math.max(1, w.w * k), Math.max(1, w.d * k)); }
  g.fillStyle = 'rgba(255,211,107,.25)';
  for (const s of m.stairs) if (s.floor === fl || s.floor + 1 === fl) g.fillRect(X(s.minX), Z(s.minZ), (s.maxX - s.minX) * k, (s.maxZ - s.minZ) * k);
  g.strokeStyle = '#e2362b'; g.lineWidth = 2;
  for (const cp of m.checkpoints ?? []) if (fl === 0) { const hx = cp.normal.z, hz = -cp.normal.x, w = cp.width / 2; g.beginPath(); g.moveTo(X(cp.x - hx * w), Z(cp.z - hz * w)); g.lineTo(X(cp.x + hx * w), Z(cp.z + hz * w)); g.stroke(); }
  g.lineWidth = 1;
  const floorOf = y => Math.round(y / 3.5);
  for (const n of c.director().npcs) {
   if (n.scheduledAway || floorOf(n.pos.y) !== fl) continue;
   const t = TARGETS.includes(n.id);
   g.fillStyle = n.life !== 'active' ? '#5b5f62' : t ? '#ffd36b' : n.guard ? '#e2362b' : '#4fc1b2';
   if (n.life === 'active' && n.suspicion > 30) g.fillStyle = '#ff8a3d';
   g.beginPath(); g.arc(X(n.pos.x), Z(n.pos.z), t ? 5 : 3, 0, Math.PI * 2); g.fill();
   if (t) { g.fillStyle = '#ffd36b'; g.fillText(n.label, X(n.pos.x) + 7, Z(n.pos.z) + 4); }
  }
  const p = c.state().position;
  if (c.state().currentFloor === fl) { g.fillStyle = '#7dd3fc'; g.strokeStyle = '#0e1113'; g.beginPath(); g.arc(X(p.x), Z(p.z), 6, 0, Math.PI * 2); g.fill(); g.stroke(); }
 }
 function mapClick(c, e) {
  const cv = e.currentTarget, r = cv.getBoundingClientRect(), s = cv.width / r.width, {k, pad, gr} = mapK;
  const x = gr.minX + ((e.clientX - r.left) * s - pad) / k, z = gr.minZ + ((e.clientY - r.top) * s - pad) / k, y = FLOOR_Y[mapFloor];
  if (mapFloor !== 0 && !c.director().mission.floors.some(f => f.floor === mapFloor && f.areas.some(a => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ))) { toast = 'その階に床がありません'; return; }
  if (go(c, x, y, z)) log('移動', `${FLOOR[mapFloor]} (${x.toFixed(1)}, ${z.toFixed(1)})`);
 }

 // ---------------------------------------------------------------- actions
 function act(c, a, el) {
  const d = c.director(), m53 = c.field(), m4 = m53.m4, m57 = c.m57System(), cb = c.combatSystem(), det = c.detectionSystem(), bus = c.eventBus();
  const id = el.dataset.id, v = el.dataset.v, t = c.clock().elapsed;
  switch (a) {
   case 'heal': cb.hp = cb.rules.player.health; log('体力', '全回復'); break;
   case 'disguise': c.disguise(id); bus.emit({type: 'disguise.changed', time: t, id}); log('服', d.rules.disguises[id].label); break;
   case 'unblow': d.compromised.clear(); log('バレた服を消す'); break;
   case 'wire': m4.hasWire = !m4.hasWire; log('ワイヤー', m4.hasWire ? 'あり' : 'なし'); break;
   case 'poison': m53.poison = Math.max(0, m53.poison + Number(v)); log('致死毒', m53.poison); break;
   case 'cellarKey': m53.cellarKey = !m53.cellarKey; if (m53.cellarKey) bus.emit({type: 'item.picked', time: t, id: 'cellar_key'}); log('セラーの鍵', m53.cellarKey ? 'あり' : 'なし'); break;
   case 'keycard': m57.keycard = !m57.keycard; if (m57.keycard) { bus.emit({type: 'item.picked', time: t, id: 'keycard'}); setFlag(c, 'keycard', true); } log('カードキー', m57.keycard ? 'あり' : 'なし'); break;
   case 'held': det.held = id; log('手に持つ', id ? det.data.items[id].label : 'なし'); break;
   case 'gun': cb.equip(id); log('銃を持つ', cb.def(id).label); break;
   case 'ungun': { const i = cb.guns.findIndex(g => g.id === id); if (i >= 0) cb.guns.splice(i, 1); if (cb.hand === id) cb.holster(); log('銃を外す', cb.def(id).label); break; }
   case 'ammo': { const g = cb.guns.find(g => g.id === id), w = cb.def(id); if (g) { g.mag = w.mag; g.reserve = Math.max(g.reserve, [w.reserve].flat().pop() ?? 0); } log('弾', w.label); break; }
   case 'alert': c.hotel().level = Number(v); log('警戒度', v); break;
   case 'calmAll': for (const n of d.npcs) calm(n); log('全員を落ち着かせる'); break;
   case 'chance': chance(c, id, v); break;
   case 'actGo': actGo(c, el.dataset.g, id); break;
   case 'actDo': actDo(c, el.dataset.g, id); break;
   case 'barrel': m53.barrel = v; if (v === 'armed') { m53.barrelCycle = c.clock().cycle; bus.emit({type: 'trap.armed', time: t, id: 'wine_barrel'}); } log('樽', v); break;
   case 'arm': if (m57.armed.has(id)) m57.armed.delete(id); else { m57.armed.add(id); bus.emit({type: 'trap.armed', time: t, id}); } log('仕掛け準備', `${TRAP_LABEL[id]} ${m57.armed.has(id) ? 'オン' : 'オフ'}`); break;
   case 'fired': if (m57.fired.has(id)) m57.fired.delete(id); else m57.fired.add(id); log('仕掛け作動済み', `${TRAP_LABEL[id]} ${m57.fired.has(id) ? 'オン' : 'オフ'}`); break;
   case 'fire': m57.fired.delete(id); m57.fire(id, view(c), false); log('仕掛けを作動', TRAP_LABEL[id]); break;
   case 'flag': { const fs = PARTY ? m53.flags : m57.flags; setFlag(c, id, !fs.has(id)); log('フラグ', `${id} ${fs.has(id) ? 'オン' : 'オフ'}`); break; }
   case 'inCar': m57.inCar = !m57.inCar; log('運転席', m57.inCar ? 'はい' : 'いいえ'); break;
   case 'npcGo': goNpc(c, npcById(c, id)); log('人のところへ', npcById(c, id).label); break;
   case 'npcCalm': calm(npcById(c, id)); log('落ち着かせる', npcById(c, id).label); break;
   case 'npcKo': down(c, npcById(c, id), 'unconscious'); log('気絶させる', npcById(c, id).label); break;
   case 'npcKill': down(c, npcById(c, id), 'dead'); log('殺す', npcById(c, id).label); break;
   case 'rate': c.timeScale(Number(v)); log('速さ', v + '倍'); break;
   case 'time': c.jumpTime(Math.max(0, c.clock().time + Number(v))); log('時刻', mmss(c.clock().time)); break;
   case 'timeTo': { const m = /^(\d+):(\d{1,2})$/.exec(box.querySelector('#dbg-time').value.trim()); if (!m) { toast = '「19:00」の形で入れてください'; break; } c.jumpTime(Number(m[1]) * 60 + Number(m[2])); log('時刻', mmss(c.clock().time)); break; }
   case 'mapFloor': mapFloor = Number(v); break;
   case 'spot': { const p = spotsOf(c)[Number(v)][1]; if (go(c, p.x, p.y ?? 0, p.z)) log('移動', el.textContent); break; }
   case 'room': { const r = d.mission.rooms.filter(r => r.label)[Number(v)]; if (go(c, (r.minX + r.maxX) / 2, FLOOR_Y[r.floor], (r.minZ + r.maxZ) / 2)) log('移動', r.label); break; }
  }
 }
 function setFlag(c, id, value) {
  const flags = PARTY ? c.field().flags : c.m57System().flags;
  if (!value) { flags.delete(id); return; }
  if (flags.has(id)) return;
  flags.add(id); c.eventBus().emit({type: 'flag.set', time: c.clock().elapsed, id});
 }
 function chance(c, id, v) {
  const ch = c.field().chances, def = ch.data[id], s = ch.states.get(id), t = c.clock().elapsed;
  const changed = () => c.eventBus().emit({type: 'chance.updated', time: t, id, value: s.stage, reason: s.status});
  if (v === 'discover') { if (s.status === 'undiscovered') c.eventBus().emit({type: 'dialogue.heard', time: t, id: def.trigger.heard}); if (s.status !== 'active') { s.status = 'active'; changed(); } ch.tracked ??= id; }
  else if (v === 'next') { if (s.status !== 'active') { s.status = 'active'; } s.stage = Math.min(def.steps.length, s.stage + 1); if (s.stage === def.steps.length) s.status = 'complete'; changed(); }
  else if (v === 'back') { s.stage = Math.max(0, s.stage - 1); if (s.status !== 'undiscovered') s.status = 'active'; changed(); }
  else if (v === 'complete') { s.stage = def.steps.length; s.status = 'complete'; changed(); }
  else if (v === 'reset') { s.stage = 0; s.status = 'undiscovered'; if (ch.tracked === id) ch.tracked = null; changed(); }
  else if (v === 'track') { if (s.status === 'undiscovered') { s.status = 'active'; changed(); } ch.tracked = id; }
  else if (v === 'time') { c.jumpTime(def.window[0]); }
  log('チャンス', `${id.toUpperCase()} ${({discover: '発見', next: '進める', back: '戻す', complete: '完了', reset: '未発見', track: '追跡', time: '時間へ'})[v]}`);
 }
 function actGo(c, group, id) {
  const m = c.director().mission;
  if (group === 'party') { const a = partyActs.find(a => a.id === id); if (a) go(c, a.at.x, a.at.y, a.at.z); }
  else if (group === 'm53') {
   if (id === 'greet') goNpc(c, npcById(c, 'head_waiter'));
   else { const p = id === 'poison' ? m.m53.barrel.approach : m.m53.glass.approach; go(c, p.x, p.y, p.z); }
  } else {
   const at = m.m57.acts[id].at;
   if (at) go(c, at.x, at.y, at.z); else goNpc(c, npcById(c, BESIDE[id]));
  }
  log('行動の場所へ', id);
 }
 function actDo(c, group, id) {
  const p = view(c), t = c.clock().elapsed;
  if (group === 'party') { const f = c.field(); if (id === 'drink' && f.poison < 1) f.poison = 1; f.complete(id, p); }
  else if (group === 'm53') {
   const m53 = c.field(), npc = id === 'greet' ? npcById(c, 'head_waiter') : undefined;
   if ((id === 'poison' || id === 'serve') && m53.poison < 1) m53.poison = 1;
   m53.complete({kind: id, elapsed: 0, duration: 0, start: {...p}, npc}, p);
  } else c.m57System().complete({id, elapsed: 0, duration: 0, start: {...p}}, p);
  log('行動を実行', id);
  void t;
 }

 // ---------------------------------------------------------------- open / close, drawing
 function render() {
  const c = C();
  if (!c || !ready(c)) { box.innerHTML = `<div class="top"><b>DEBUG</b><button class="b" data-close>閉じる F9</button></div><div class="body">作戦開始後に使えます。</div>`; box.querySelector('[data-close]').onclick = () => toggle(false); return; }
  const body = safe(() => ({self: tabSelf, switch: tabSwitch, events: tabEvents, people: tabPeople, move: tabMove})[tab](c)) ?? '読み込めませんでした';
  const scroll = box.querySelector('.body')?.scrollTop ?? 0;
  box.innerHTML = `<div class="top"><b>DEBUG</b><button class="b" data-close>閉じる F9</button></div><div class="info">${safe(() => info(c)) ?? ''}</div>
   <div class="tabs">${TABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
   <div class="body">${body}</div><div class="foot">${esc(toast)}</div>`;
  box.querySelector('.body').scrollTop = scroll;
  box.querySelector('[data-close]').onclick = () => toggle(false);
  for (const b of box.querySelectorAll('[data-tab]')) b.onclick = () => { tab = b.dataset.tab; try { localStorage.setItem('clean-hands.debug.tab', tab); } catch {} box.querySelector('.body').scrollTop = 0; render(); };
  for (const b of box.querySelectorAll('[data-a]')) b.onclick = () => { try { act(c, b.dataset.a, b); } catch (err) { toast = 'できませんでした：' + err.message; } render(); };
  for (const b of box.querySelectorAll('[data-sw]')) b.onclick = () => { const k = b.dataset.sw; on[k] = !on[k]; keep(); log('オンオフ', `${SW.find(s => s[0] === k)[1]} ${on[k] ? 'オン' : 'オフ'}`); render(); };
  const hp = box.querySelector('[data-hp]'); if (hp) hp.onchange = () => { c.combatSystem().hp = Number(hp.value); log('体力', hp.value); render(); };
  const fi = box.querySelector('#dbg-filter'); if (fi) { fi.oninput = () => { filter = fi.value; render(); const n = box.querySelector('#dbg-filter'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; }
  const ti = box.querySelector('#dbg-time'); if (ti) ti.onkeydown = e => { if (e.key === 'Enter') box.querySelector('[data-a="timeTo"]').click(); };
  const cv = box.querySelector('#dbg-map'); if (cv) { drawMap(c); cv.onclick = e => { mapClick(c, e); render(); }; }
 }
 function toggle(want = !open) {
  const c = C(); open = want;
  if (open) {
   const st = safe(() => c.state());
   wasPaused = !!st?.paused;
   if (st && !st.paused && !st.missionOver && ready(c)) document.getElementById('pause')?.click();
   document.exitPointerLock?.();
   box.style.display = 'flex'; render();
  } else {
   box.style.display = 'none';
   const st = safe(() => c.state());
   if (st?.paused && !wasPaused && !st.missionOver) document.getElementById('resume')?.click();
  }
 }
 addEventListener('keydown', e => {
  if (e.code !== 'F9') return;
  e.preventDefault(); e.stopPropagation();
  if (!e.repeat) toggle();
 }, true);
 // Keys typed into the panel's boxes stay out of the game.
 box.addEventListener('keydown', e => { if (e.target.matches('input')) e.stopPropagation(); });
 box.addEventListener('keyup', e => { if (e.target.matches('input')) e.stopPropagation(); });

 let lastStrip = 0, lastPanel = 0;
 function loop(now) {
  const c = C();
  if (c && ready(c)) {
   safe(() => patch(c)); safe(() => hold(c));
   if (now - lastStrip > 250) {
    lastStrip = now;
    const active = SW.filter(([k]) => on[k]).map(([, l]) => l);
    strip.style.display = !open && active.length ? 'block' : 'none';
    strip.textContent = `DEBUG（F9）　${active.join('・')}`;
   }
   // While the panel is open the game is paused; redraw now and then for changes made by the game itself.
   if (open && now - lastPanel > 1000 && !box.contains(document.activeElement?.closest('input,select') ?? null)) { lastPanel = now; render(); }
  } else strip.style.display = 'none';
  requestAnimationFrame(loop);
 }
 document.body.append(box, strip);
 requestAnimationFrame(loop);
})();
