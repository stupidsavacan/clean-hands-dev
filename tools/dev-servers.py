"""CLEAN HANDS: every local check server in one process (start-dev.bat starts this). Localhost only.

  8795  the games with the recorder (F8 notes, F9 debug)  /  /party  /club  /ai-lab /animation-lab /item-lab /map-lab /ui-lab
        and the saved runs /runs  /memos  (playtest/server.py)
  8796  this folder as files: /club-prototype.html, /animation-lab.html, /map-lab.html ...
  8797  saves a picture posted from a lab page: POST /save?name=x with a PNG data URL -> playtest/shots/x.png
  8798  the same files as 8796, but pages keep drawing while the browser pane is hidden
        (requestAnimationFrame runs on a timer)

  The map lab (8795/map-lab) reads and saves the club through 8795:
    GET  /api/map-layout?map=club   -> {"layout": club-layout.json, "devices": club-mission.json devices}
    POST /api/map-layout?map=club   (header X-Map-Lab: 1) the same shape: writes both files, rebuilds club-map.json
                                    and the club page, and answers {"ok", "log"}.
"""
import base64, json, os, re, subprocess, sys, threading, urllib.parse
from http.server import SimpleHTTPRequestHandler, BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'playtest' / 'shots'
HOST = '127.0.0.1'
sys.path.insert(0, str(ROOT / 'playtest'))
import server as playtest  # noqa: E402
import outfit_service

RAF = (b'<script>window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),33);'
       b'window.cancelAnimationFrame=id=>clearTimeout(id);</script>')


DATA = ROOT / 'app' / 'src' / 'data'
MAPS = {'club': ('club-layout.json', 'club-mission.json')}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    # The club files are written by investigation/build-club-source.py: one-space indent, CRLF.
    text = json.dumps(value, ensure_ascii=False, indent=1) + '\n'
    path.write_bytes(text.replace('\n', '\r\n').encode('utf-8'))


def run(args, cwd):
    r = subprocess.run(args, cwd=str(cwd), capture_output=True, text=True, encoding='utf-8', errors='replace', shell=os.name == 'nt')
    return r.returncode == 0, (r.stdout + r.stderr).strip()


class Playtest(playtest.Handler):
    def map_name(self):
        name = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('map', ['club'])[0]
        return name if name in MAPS else None

    def do_OPTIONS(self):
        if not outfit_service.handle(self, 'OPTIONS'):
            self.send_error(404)

    def do_GET(self):
        if outfit_service.handle(self, 'GET'):
            return
        if urllib.parse.urlparse(self.path).path != '/api/map-layout':
            return super().do_GET()
        if not self.local():
            return
        name = self.map_name()
        if not name:
            return self.send(404, 'unknown map', 'text/plain')
        layout, mission = MAPS[name]
        body = {'layout': read_json(DATA / layout), 'devices': read_json(DATA / mission).get('devices', [])}
        return self.send(200, json.dumps(body, ensure_ascii=False), 'application/json; charset=utf-8')

    def do_POST(self):
        if outfit_service.handle(self, 'POST'):
            return
        if urllib.parse.urlparse(self.path).path != '/api/map-layout':
            return super().do_POST()
        if not self.local():
            return
        name = self.map_name()
        if not name or self.headers.get('X-Map-Lab') != '1':
            return self.send(404, 'not found', 'text/plain')
        try:
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])).decode('utf-8'))
            layout, devices = body['layout'], body['devices']
            if not isinstance(layout, dict) or not isinstance(devices, list) or not isinstance(layout.get('rooms'), list):
                raise ValueError('layout')
        except Exception:
            return self.send(400, 'bad layout', 'text/plain')
        layout_file, mission_file = MAPS[name]
        # Marks the layout as edited here, so build-club-source.py does not silently write over it.
        layout['editedInMapLab'] = True
        write_json(DATA / layout_file, layout)
        mission = read_json(DATA / mission_file)
        if mission.get('devices') != devices:
            mission['devices'] = devices
            write_json(DATA / mission_file, mission)
        log = []
        ok, out = run(['node', '--experimental-strip-types', '--no-warnings', 'scripts/build-club.ts'], ROOT / 'app')
        log.append(out)
        if ok:
            ok, out = run(['node', 'scripts/build-all.mjs', name], ROOT / 'app')
            log.append(out)
        return self.send(200 if ok else 500, json.dumps({'ok': ok, 'log': '\n'.join(log)}, ensure_ascii=False), 'application/json; charset=utf-8')


class Files(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


class AlwaysDrawing(Files):
    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        file = (ROOT / path.lstrip('/')).resolve()
        if file.suffix == '.html' and file.is_file() and ROOT in file.parents:
            page = file.read_bytes()
            page = re.sub(rb'<head>', b'<head>' + RAF, page, count=1) if b'<head>' in page else RAF + page
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(page)))
            self.end_headers()
            self.wfile.write(page)
            return
        super().do_GET()


class Saver(BaseHTTPRequestHandler):
    def cors(self, code):
        self.send_response(code)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_OPTIONS(self):
        self.cors(204)

    def do_POST(self):
        name = os.path.basename(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('name', ['shot'])[0]) or 'shot'
        data = self.rfile.read(int(self.headers['Content-Length'])).decode()
        SHOTS.mkdir(parents=True, exist_ok=True)
        (SHOTS / (name + '.png')).write_bytes(base64.b64decode(data.split(',', 1)[1]))
        self.cors(200)
        self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


class Server(ThreadingHTTPServer):
    # On Windows a reused address lets a second server bind the same port silently, and the older one keeps answering.
    allow_reuse_address = False


def serve(port, handler):
    try:
        server = Server((HOST, port), handler)
    except OSError:
        print(f'  {port}: すでに使われています（前に起動したものが動いていればそのままで大丈夫です）')
        return None
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


if __name__ == '__main__':
    started = [serve(playtest.PORT, Playtest), serve(8796, Files), serve(8797, Saver), serve(8798, AlwaysDrawing)]
    if not any(started):
        print('すべてのサーバーは、もう動いています。下のアドレスを開いてください。')
    print('CLEAN HANDS 確認用サーバー（このウィンドウを閉じると止まります）' if any(started) else 'CLEAN HANDS 確認用サーバー')
    print(f'  8795  記録つきで遊ぶ  http://{HOST}:8795/club   記録の一覧 http://{HOST}:8795/runs')
    print(f'        マップ編集    http://{HOST}:8795/map-lab')
    print(f'  8796  ページ         http://{HOST}:8796/club-prototype.html  /animation-lab.html  /map-lab.html')
    print(f'  8797  画像の保存先    {SHOTS}')
    print(f'  8798  描画を止めない  http://{HOST}:8798/animation-lab.html')
    if not any(started):
        sys.exit(0)
    threading.Event().wait()
