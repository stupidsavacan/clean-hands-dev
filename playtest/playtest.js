// CLEAN HANDS playtest recorder. Loaded by playtest/server.py on top of the unchanged single-file game.
// Pick a scenario, play normally; everything that happens and the agent's state each second is saved to runs/.
(() => {
 const SAVE_EVERY = 5000, SAMPLE_EVERY = 1000, NEAR = 12;
 // Two maps: the hotel at /, the party prototype at /party (its data comes from the same API with ?map=party).
 const MAP = location.pathname.startsWith('/club') ? 'club' : location.pathname.startsWith('/party') ? 'party' : 'hotel', Q = MAP === 'hotel' ? '' : '?map=' + MAP;
 const MAPS = {hotel: {title: 'グランド・マリーナ・ホテル', game: 'CLEAN HANDS M5.8 PC', href: '/'}, party: {title: '夜会の私邸（試作）', game: 'CLEAN HANDS 夜会の私邸 試作', href: '/party'}, club: {title: 'クラブ（試作）', game: 'CLEAN HANDS クラブ', href: '/club'}};
 const TARGET = MAP === 'club' ? {investor: '投資家'} : MAP === 'party' ? {host: '館の主人'} : {wine_merchant: 'A ワイン商', lawyer: 'B 元顧問弁護士', investor: 'C 若き投資家'};
 const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
 const stamp = d => d.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
 const localStamp = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return stamp(z); };
 const css = `
 #pt-pick{position:fixed;inset:0;z-index:9999;background:rgba(10,13,15,.86);display:flex;align-items:center;justify-content:center;font:14px "Yu Gothic UI","Hiragino Sans",system-ui,sans-serif;color:#f3efe6}
 #pt-pick .box{background:#171b1e;border:1px solid #3a4146;border-radius:10px;padding:22px 24px;width:min(980px,94vw);max-height:92vh;overflow:auto}
 #pt-pick h1{margin:0 0 4px;font-size:22px}#pt-pick p{margin:0 0 12px;color:#b9b3a4}
 #pt-pick .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:12px 0}
 #pt-pick button.sc{text-align:left;background:#22282c;border:1px solid #3a4146;border-radius:8px;color:#f3efe6;padding:10px 12px;cursor:pointer;font:inherit;line-height:1.45}
 #pt-pick button.sc:hover,#pt-pick button.sc:focus-visible{border-color:#e2362b;outline:none}#pt-pick button.sc b{display:block;font-size:14px}#pt-pick button.sc small{color:#9fd1c2}
 #pt-pick button.sc.full{border-color:#4fc1b2}
 #pt-pick label{color:#b9b3a4}#pt-pick select{font:inherit;background:#22282c;color:#f3efe6;border:1px solid #3a4146;border-radius:6px;padding:4px 8px}
 #pt-badge{position:fixed;left:50%;transform:translateX(-50%);bottom:6px;z-index:9998;background:rgba(10,13,15,.72);color:#f3efe6;border:1px solid rgba(243,239,230,.2);border-radius:6px;padding:4px 10px;font:12px "Yu Gothic UI",system-ui,sans-serif;display:flex;gap:10px;align-items:center;pointer-events:auto}
 #pt-badge .rec{color:#ff5a4f;font-weight:700}#pt-badge a,#pt-badge button{color:#9fd1c2;background:none;border:0;font:inherit;cursor:pointer;padding:0;text-decoration:underline}
 #pt-memo{position:fixed;inset:0;z-index:10000;background:rgba(10,13,15,.55);display:none;align-items:center;justify-content:center;font:14px "Yu Gothic UI","Hiragino Sans",system-ui,sans-serif;color:#f3efe6}
 #pt-memo .box{background:#171b1e;border:1px solid #3a4146;border-top:3px solid #ffd36b;border-radius:10px;padding:16px 18px;width:min(1040px,94vw);max-height:92vh;overflow:auto}
 #pt-memo .head{display:flex;gap:14px;align-items:baseline;margin-bottom:10px}#pt-memo .head span{color:#b9b3a4;font-size:13px}
 #pt-memo .body{display:flex;gap:14px;flex-wrap:wrap}#pt-memo img{width:min(520px,100%);border-radius:6px;border:1px solid #3a4146}
 #pt-memo .side{flex:1;min-width:280px;display:flex;flex-direction:column;gap:8px}#pt-memo small{color:#b9b3a4}
 #pt-memo textarea{font:inherit;background:#0f1214;color:#f3efe6;border:1px solid #3a4146;border-radius:6px;padding:8px;resize:vertical}#pt-memo textarea:focus{outline:2px solid #ffd36b;outline-offset:1px}
 #pt-memo .tags{display:flex;flex-wrap:wrap;gap:6px}#pt-memo .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
 #pt-memo button{font:inherit;font-size:13px;background:#22282c;color:#f3efe6;border:1px solid #3a4146;border-radius:999px;padding:3px 11px;cursor:pointer}
 #pt-memo button.on{background:#ffd36b;color:#15171b;border-color:#ffd36b}#pt-memo button.primary{background:#e2362b;border-color:#e2362b;border-radius:6px;margin-left:6px}`;
 document.head.append(Object.assign(document.createElement('style'), {textContent: css}));

 let scenario = null, lead = 420, chances = {}, schedule = {};
 // Chances whose first step needs someone who only turns up earlier than the kill window (schedule.json):
 // the sommelier lands at the pier at 5:00 and leaves for the bar at 6:00, the pilot reaches the roof at 19:00,
 // the masseuse reaches the loading dock at 11:00. The scenario starts from whichever comes first.
 const FIRST = MAP !== 'hotel' ? {} : {a1: ['sommelier', 'ソムリエが桟橋に着く'], c3: ['pilot', 'パイロットがヘリポートに来る'], c4: ['masseuse', 'マッサージ師が搬入口に着く']};
 function keyTime(id, c) {
  const f = FIRST[id], plan = f && schedule[f[0]]?.plan, appear = plan?.find(p => p.do !== 'absent')?.from;
  return appear !== undefined && appear < c.window[0] ? {time: appear, why: `最初の手順：${f[1]} ${mmss(appear)}`} : {time: c.window[0], why: `チャンスの時間 ${mmss(c.window[0])}〜${mmss(c.window[1])}`};
 }
 let bus = null, run = null, skip = null, off = null, t0 = 0, lastSave = 0, lastSample = 0, applied = false, disguise = 'suit', saving = false;

 // ---------------------------------------------------------------- scenario picker
 const pick = document.createElement('div'); pick.id = 'pt-pick';
 function openPicker() {
  const list = Object.entries(chances).map(([id, c]) => {
   const k = keyTime(id, c), start = Math.max(0, k.time - lead);
   return `<button class="sc" data-id="${id}"><b>${MAP === 'hotel' ? id.toUpperCase() + '　' : ''}${c.title}</b>${TARGET[c.target] ?? c.target}<br><small>${k.why}　→ ${mmss(start)} から開始</small></button>`;
  }).join('');
  pick.innerHTML = `<div class="box" role="dialog" aria-label="プレイテストのシナリオ">
   <h1>プレイテスト：シナリオを選ぶ</h1>
   <p>マップ：${Object.entries(MAPS).map(([k, m]) => k === MAP ? `<b>${m.title}</b>` : `<a href="${m.href}" style="color:#9fd1c2">${m.title}</a>`).join('　／　')}</p>
   <p>選んだあと、いつもどおり外見・準備画面から「作戦開始」してください。起きたことと状態は自動で保存されます（<a href="/runs" target="_blank" style="color:#9fd1c2">記録の一覧</a>）。</p>
   <label>最初の手順（またはチャンスの時間）より <select id="pt-lead">${[180, 300, 420, 600, 900].map(s => `<option value="${s}"${s === lead ? ' selected' : ''}>${s / 60}分</option>`).join('')}</select> 前から始める（そのチャンスは発見済み・追跡中で始まります）</label>
   <div class="grid"><button class="sc full" data-id="full"><b>通し（本番どおり）</b>0:00 から、チャンスは未発見<br><small>最初から最後まで遊ぶ</small></button>${list}</div></div>`;
  pick.style.display = 'flex'; document.exitPointerLock?.(); // the picker needs the mouse
  pick.querySelector('#pt-lead').onchange = e => { lead = Number(e.target.value); openPicker(); };
  for (const b of pick.querySelectorAll('button.sc')) b.onclick = () => choose(b.dataset.id);
  pick.querySelector('button.sc')?.focus();
 }
 function choose(id) {
  const c = chances[id];
  scenario = id === 'full' ? {id: 'full', title: MAP === 'club' ? 'クラブ 探索' : MAP === 'party' ? '夜会 通し' : '通し（本番どおり）', start: 0, trigger: null}
   : {id, title: MAP === 'party' ? `夜会 ${c.title}` : `${id.toUpperCase()} ${c.title}`, target: c.target, start: Math.max(0, keyTime(id, c).time - lead), lead, keyTime: keyTime(id, c), window: c.window, trigger: c.trigger.heard};
  pick.style.display = 'none'; badge();
 }

 // ---------------------------------------------------------------- recording
 const C = () => window.__cleanHands;
 const clubSaved = new Map();
 const safe = f => { try { return f(); } catch { return undefined; } };
 const clone = x => JSON.parse(JSON.stringify(x ?? null));
 function playing(c) { const st = safe(() => c.state()), m = safe(() => c.mission()); return !!st && st.modelReady && !st.creatorOpen && m && !m.prepOpen; }
 function begin(c) {
  const now = new Date(), clock = c.clock();
  run = {meta: {id: `${localStamp(now)}_${MAP === 'hotel' ? '' : MAP + '-'}${scenario.id}`, map: MAP, scenario: scenario.id, scenarioTitle: scenario.title, startTime: scenario.start, lead: scenario.lead ?? null,
          startedAt: now.toISOString(), game: MAPS[MAP].game, page: location.href, viewport: [innerWidth, innerHeight], userAgent: navigator.userAgent,
          loadout: safe(() => clone(c.mission().loadout)), keyTime: scenario.keyTime ?? null},
         events: [], samples: [], end: null};
  if (MAP === 'club') {
   run.telemetry = [];
   c.clubTrace?.(true);
   if (new URLSearchParams(location.search).get('test') === 'crowd-qa') run.meta.test = 'crowd-qa';
  }
  applied = false; disguise = 'suit'; lastOf = new Map(); lastSave = 0; lastSample = 0; t0 = clock.elapsed; downAt = null;
  // Events already on this mission's bus (its first moments) come from its trace, then live.
  for (const e of bus.recent) record(e);
  off = bus.on(record);
 }
 function apply(c) {
  // Jump to the scenario's time and hear its trigger, once, at the very start of the run.
  if (applied || !scenario) return; applied = true;
  // jumpTime sets the mission clock to an absolute time (seconds since the start of the loop).
  if (scenario.start > c.clock().time) c.jumpTime(scenario.start);
  if (scenario.trigger) bus.emit({type: 'dialogue.heard', time: c.clock().elapsed, id: scenario.trigger});
  run.meta.appliedAt = clone(c.clock()); t0 = c.clock().elapsed;
 }
 // The same person can raise the same event every frame (a witness with no guard to run to reports on the spot,
 // calms down and sees the agent again). A run of those within REPEAT_GAP seconds is kept as one event that counts
 // them: `repeat` (how many) and `lastPlay` (when the last one came).
 const REPEATS = new Set(['player.spotted', 'witness.started', 'witness.reported', 'player.hit']), REPEAT_GAP = 3;
 let lastOf = new Map();
 function record(e) {
  if (!run || e.type === 'clock.tick') return;
  if (e.type === 'debug.cheat') { discard(); return; }
  if (e.type === 'schedule.action' && !(e.id in TARGET)) return; // only the targets' routines, the rest is noise
  if (e.type === 'disguise.changed' && e.id) disguise = e.id;
  const c = C(), p = safe(() => c.state().position), clock = safe(() => c.clock());
  const play = +Math.max(0, (clock?.elapsed ?? 0) - t0).toFixed(2);
  if (REPEATS.has(e.type)) {
   const key = `${e.type}|${e.id}|${e.reason ?? ''}`, last = lastOf.get(key);
   if (last && play - (last.lastPlay ?? last.play) <= REPEAT_GAP) { last.repeat = (last.repeat ?? 1) + 1; last.lastPlay = play; return; }
  }
  const row = {play, t: +(clock?.elapsed ?? e.time ?? 0).toFixed(2), clock: +(clock?.time ?? 0).toFixed(1), ...clone(e), at: p ? {x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2)} : null, disguise};
  if (REPEATS.has(e.type)) lastOf.set(`${e.type}|${e.id}|${e.reason ?? ''}`, row);
  run.events.push(row);
 }
 function drainClub(c) {
  if (MAP === 'club' && run?.telemetry) run.telemetry.push(...(c.clubTrace?.() ?? []));
 }
 function sample(c) { run.samples.push(snapshot(c)); }
 function snapshot(c) {
  const st = safe(() => c.state()) ?? {}, cb = safe(() => c.combat()) ?? {}, dt = safe(() => c.detection()) ?? {}, d = safe(() => c.director()), pf = safe(() => c.performance()) ?? {};
  const traversal = safe(() => c.traversalInspection?.());
  const traversalErrorCm = traversal?.weight === 1 && traversal.contacts.length ? Math.max(...traversal.contacts.map(c => c.error)) * 100 : null;
  const hot = safe(() => d.hottest()), watchers = safe(() => d.npcs.filter(n => n.suspicion > 1).length), clock = st.clock ?? {};
  // Where the targets are and what they do, and who is around the agent (id, distance, state, suspicion, can see).
  const P = st.position, npcs = safe(() => d.npcs) ?? [], r1 = v => +v.toFixed(1);
  const targets = Object.fromEntries(npcs.filter(n => n.id in TARGET).map(n => [n.id, {x: r1(n.pos.x), y: r1(n.pos.y), z: r1(n.pos.z), do: n.scriptedAction || n.scheduleAction || '', life: n.life}]));
  const near = P ? npcs.filter(n => n.active && Math.abs(n.pos.y - P.y) < 2 && Math.hypot(n.pos.x - P.x, n.pos.z - P.z) < NEAR)
   .map(n => [n.id, r1(Math.hypot(n.pos.x - P.x, n.pos.z - P.z)), n.state, Math.round(n.suspicion), n.visibility > 0 ? 1 : 0]) : [];
  return ({play: +Math.max(0, (clock.elapsed ?? 0) - t0).toFixed(1), t: +(clock.elapsed ?? 0).toFixed(1), clock: +(clock.time ?? 0).toFixed(1), pos: st.position && {x: +st.position.x.toFixed(2), y: +st.position.y.toFixed(2), z: +st.position.z.toFixed(2)},
   floor: st.currentFloor, disguise, compromised: safe(() => [...d.compromised]), held: dt.held || '', blend: dt.blend || null, recorded: !!dt.recorded,
   hp: cb.hp, hand: cb.hand || '', guns: (cb.guns ?? []).map(g => g.id), inCombat: (cb.inCombat ?? []).length, alert: st.alert,
   suspicion: hot ? Math.round(hot.suspicion) : 0, suspiciousOf: hot && hot.suspicion > .5 ? hot.id : null, watchers,
   paused: !!st.paused, map: !!st.mapOpen, fps: pf.fps ? Math.round(pf.fps) : null, traversalErrorCm,
   ...Object.fromEntries(['jsFrameMs', 'simulationMs', 'aiMs', 'renderSubmitMs', 'playerCollisionMs', 'drawCalls', 'triangles']
    .filter(k => Number.isFinite(pf[k])).map(k => [k, +pf[k].toFixed(2)])), targets, near});
 }
 function finish(c, why, unloading = false) {
  if (!run || run.end) return;
  const endedAt = new Date().toISOString();
  if (safe(() => c.eventBus()) === bus) {
   drainClub(c);
   if (MAP === 'club') c.clubTrace?.(false);
   const m = safe(() => c.mission()) ?? {}, st = safe(() => c.state()) ?? {};
   run.end = {why, outcome: m.outcome || st.missionOver || why, phase: m.phase, remaining: clone(m.remaining), result: clone(m.result ?? null), provisionalScore: m.result ? null : clone(safe(() => c.score())),
    counts: clone(m.counts), kills: clone(safe(() => c.killLog())), chances: clone(safe(() => c.chances())), detection: clone(safe(() => c.detection())),
    combat: clone(safe(() => { const s = c.combat(); return {hp: s.hp, fights: s.fights, waves: s.waves}; })), clock: clone(safe(() => c.clock())), endedAt};
  } else {
   // An older game page may reset without notifying the recorder.
   run.end = {why, outcome: why, endedAt};
  }
  if (unloading) saveEnd(); else save(true);
 }
 // A mission played with the debug panel (F9) is not a playtest: once anything is changed there, or when a mission
 // starts with debug switches on, nothing of it is kept and what was saved so far is deleted.
 function discard() {
  if (!run) return;
  const id = run.meta.id; if (MAP === 'club') C()?.clubTrace?.(false); run = null; off?.(); off = null; skip = bus; wantShot = null;
  try { localStorage.removeItem('clean-hands.playtest.' + id); } catch {}
  fetch('/api/discard', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Playtest': '1'}, body: JSON.stringify({id})}).catch(() => {});
  status = ''; badge();
 }
 const debugging = () => !!safe(() => window.__ptDebug.active());

 // A chance run never reaches the result screen (the other two targets are still alive), so the run is judged
 // here: VERDICT_AFTER seconds after the scenario's target dies — enough for nearby people to find the body.
 const VERDICT_AFTER = 10;
 let downAt = null;
 function judge(c) {
  if (!scenario?.target || run.verdict) return;
  const t = safe(() => c.director().npcs.find(n => n.id === scenario.target)), now = c.clock().elapsed;
  if (t?.life !== 'dead') return;
  if (downAt === null) { downAt = now; return; }
  if (now - downAt < VERDICT_AFTER) return;
  const kill = [...run.events].reverse().find(e => e.type === 'npc.killed' && e.id === scenario.target) ?? {};
  const score = safe(() => c.score()) ?? {};
  const others = safe(() => c.director().npcs.filter(n => n.life === 'dead' && !(n.id in TARGET)).map(n => n.id)) ?? [];
  run.verdict = {clock: +c.clock().time.toFixed(1), method: kill.method ?? null, judgement: kill.judgement ?? null,
   chanceComplete: run.events.some(e => e.type === 'chance.updated' && e.id === scenario.id && e.reason === 'complete'),
   ghost: !!safe(() => c.mission().ghost), ghostBrokenBy: score.ghostBrokenBy ?? [], othersDead: others};
  const v = run.verdict;
  run.verdict.text = `判定：${v.chanceComplete ? 'チャンス成立' : 'チャンス外'}・${{accident: '事故', murder: '殺人', combat: '戦闘'}[v.judgement] ?? v.judgement ?? '?'}・${v.ghost ? 'ゴースト維持' : 'ゴースト崩れ（' + v.ghostBrokenBy.join(',') + '）'}`;
  save();
 }
 // A closing page only gets to send a small request (keepalive is limited to 64 KB), so send just the ending;
 // the server adds it to the run it already has from the last regular save.
 function saveEnd() {
  let end = run.end, body = JSON.stringify({id: run.meta.id, end});
  if (body.length > 60000) { end = {...end, detection: null, chances: null}; body = JSON.stringify({id: run.meta.id, end}); }
  if (MAP === 'club') {
   const from = clubSaved.get(run.meta.id) ?? 0;
   const payload = {id: run.meta.id, end, meta: run.meta, from, telemetry: run.telemetry.slice(from)};
   const tail = JSON.stringify(payload);
   if (new TextEncoder().encode(tail).length < 60000) body = tail;
   else save();
  }
  try { fetch('/api/end', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Playtest': '1'}, body, keepalive: true}); } catch {}
  try { localStorage.setItem('clean-hands.playtest.' + run.meta.id, JSON.stringify(run)); } catch {}
 }
 async function saveDebug() {
  const {bus: _, ...body} = debugRun;
  try { const r = await fetch('/api/run', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Playtest': '1'}, body: JSON.stringify(body)}); if (!r.ok) throw new Error(r.status); } catch { status = '保存失敗'; }
 }
 async function save(final = false) {
  if (!run || saving && !final) return; saving = true; lastSave = performance.now();
  const current = run, traceLength = current.telemetry?.length;
  const body = JSON.stringify(current);
  try {
   const r = await fetch('/api/run', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Playtest': '1'}, body, keepalive: final && body.length < 60000});
   if (!r.ok) throw new Error(r.status);
   if (traceLength !== undefined) clubSaved.set(current.meta.id, Math.max(clubSaved.get(current.meta.id) ?? 0, traceLength));
   status = `保存 ${new Date().toLocaleTimeString('ja-JP')}`;
  } catch (err) {
   // No server (the page was opened as a file): keep the latest copy in this browser.
   try { localStorage.setItem('clean-hands.playtest.' + run.meta.id, body); status = '保存失敗（ブラウザ内に保持）'; } catch { status = '保存失敗'; }
  } finally { saving = false; badge(); }
 }

 // ---------------------------------------------------------------- memo (F8)
 // F8 takes a picture of the screen and the state at that moment, pauses the game and asks for a note.
 // The note, the state, the last few events and the picture are saved with the run (picture: runs/<id>_memo<n>.jpg).
 const TAGS = ['バグ', '方法がない', '難しすぎ', '簡単すぎ', '分かりにくい', 'アイデア'];
 const SHOT_WIDTH = 960, RECENT = 8, FLOOR = {'-1': 'B1', 0: '1F', 1: '2F', 2: MAP === 'party' ? '屋根裏' : 'RF'};
 let memo = null, wantShot = null;
 // Debug play (F9) is not recorded: most of it is trying things out. A note taken with F8 there is still kept, on its
 // own: runs/<time>_debug.json holds the notes of that mission, each with its picture, the state and the last
 // DEBUG_WINDOW seconds of events (kept in a small ring while debugging, the debug switches used among them).
 const DEBUG_WINDOW = 60, DEBUG_EVENTS = 400;
 let ring = [], ringOff = null, debugRun = null;
 function ringPush(e) {
  if (e.type === 'clock.tick') return; const c = C(), p = safe(() => c.state().position), t = safe(() => c.clock().elapsed) ?? e.time ?? 0;
  ring.push({t: +t.toFixed(2), clock: +(safe(() => c.clock().time) ?? 0).toFixed(1), ...clone(e), at: p ? {x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2)} : null});
  while (ring.length > DEBUG_EVENTS || ring.length && ring[0].t < t - DEBUG_WINDOW) ring.shift();
 }
 const debugIdle = () => !run && skip && skip === bus;
 function debugTarget(c) {
  if (debugRun?.bus === bus) return debugRun;
  const now = new Date();
  debugRun = {bus, meta: {id: `${localStamp(now)}_${MAP === 'hotel' ? '' : MAP + '-'}debug`, map: MAP, scenario: 'debug', scenarioTitle: 'デバッグ中のメモ', debug: true, startedAt: now.toISOString(), game: MAPS[MAP].game,
   page: location.href, viewport: [innerWidth, innerHeight], userAgent: navigator.userAgent, loadout: safe(() => clone(c.mission().loadout))}, events: [], samples: [], end: null, memos: []};
  return debugRun;
 }
 const memoBox = document.createElement('div'); memoBox.id = 'pt-memo';
 function shoot() {
  // Called inside an animation frame right after the game drew it, so the WebGL canvas still holds the picture.
  const view = document.getElementById('view'), hud = document.getElementById('hud');
  if (!view?.width) return null;
  const k = Math.min(1, SHOT_WIDTH / view.width), cv = document.createElement('canvas');
  cv.width = Math.round(view.width * k); cv.height = Math.round(view.height * k);
  const g = cv.getContext('2d'); g.drawImage(view, 0, 0, cv.width, cv.height); if (hud?.width) g.drawImage(hud, 0, 0, cv.width, cv.height);
  return safe(() => cv.toDataURL('image/jpeg', .75)) ?? null;
 }
 function openMemo(c, shot) {
  const target = run ?? debugTarget(c);
  const st = safe(() => c.state()) ?? {}, d = safe(() => c.director());
  const snap = snapshot(c), labels = Object.fromEntries((safe(() => d.npcs) ?? []).map(n => [n.id, n.label]));
  const wasPaused = !!st.paused;
  if (!wasPaused && !st.missionOver) document.getElementById('pause')?.click();
  memo = {target, n: (target.memos?.length ?? 0) + 1, play: snap.play, t: snap.t, clock: snap.clock, at: new Date().toISOString(), wasPaused, shot, tags: [],
          state: snap, near: snap.near.map(([id, dist, state, sus, seen]) => ({id, label: labels[id] ?? id, dist, state, suspicion: sus, seen: !!seen})),
          recent: run ? run.events.slice(-RECENT) : ring.slice(-RECENT), missionOver: st.missionOver || ''};
  memo.floorLabel = FLOOR[snap.floor] ?? `${snap.floor}`; memo.disguiseLabel = safe(() => d.rules.disguises[snap.disguise].label) ?? snap.disguise;
  const where = `${mmss(snap.clock)}　${memo.floorLabel} (${snap.pos?.x ?? '?'}, ${snap.pos?.z ?? '?'})　服：${memo.disguiseLabel}${snap.held ? '　手：' + snap.held : ''}`;
  const near = memo.near.slice().sort((a, b) => a.dist - b.dist).slice(0, 4).map(n => `${n.label} ${n.dist}m`).join('、') || 'なし';
  memoBox.innerHTML = `<div class="box" role="dialog" aria-label="プレイテストのメモ">
   <div class="head"><b>メモ ${memo.n}${run ? '' : '（デバッグ中）'}</b><span>${where}</span></div>
   <div class="body">${shot ? `<img src="${shot}" alt="F8を押したときの画面">` : ''}<div class="side">
    <div class="tags">${TAGS.map(t => `<button type="button" data-tag="${t}">${t}</button>`).join('')}</div>
    <textarea id="pt-memo-text" rows="5" placeholder="そのときの判断や気づき（例：カメラマンを気絶させる方法が無い）"></textarea>
    <small>近くの人：${near}</small>
    <div class="row"><small>Enter 保存 · Shift+Enter 改行 · Esc やめる</small><span><button type="button" id="pt-memo-cancel">やめる</button><button type="button" id="pt-memo-save" class="primary">保存</button></span></div>
   </div></div></div>`;
  memoBox.style.display = 'flex';
  for (const b of memoBox.querySelectorAll('[data-tag]')) b.onclick = () => { const t = b.dataset.tag, i = memo.tags.indexOf(t); i < 0 ? memo.tags.push(t) : memo.tags.splice(i, 1); b.classList.toggle('on', i < 0); text.focus(); };
  const text = memoBox.querySelector('#pt-memo-text');
  text.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); closeMemo(true); } else if (e.key === 'Escape') { e.preventDefault(); closeMemo(false); } };
  memoBox.querySelector('#pt-memo-save').onclick = () => closeMemo(true);
  memoBox.querySelector('#pt-memo-cancel').onclick = () => closeMemo(false);
  setTimeout(() => text.focus(), 0);
 }
 async function closeMemo(keep) {
  if (!memo) return;
  const m = memo, text = memoBox.querySelector('#pt-memo-text')?.value.trim() ?? '';
  memo = null; memoBox.style.display = 'none';
  if (!m.wasPaused && !m.missionOver) document.getElementById('resume')?.click();
  const target = m.target; delete m.target;
  if (!keep || (!text && !m.tags.length) || target !== (run ?? debugRun)) return;
  m.text = text; const shot = m.shot; delete m.shot;
  // A debug note carries the events of the last minute (the debug switches among them), not the whole session.
  if (target === debugRun) target.events = ring.slice();
  (target.memos ??= []).push(m); status = `メモ ${m.n} を保存中`; badge();
  if (shot) {
   try {
    const r = await fetch('/api/shot', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Playtest': '1'}, body: JSON.stringify({id: target.meta.id, n: m.n, data: shot})});
    if (r.ok) m.shot = (await r.json()).saved;
   } catch {}
  }
  if (target === debugRun) await saveDebug(); else await save(true); status = `メモ ${m.n} 保存 ${new Date().toLocaleTimeString('ja-JP')}`; badge();
 }
 addEventListener('keydown', e => {
  if (e.code !== 'F8') return;
  e.preventDefault(); e.stopPropagation();
  if (memo) { closeMemo(true); return; }
  if (!run && !debugIdle()) { status = 'メモは作戦開始後に使えます'; badge(); return; }
  if (!e.repeat) wantShot = C();
 }, true);

 // ---------------------------------------------------------------- badge
 let status = '', el = null;
 // A mission under way keeps its scenario; a new choice starts with the next mission, so the badge shows both.
 function badge() {
  if (!el) { el = document.createElement('div'); el.id = 'pt-badge'; document.body.append(el); }
  const c = C(), t = run ? (safe(() => c.clock().elapsed) ?? t0) - t0 : 0;
  const idle = !run && skip && skip === bus;
  el.innerHTML = `<span class="rec">${run && !run.end ? '● REC' : idle ? '○ デバッグ中（記録しない）' : '○'}</span><span>${run ? run.meta.scenarioTitle : scenario ? scenario.title : 'シナリオ未選択'}</span>${run && scenario && run.meta.scenario !== scenario.id ? `<b style="color:#ffd36b">次の作戦から：${scenario.title}（やり直すと切り替わる）</b>` : ''}${run ? `<span>${mmss(t)} · 出来事 ${run.events.length}</span>` : ''}${run?.verdict ? `<b style="color:#ffd36b">${run.verdict.text}</b>` : ""}${run ? `<span>F8 メモ${run.memos?.length ? `（${run.memos.length}）` : ''}</span>` : idle ? `<span>F8 メモは残せます${debugRun?.bus === bus && debugRun.memos.length ? `（${debugRun.memos.length}）` : ''}</span>` : ''}<span>${status}</span><button type="button" id="pt-change">シナリオ変更</button><a href="/runs" target="_blank">記録一覧</a>`;
  el.querySelector('#pt-change').onclick = () => openPicker();
 }

 // ---------------------------------------------------------------- main loop
 function loop() {
  const c = C();
  if (wantShot && (run || debugIdle())) { const g = wantShot; wantShot = null; openMemo(g, shoot()); }
  if (c && scenario) {
   const b = safe(() => c.eventBus());
   if (b && b !== bus) { // a new mission (start, restart, back from the prep screen)
    if (run && !run.end) finish(c, 'abandoned');
    off?.(); off = null; bus = b; run = null; ringOff?.(); ring = []; ringOff = b.on(ringPush);
   }
   if (bus && !run && skip !== bus && playing(c)) {
    if (debugging()) { skip = bus; badge(); } else { begin(c); apply(c); badge(); }
   }
   if (run && !run.end) {
    drainClub(c);
    const now = performance.now(), st = safe(() => c.state()), m = safe(() => c.mission());
    if (now - lastSample >= SAMPLE_EVERY) { lastSample = now; sample(c); judge(c); badge(); }
    if (st?.missionOver || m?.result) finish(c, st?.missionOver || 'result');
    else if (now - lastSave >= SAVE_EVERY) save();
   }
  }
  requestAnimationFrame(loop);
 }
 // Game getters read the active mission, so finish while they still point at this run.
 addEventListener('clean-hands:before-reset', () => finish(C(), 'abandoned'));
 addEventListener('pagehide', () => finish(C(), 'page closed', true));
 // Leaving the tab (or starting to close it) saves everything while the page can still send a full run.
 document.addEventListener('visibilitychange', () => { if (document.hidden && run && !run.end) save(); });
 Promise.all([fetch('/api/chances' + Q).then(r => r.json()), fetch('/api/schedule' + Q).then(r => r.json())]).then(([j, sch]) => { chances = j; schedule = sch.actors ?? {}; document.body.append(pick, memoBox); openPicker(); badge(); requestAnimationFrame(loop); });
})();
