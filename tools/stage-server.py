"""This worktree's pages on their own port, so the main checkout's servers (8795-8798) stay as they are.

  python tools/stage-server.py        ->  http://127.0.0.1:8806/observatory.html
  http://127.0.0.1:8806/raf/observatory.html   the same page, but it keeps drawing while the browser pane is hidden
                                               (requestAnimationFrame runs on a timer, like port 8798)
Localhost only.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAF = (b'<script>window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),33);'
       b'window.cancelAnimationFrame=id=>clearTimeout(id);</script>')


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
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print('http://127.0.0.1:8806/observatory.html')
    ThreadingHTTPServer(('127.0.0.1', 8806), Handler).serve_forever()
