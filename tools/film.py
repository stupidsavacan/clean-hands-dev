"""Start the movie page in a headless Chrome (tools/stage-server.py must be running).

  python tools/film.py "run=1"                 every take of run 1 -> movie/frames/<take>/
  python tools/film.py "run=2&only=valve"      one take
Progress is written to movie/capture.log; the last line is "done".
"""
import subprocess, sys, tempfile, uuid
from pathlib import Path

query = sys.argv[1] if len(sys.argv) > 1 else 'run=1'
profile = Path(tempfile.gettempdir()) / ('obs-trailer-' + uuid.uuid4().hex[:8])
subprocess.Popen([r'C:\Program Files\Google\Chrome\Application\chrome.exe', '--headless=new', '--window-size=1920,1080',
                  f'--user-data-dir={profile}', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
                  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
                  f'http://127.0.0.1:8806/observatory-trailer.html?{query}'],
                 creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)
print('filming', query)
