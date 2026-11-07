"""CLEAN HANDS playtest server (localhost only).

Serves the current single-file game (../index.html) with the recorder (playtest.js) added, and saves each run's
record as JSON in runs/. Nothing is sent anywhere else.

  python server.py            -> http://127.0.0.1:8795/
  /           the game with the recorder
  /runs       the saved runs, newest first
  /runs/<id>.json             one run
  /memos      every F8 note, newest first, with its picture
"""
import json, os, re, sys, html, datetime, base64
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from threading import Lock

HERE = Path(__file__).resolve().parent
GAME = HERE.parent / 'index.html'
PARTY = HERE.parent / 'party-prototype.html'  # the party prototype map, served at /party
CLUB = HERE.parent / 'club-prototype.html'
DATA = HERE.parent / 'app' / 'src' / 'data'
RUNS = HERE / 'runs'
HOST, PORT = '127.0.0.1', int(os.environ.get('PLAYTEST_PORT', '8795'))
ID = re.compile(r'^[0-9]{8}-[0-9]{6}_[a-z0-9_-]{1,40}$')
RUNS.mkdir(exist_ok=True)
CLUB_SAVE = Lock()
DISCARDED = set()  # runs dropped because the debug panel was used


WHY = {'page closed': '途中で閉じた', 'abandoned': '途中でやり直した', 'result': '終了'}
REASON = {'caught': '捕まった', 'killed': '倒された', 'target_escaped': '標的が逃げた'}


def outcome(end):
    if not end:
        return '記録中（または終わり方が保存されていない）'
    o = end.get('outcome')
    if isinstance(o, dict):
        return '成功（脱出）' if o.get('success') else '失敗：' + REASON.get(o.get('reason'), str(o.get('reason')))
    return WHY.get(end.get('why'), str(o or end.get('why') or ''))


def local_time(iso):
    try:
        return datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone().strftime('%m/%d %H:%M')
    except Exception:
        return iso


def summary(run):
    m = run.get('meta', {})
    end = run.get('end') or {}
    res = end.get('result') or {}
    v = run.get('verdict')
    if v and not res:  # a chance run: judged when its target died
        res = {'ghost': v.get('ghost'), 'ghostBrokenBy': v.get('ghostBrokenBy'), 'rank': ('成立・' if v.get('chanceComplete') else 'チャンス外・') + {'accident': '事故', 'murder': '殺人', 'combat': '戦闘'}.get(v.get('judgement'), str(v.get('judgement') or '?'))}
    kills = [f"{k.get('victim')}:{(k.get('judgement') or {}).get('kind', '')}" for k in end.get('kills') or []]
    return {
        'scenario': m.get('scenarioTitle', ''), 'started': local_time(m.get('startedAt', '')),
        'seconds': round((run.get('samples') or [{}])[-1].get('play', 0)) if run.get('samples') else 0,
        'outcome': outcome(end), 'rank': res.get('rank', ''),
        'ghost': res.get('ghost'), 'broken': ','.join(res.get('ghostBrokenBy') or []),
        'events': len(run.get('events') or []), 'kills': ' '.join(kills), 'memos': len(run.get('memos') or []),
    }


STYLE = ('<style>body{font:14px system-ui,"Yu Gothic UI",sans-serif;margin:24px;background:#f3efe6;color:#15171b}'
         'table{border-collapse:collapse;width:100%}td,th{border:1px solid #d6d0c2;padding:4px 8px;text-align:left;vertical-align:top}'
         'th{background:#e8e2d4}img{max-width:420px;width:100%;border-radius:4px}.tag{display:inline-block;background:#ffd36b;color:#15171b;border-radius:999px;padding:0 8px;margin:0 4px 2px 0;font-size:12px}'
         '.note{font-size:15px;white-space:pre-wrap;margin:4px 0}small{color:#6b675e}'
         '@media(prefers-color-scheme:dark){body{background:#121517;color:#ece8df}td,th{border-color:#33393d}th{background:#1a1e21}a{color:#4fc1b2}small{color:#9a958a}}</style>')


def memo_rows():
    rows = []
    for p in sorted(RUNS.glob('*.json'), reverse=True):
        try:
            run = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        title = run.get('meta', {}).get('scenarioTitle', '')
        for m in reversed(run.get('memos') or []):
            st = m.get('state') or {}
            clock = m.get('clock') or 0
            near = sorted(m.get('near') or [], key=lambda n: n.get('dist', 99))[:5]
            near_text = '、'.join(f"{n.get('label')} {n.get('dist')}m" + ('（見ている）' if n.get('seen') else '') for n in near) or 'なし'
            pos = st.get('pos') or {}
            state = (f"{m.get('floorLabel', st.get('floor', '?'))} ({pos.get('x', '?')}, {pos.get('z', '?')})　服：{m.get('disguiseLabel', st.get('disguise', ''))}"
                     + (f"　手：{st.get('held')}" if st.get('held') else '') + f"　警戒度 {st.get('alert', '')}　疑惑 {st.get('suspicion', 0)}")
            recent = ' / '.join(e.get('type', '') + (':' + str(e.get('id')) if e.get('id') else '') for e in (m.get('recent') or [])[-5:])
            shot = f'<a href="/runs/{m["shot"]}"><img src="/runs/{m["shot"]}" alt=""></a>' if m.get('shot') else ''
            rows.append('<tr>'
                        f'<td>{shot}</td>'
                        f'<td><b>{html.escape(title)}</b>　{int(clock)//60}:{int(clock)%60:02d}　<small>メモ {m.get("n")}</small><br>'
                        + ''.join(f'<span class="tag">{html.escape(t)}</span>' for t in m.get('tags') or [])
                        + f'<div class="note">{html.escape(m.get("text") or "")}</div>'
                        f'<small>{html.escape(state)}<br>近くの人：{html.escape(near_text)}<br>直前：{html.escape(recent)}</small><br>'
                        f'<small><a href="/runs/{p.name}">{p.name}</a></small></td></tr>')
    return rows


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (datetime.datetime.now().strftime('%H:%M:%S'), fmt % args))

    def send(self, code, body, ctype):
        raw = body if isinstance(body, bytes) else body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def local(self):
        # Only pages from this server may post (no other site in the browser can write files here).
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        ok = host in (f'{HOST}:{PORT}', f'localhost:{PORT}') and (origin is None or origin in (f'http://{HOST}:{PORT}', f'http://localhost:{PORT}'))
        if not ok:
            self.send(403, 'forbidden', 'text/plain')
        return ok

    def do_GET(self):
        if not self.local():
            return
        path = self.path.split('?')[0]
        party = 'map=party' in self.path
        club = 'map=club' in self.path
        if path in ('/', '/index.html', '/party', '/party.html', '/club', '/club.html'):
            page = (CLUB if path.startswith('/club') else PARTY if path.startswith('/party') else GAME).read_text(encoding='utf-8')
            tag = '<script src="/playtest.js"></script><script src="/debug.js"></script>'
            page = page.replace('</body>', tag + '</body>') if '</body>' in page else page + tag
            return self.send(200, page, 'text/html; charset=utf-8')
        # The two lab stages (2026-11-04): plain pages, no play recording.
        if path in ('/ai-lab', '/animation-lab', '/item-lab'):
            return self.send(200, (HERE.parent / (path[1:] + '.html')).read_text(encoding='utf-8'), 'text/html; charset=utf-8')
        if path in ('/playtest.js', '/debug.js'):
            return self.send(200, (HERE / path[1:]).read_bytes(), 'text/javascript; charset=utf-8')
        if path in ('/api/chances', '/api/schedule', '/api/actions'):
            name = path.rsplit('/', 1)[1] + '.json'
            if club:
                name = 'club-' + name
            elif party:
                name = 'party-' + name
            if not (DATA / name).is_file():
                return self.send(404, 'not found', 'text/plain')
            return self.send(200, (DATA / name).read_bytes(), 'application/json; charset=utf-8')
        if path == '/runs':
            rows = []
            for p in sorted((p for p in RUNS.glob('*.json') if ID.fullmatch(p.stem)), reverse=True):
                try:
                    s = summary(json.loads(p.read_text(encoding='utf-8')))
                except Exception as e:  # a half-written file shows as broken, not as a crash
                    s = {'scenario': f'（読めない：{e}）'}
                ghost = '' if s.get('ghost') is None else ('○' if s['ghost'] else '×')
                rows.append('<tr>' + ''.join(f'<td>{html.escape(str(v))}</td>' for v in [
                    s.get('started', ''), s.get('scenario', ''), f"{s.get('seconds', 0)//60}:{s.get('seconds', 0)%60:02d}",
                    s.get('outcome', ''), s.get('rank', ''), ghost, s.get('broken', ''), s.get('kills', ''), s.get('events', ''), s.get('memos', '') or ''
                ]) + f'<td><a href="/runs/{p.name}">{p.name}</a></td></tr>')
            page = ('<!doctype html><meta charset="utf-8"><title>プレイテストの記録</title>' + STYLE +
                    f'<h1>プレイテストの記録（{len(rows)}件）</h1><p>保存先：{html.escape(str(RUNS))}</p><p><a href="/">ゲームへ</a>　<a href="/memos">メモの一覧</a></p>'
                    '<table><tr><th>開始</th><th>シナリオ</th><th>時間</th><th>結果</th><th>ランク</th><th>ゴースト</th><th>崩れた理由</th><th>倒した人</th><th>出来事</th><th>メモ</th><th>ファイル</th></tr>'
                    + ''.join(rows) + '</table>')
            return self.send(200, page, 'text/html; charset=utf-8')
        if path == '/memos':
            rows = memo_rows()
            page = ('<!doctype html><meta charset="utf-8"><title>プレイテストのメモ</title>' + STYLE +
                    f'<h1>プレイテストのメモ（{len(rows)}件）</h1><p><a href="/">ゲームへ</a>　<a href="/runs">記録の一覧</a></p>'
                    '<table><tr><th>F8を押したときの画面</th><th>メモとそのときの状態</th></tr>' + ''.join(rows) + '</table>')
            return self.send(200, page, 'text/html; charset=utf-8')
        if path in ('/runs/crowd-analysis.json', '/runs/crowd-analysis.svg') and (RUNS / Path(path).name).is_file():
            return self.send(200, (RUNS / Path(path).name).read_bytes(), 'image/svg+xml' if path.endswith('.svg') else 'application/json')
        m = re.fullmatch(r'/runs/([0-9A-Za-z_-]+\.(json|jpg))', path)
        if m and (RUNS / m.group(1)).is_file():
            return self.send(200, (RUNS / m.group(1)).read_bytes(), 'application/json; charset=utf-8' if m.group(2) == 'json' else 'image/jpeg')
        self.send(404, 'not found', 'text/plain')

    def save_club(self, rid, body):
        path = RUNS / (rid + '.json')
        with CLUB_SAVE:
            if rid in DISCARDED:
                return self.send(410, 'discarded', 'text/plain')
            old = json.loads(path.read_text(encoding='utf-8')) if path.is_file() else None
            if self.path == '/api/end':
                run = old or {'meta': body['meta'], 'events': [], 'samples': [], 'telemetry': []}
                run['end'] = body['end']
                rows = run.setdefault('telemetry', [])
                start = body.get('from', 0)
                if 0 <= start <= len(rows):
                    rows.extend(body.get('telemetry', [])[len(rows)-start:])
            else:
                run = body
                if old:
                    if len(old.get('telemetry', [])) > len(run.get('telemetry', [])):
                        run['telemetry'] = old['telemetry']
                    if old.get('end') and not run.get('end'):
                        run['end'] = old['end']
            tmp = path.with_suffix('.json.tmp')
            tmp.write_text(json.dumps(run, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            os.replace(tmp, path)
        return self.send(200, json.dumps({'saved': path.name}), 'application/json')

    def do_POST(self):
        if not self.local():
            return
        if self.path not in ('/api/run', '/api/end', '/api/shot', '/api/discard') or self.headers.get('X-Playtest') != '1':
            return self.send(404, 'not found', 'text/plain')
        length = int(self.headers.get('Content-Length') or 0)
        if length > 50_000_000:
            return self.send(413, 'too large', 'text/plain')
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            rid = body['meta']['id'] if self.path == '/api/run' else body['id']
            assert ID.fullmatch(rid)
            if '_club-' in rid and self.path in ('/api/run', '/api/end'):
                return self.save_club(rid, body)
            if self.path == '/api/discard':  # the debug panel was used: delete the run and its pictures
                DISCARDED.add(rid)
                for f in [RUNS / (rid + '.json'), *RUNS.glob(rid + '_memo*.jpg')]:
                    f.unlink(missing_ok=True)
                return self.send(200, '{}', 'application/json')
            if rid in DISCARDED:  # a save that was already on its way
                return self.send(410, 'discarded', 'text/plain')
            if self.path == '/api/shot':  # the picture taken with an F8 note
                n = int(body['n'])
                head, data = body['data'].split(',', 1)
                assert head == 'data:image/jpeg;base64' and 0 < n < 10000
                name = f'{rid}_memo{n}.jpg'
                (RUNS / name).write_bytes(base64.b64decode(data))
                return self.send(200, json.dumps({'saved': name}), 'application/json')
            if self.path == '/api/run':
                run = body
            else:  # the ending sent by a closing page, added to the run saved a few seconds earlier
                run = json.loads((RUNS / (rid + '.json')).read_text(encoding='utf-8'))
                run['end'] = body['end']
        except Exception:
            return self.send(400, 'bad run', 'text/plain')
        tmp = RUNS / (rid + '.json.tmp')
        tmp.write_text(json.dumps(run, ensure_ascii=False, indent=1), encoding='utf-8')
        os.replace(tmp, RUNS / (rid + '.json'))
        self.send(200, json.dumps({'saved': rid + '.json'}), 'application/json')


if __name__ == '__main__':
    if not GAME.is_file():
        sys.exit(f'ゲームが見つかりません: {GAME}')
    print(f'CLEAN HANDS プレイテスト: http://{HOST}:{PORT}/  （記録の一覧: http://{HOST}:{PORT}/runs ）')
    print(f'記録の保存先: {RUNS}')
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
