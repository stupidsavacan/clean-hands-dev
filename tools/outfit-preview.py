"""Own-port outfit lab preview; does not start or stop the shared servers."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import outfit_service

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k):super().__init__(*a,directory=str(outfit_service.ROOT),**k)
    def do_GET(self):
        if outfit_service.handle(self,'GET'):return
        if self.path in ('/','/outfit-lab'):self.path='/outfit-lab.html'
        super().do_GET()
    def do_POST(self):
        if not outfit_service.handle(self,'POST'):self.send_error(404)
    def do_OPTIONS(self):
        if not outfit_service.handle(self,'OPTIONS'):self.send_error(404)
    def end_headers(self):
        self.send_header('Cache-Control','no-store');super().end_headers()
    def log_message(self,*a):pass

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8891);args=parser.parse_args()
    if not 8890<=args.port<=8899:parser.error('Use an own port in 8890..8899')
    ThreadingHTTPServer.allow_reuse_address=False
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
