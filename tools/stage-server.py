"""This worktree's pages on their own port, so the main checkout's servers (8795-8798) stay as they are.

  python tools/stage-server.py        ->  http://127.0.0.1:8806/observatory.html
  http://127.0.0.1:8806/raf/observatory.html   the same page, but it keeps drawing while the browser pane is hidden
                                               (requestAnimationFrame runs on a timer, like port 8798)
  The movie page (observatory-trailer.html) posts its pictures here:
    POST /movie/frame?take=aerial&n=00012   a JPEG -> movie/frames/aerial/00012.jpg
    POST /movie/log                         a line -> movie/capture.log
Localhost only.
"""
import re
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOVIE = ROOT / 'movie'
RAF = (b'<script>window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),33);'
       b'window.cancelAnimationFrame=id=>clearTimeout(id);</script>')
NAME = re.compile(r'^[a-z0-9-]{1,32}$')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if not self.path.startswith('/raf/'):
            return super().do_GET()
        name = self.path[5:].split('?')[0]
        page = ROOT / name
        if '/' in name or '\\' in name or not name.endswith('.html') or not page.is_file():
            return self.send_error(404)
        body = page.read_bytes().replace(b'<head>', b'<head>' + RAF, 1)
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(url.query)
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        if self.client_address[0] != '127.0.0.1':
            return self.send_error(403)
        if url.path == '/movie/log':
            MOVIE.mkdir(exist_ok=True)
            with open(MOVIE / 'capture.log', 'a', encoding='utf-8') as f:
                f.write(body.decode('utf-8', 'replace') + '\n')
        elif url.path == '/movie/frame':
            take, n = query.get('take', [''])[0], query.get('n', [''])[0]
            if not NAME.match(take) or not n.isdigit() or len(body) > 30_000_000:
                return self.send_error(400)
            folder = MOVIE / 'frames' / take
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f'{n}.jpg').write_bytes(body)
        else:
            return self.send_error(404)
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print('http://127.0.0.1:8806/observatory.html')
    ThreadingHTTPServer(('127.0.0.1', 8806), Handler).serve_forever()
