"""Local, bounded Blender jobs for the outfit lab. No browser-supplied paths/commands."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
import math
from pathlib import Path
import re
import subprocess
import threading
import time
import urllib.parse
import uuid
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
ASSETS=ROOT/'assets/characters'
BLENDER=Path('C:/Program Files/Blender Foundation/Blender 4.2/blender.exe')
POOL=ThreadPoolExecutor(max_workers=1)
CAPACITY=threading.BoundedSemaphore(3)
LOCK=threading.Lock()
JOBS={}
NEW=re.compile(r'^new_[a-f0-9]{32}$')
PREVIEW=re.compile(r'^preview_[a-f0-9]{32}$')
HEX=re.compile(r'^#[0-9a-fA-F]{6}$')


def read(path):return json.loads(path.read_text(encoding='utf-8'))


def recipes():return {p.stem:read(p) for p in (ASSETS/'recipes').glob('*.json')}


def allowed_origin(value):
    if not value:return True
    try:
        url=urllib.parse.urlparse(value)
        port=url.port
    except ValueError:return False
    return url.scheme=='http' and url.hostname in ('127.0.0.1','localhost') and port in (*range(8795,8799),*range(8890,8900))


def reply(h,code,value,mime='application/json; charset=utf-8'):
    body=value if isinstance(value,bytes) else json.dumps(value,ensure_ascii=False).encode()
    h.send_response(code);h.send_header('Content-Type',mime);h.send_header('Content-Length',str(len(body)))
    h.send_header('Cache-Control','no-store')
    origin=h.headers.get('Origin')
    if origin and allowed_origin(origin):
        h.send_header('Access-Control-Allow-Origin',origin);h.send_header('Vary','Origin')
    h.send_header('Access-Control-Allow-Headers','Content-Type, X-Outfit-Lab')
    h.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
    h.end_headers();h.wfile.write(body)


def validate(raw):
    if not isinstance(raw,dict) or raw.get('schemaVersion')!=1 or raw.get('assetMode')!='generated':raise ValueError('生成型のレシピが必要です。固定資産は保存できません。')
    catalog=read(ASSETS/'catalog/catalog.json');parts={p['id']:p for p in catalog['parts']}
    profile=raw.get('body',{}).get('profile')
    if profile not in catalog['bodies'] or raw['body'].get('parameters'):raise ValueError('体型が無効です。')
    if not isinstance(raw.get('parts'),list) or not 1<=len(raw['parts'])<=100:raise ValueError('部品数が無効です。')
    for part in raw['parts']:
        definition=parts.get(part.get('part'))
        if not definition or profile not in definition['bodies']:raise ValueError('体型に合わない部品です。')
        if profile=='cast.female.v1' and part['part']=='cast.chest-details.v1' and part['parameters'].get('kind')!='dress':raise ValueError('この襟元は男性用です。')
        if profile.startswith('pool.') and part['part'].startswith('pool.') and 'kind' in part['parameters'] and (part['part']!='pool.hair.v1' or profile=='pool.variant.strong.v1'):
            expected='resort' if profile=='pool.resort.v1' else 'shorts' if profile in ('pool.shorts.v1','pool.variant.lean.v1') else 'swimsuit'
            if part['parameters']['kind']!=expected:raise ValueError('この部品は体型専用の形です。')
        if set(part)!={'part','mesh','colors','parameters'} or part['mesh'] not in raw['output']['meshOrder']:raise ValueError('部品の形式が無効です。')
        if set(part['colors'])!=set(definition['colors']) or set(part['parameters'])!=set(definition['parameters']):raise ValueError('部品の設定が無効です。')
        if any(type(v) is not int or not 0<=v<=15 for v in part['colors'].values()):raise ValueError('パレット番号が無効です。')
        if any(v not in definition['parameters'][k] for k,v in part['parameters'].items()):raise ValueError('未登録の部品設定です。')
    if raw.get('rig')!='cast.shared22.v1' or len(raw['output']['meshOrder'])>9 or any(x not in ('Head','Body','Legs','Hands','Hair','Details','Face','Outfit','Accessories') for x in raw['output']['meshOrder']):raise ValueError('骨格・メッシュが無効です。')
    operations={json.dumps(op,sort_keys=True) for recipe in recipes().values() for op in recipe.get('specialOperations',[])}
    if profile!='cast.male.v1' and any(op.get('operation','').startswith('dj.') for op in raw.get('specialOperations',[])):raise ValueError('DJの仕立てはキャスト男性用です。')
    if any(json.dumps(op,sort_keys=True) not in operations for op in raw.get('specialOperations',[])):raise ValueError('未登録の処理です。')
    for role,color in raw.get('appearanceColors',{}).items():
        if role not in ('skin','hair','top','pants','outer','shoes','accessories') or not isinstance(color,str) or not HEX.fullmatch(color):raise ValueError('部位の色が無効です。')
    mark=raw.get('surfaceMark')
    if mark:
        if mark['mesh'] not in ('Outfit','Body','Legs','Accessories','Outer','TShirt','Shirt','Jeans','WideJeans','Trousers'):raise ValueError('マークの配置先が無効です。')
        for key in ('point','normal'):
            if len(mark[key])!=3 or any(type(x) not in (int,float) or not math.isfinite(x) or abs(x)>4 for x in mark[key]):raise ValueError('マークの位置が無効です。')
        if abs(math.sqrt(sum(x*x for x in mark['normal']))-1)>.05 or not .03<=mark['size']<=.35 or not -180<=mark['angle']<=180:raise ValueError('マークの寸法が無効です。')
        png=mark['png']
        if not isinstance(png,str) or not png.startswith('data:image/png;base64,'):raise ValueError('PNG画像が必要です。')
        data=base64.b64decode(png.split(',',1)[1],validate=True)
        if len(data)>256*1024:raise ValueError('PNGは256 KB以内です。')
        image=Image.open(io.BytesIO(data))
        if image.format!='PNG' or max(image.size)>2048:raise ValueError('PNGの寸法が大きすぎます。')
        image.verify()
    # Copy only recipe data consumed by the registered builder.
    allowed=('schemaVersion','assetMode','rig','body','identity','palette','parts','specialOperations','output','appearanceColors','surfaceMark','mark')
    return {k:raw[k] for k in allowed if k in raw}


def work(id,recipe):
    try:
        with LOCK:JOBS[id]['state']='running'
        path=ASSETS/'recipes/new'/(id+'.json');path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes((json.dumps(recipe,ensure_ascii=False,indent=2)+'\n').encode())
        run=subprocess.run([str(BLENDER),'-b','--factory-startup','--python-exit-code','1','-P',str(ASSETS/'source/build_recipe.py'),'--',str(path)],cwd=ROOT,capture_output=True,timeout=120,shell=False)
        log=(run.stdout+run.stderr).decode('utf-8',errors='replace')
        (path.parent/(id+'.log')).write_text(log,encoding='utf-8')
        model=ASSETS/'models/new'/id/(id+'.glb')
        if run.returncode or not model.is_file():raise RuntimeError(log[-3000:])
        with LOCK:JOBS[id].update(state='complete',sha256=hashlib.sha256(model.read_bytes()).hexdigest(),modelUrl='/api/outfit/models/'+id,recipeUrl='/api/outfit/recipes/'+id,log=log[-3000:])
    except Exception as exc:
        with LOCK:JOBS[id].update(state='error',error=str(exc))
    finally:CAPACITY.release()


# Live preview (2026-11-12): every change in the outfit lab is built by Blender at once, so the preview is the real
# model. One Blender stays running (assets/characters/source/preview_worker.py); body variants, which patch the pool
# builder for a whole process, get a fresh one. Same recipe, same file: built previews are reused.
VARIANT_BODIES=('pool.variant.slim.v1','pool.variant.lean.v1','pool.variant.strong.v1')
PREVIEW_LOCK=threading.Lock()
PREVIEW_KEEP=300
worker=None


def worker_build(path):
    global worker
    for attempt in (0,1):
        if worker is None or worker.poll() is not None:
            worker=subprocess.Popen([str(BLENDER),'-b','--factory-startup','--python-exit-code','1','-P',str(ASSETS/'source/preview_worker.py')],
                cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,shell=False,text=True,encoding='utf-8',errors='replace',bufsize=1)
            for line in worker.stdout:
                if line.startswith('WORKER_READY'):break
        try:
            worker.stdin.write(str(path)+'\n');worker.stdin.flush()
            for line in worker.stdout:
                if line.startswith('WORKER_DONE '):return
                if line.startswith('WORKER_ERROR '):raise RuntimeError(line[13:].strip())
        except (BrokenPipeError,OSError):pass
        worker=None
    raise RuntimeError('プレビューの Blender が止まりました。')


def preview(recipe):
    recipe={k:v for k,v in recipe.items() if k not in ('surfaceMark','mark')}
    key=hashlib.sha256(json.dumps(recipe,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:32]
    id='preview_'+key;recipe.update(id=id,label='preview')
    model=ASSETS/'models/preview'/id/(id+'.glb')
    with PREVIEW_LOCK:
        if not model.is_file():
            path=ASSETS/'recipes/preview'/(id+'.json');path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes((json.dumps(recipe,ensure_ascii=False,indent=2)+'\n').encode())
            if recipe['body']['profile'] in VARIANT_BODIES:
                run=subprocess.run([str(BLENDER),'-b','--factory-startup','--python-exit-code','1','-P',str(ASSETS/'source/build_recipe.py'),'--',str(path)],cwd=ROOT,capture_output=True,timeout=120,shell=False)
                if run.returncode or not model.is_file():raise RuntimeError((run.stdout+run.stderr).decode('utf-8',errors='replace')[-1500:])
            else:worker_build(path)
            old=sorted((ASSETS/'models/preview').iterdir(),key=lambda d:d.stat().st_mtime)
            for folder in old[:-PREVIEW_KEEP]:
                for f in folder.iterdir():f.unlink()
                folder.rmdir();(ASSETS/'recipes/preview'/(folder.name+'.json')).unlink(missing_ok=True)
        else:model.parent.touch()
    return {'id':id,'modelUrl':'/api/outfit/models/'+id}


def handle(h,method):
    path=urllib.parse.urlparse(h.path).path
    if not path.startswith('/api/outfit/'):return False
    host=urllib.parse.urlparse('//'+h.headers.get('Host','')).hostname
    if h.client_address[0] not in ('127.0.0.1','::1') or host not in ('127.0.0.1','localhost') or not allowed_origin(h.headers.get('Origin')):
        reply(h,403,{'error':'localhostのみ利用できます。'});return True
    if method=='OPTIONS':reply(h,200,{});return True
    try:
        known=recipes()
        if method=='GET' and path=='/api/outfit/catalog':
            result=read(ROOT/'investigation/outfit-overhaul/stage3-verification.json')
            reply(h,200,{'catalog':read(ASSETS/'catalog/catalog.json'),'recipes':known,'newRecipes':{p.stem:read(p) for p in (ASSETS/'recipes/new').glob('*.json') if NEW.fullmatch(p.stem) and (ASSETS/'models/new'/p.stem/(p.stem+'.glb')).is_file()},'results':{x['id']:x['classification'] for x in result['assets']}})
        elif method=='GET' and path.startswith('/api/outfit/jobs/'):
            id=path.rsplit('/',1)[1]
            with LOCK:job=dict(JOBS.get(id,{}))
            reply(h,200 if job else 404,job or {'error':'ジョブが見つかりません。'})
        elif method=='GET' and path.startswith(('/api/outfit/models/','/api/outfit/recipes/')):
            id=path.rsplit('/',1)[1];model='/models/' in path
            if NEW.fullmatch(id):
                file=ASSETS/'models/new'/id/(id+'.glb') if model else ASSETS/'recipes/new'/(id+'.json')
            elif PREVIEW.fullmatch(id):
                file=ASSETS/'models/preview'/id/(id+'.glb') if model else ASSETS/'recipes/preview'/(id+'.json')
            elif id in known:
                recipe=known[id]
                if recipe['assetMode']=='alias':recipe=known[recipe['aliasOf']]
                file=(ROOT/recipe['source']) if model and recipe['assetMode']=='fixed' else ASSETS/'models'/recipe['id']/(recipe['id']+'.glb') if model else ASSETS/'recipes'/(id+'.json')
            else:raise ValueError('不明なキャラクターです。')
            if not file.is_file():reply(h,404,{'error':'まだ作成されていません。'})
            else:reply(h,200,file.read_bytes(),'model/gltf-binary' if model else 'application/json; charset=utf-8')
        elif method=='POST' and path=='/api/outfit/preview':
            if h.headers.get('X-Outfit-Lab')!='1':reply(h,403,{'error':'専用ヘッダーが必要です。'});return True
            length=int(h.headers.get('Content-Length','0'))
            if not 0<length<=768*1024:raise ValueError('レシピが大きすぎます。')
            reply(h,200,preview(validate(json.loads(h.rfile.read(length)).get('recipe'))))
        elif method=='POST' and path=='/api/outfit/jobs':
            if h.headers.get('X-Outfit-Lab')!='1':reply(h,403,{'error':'専用ヘッダーが必要です。'});return True
            length=int(h.headers.get('Content-Length','0'))
            if not 0<length<=768*1024:raise ValueError('レシピが大きすぎます。')
            raw=json.loads(h.rfile.read(length));recipe=validate(raw.get('recipe'))
            name=raw.get('name','新しいキャラ')
            if not isinstance(name,str) or not 1<=len(name)<=60:raise ValueError('名前は60文字以内です。')
            if not CAPACITY.acquire(blocking=False):reply(h,429,{'error':'作成中です。少し待ってから保存してください。'});return True
            id='new_'+uuid.uuid4().hex;recipe.update(id=id,label=name)
            with LOCK:JOBS[id]={'id':id,'name':name,'state':'queued','createdAt':time.time()}
            POOL.submit(work,id,recipe);reply(h,202,{'id':id,'state':'queued'})
        else:reply(h,404,{'error':'不明な操作です。'})
    except (ValueError,KeyError,TypeError,AttributeError) as exc:reply(h,400,{'error':str(exc)})
    except Exception as exc:reply(h,500,{'error':str(exc)})
    return True
