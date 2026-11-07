"""Design artifacts only. Run: python investigation/draw-party-v2-design.py.
All geometry, tables and PNGs share these definitions. No game files are written.
"""
from pathlib import Path
from collections import Counter
import math, json
from PIL import Image, ImageDraw, ImageFont

P = Path(__file__).resolve().parent
zones = [
 ('V','正門前',0,'public',[(0,0,60,6)]),
 ('C','搬入路',0,'staff',[(0,6,10,36)]),
 ('J','作業小屋',0,'staff',[(0,36,10,45)]),
 ('H','玄関',0,'public',[(10,6,30,16)]),
 ('D','食堂',0,'public',[(30,6,50,16)]),
 ('N','温室',0,'public',[(50,6,60,24)]),
 ('K','厨房',0,'staff',[(10,16,20,30)]),
 ('S','使用人室',0,'staff',[(10,30,20,40)]),
 ('B','舞踏室',0,'public',[(20,16,50,26),(20,26,30,36),(40,26,50,36)]),
 ('P','光庭',0,'public',[(30,26,40,36)]),
 ('G','庭',0,'public',[(20,36,50,45),(10,40,20,45),(50,24,60,45)]),
 ('W','セラー',-1,'staff',[(10,16,20,30)]),
 ('T','地下通路',-1,'staff',[(10,30,30,40)]),
 ('R','招待客回廊',1,'public',[(20,6,50,12)]),
 ('U','使用人回廊',1,'staff',[(10,12,20,40),(20,12,50,16)]),
 ('Q','客室',1,'secure',[(20,16,30,26)]),
 ('O','書斎',1,'secure',[(30,16,40,26)]),
 ('M','主寝室',1,'secure',[(40,16,50,26)]),
 ('L','外縁',1,'outer',[(20,26,50,28)]),
]
Z={z[0]:z for z in zones}
# Door endpoints are horizontal (x,z). Width is the clear opening after wall thickness.
doors=[
 ('01','V','H',(23,6),(27,6),'正門検査'),
 ('02','V','C',(3,6),(5,6),'制服検問'),
 ('03','C','J',(4,36),(6,36),'搬入'),
 ('04','C','K',(10,20),(10,22),'荷物口'),
 ('05','C','S',(10,33),(10,35),'裏口'),
 ('06','J','G',(10,41),(10,43),'庭道'),
 ('07','H','D',(30,9),(30,12),'来客'),
 ('08','H','K',(13,16),(15,16),'厨房口'),
 ('09','H','B',(24,16),(27,16),'舞踏室正面'),
 ('10','D','B',(43,16),(46,16),'食堂側'),
 ('11','D','N',(50,10),(50,13),'温室側'),
 ('12','N','G',(54,24),(57,24),'庭側'),
 ('13','K','S',(12,30),(14,30),'裏の環'),
 ('14','K','B',(20,23),(20,25),'配膳'),
 ('15','S','B',(20,32),(20,34),'片付け'),
 ('16','S','G',(14,40),(16,40),'庭裏'),
 ('17','B','G',(43,36),(46,36),'庭正面'),
 ('18','B','P',(30,29),(30,32),'光庭西'),
 ('19','P','G',(33,36),(37,36),'光庭北'),
 ('20','W','T',(16,30),(18,30),'地下連絡'),
 ('21','R','U',(33,12),(35,12),'私邸入口検問'),
 ('22','U','Q',(23,16),(25,16),'客室口'),
 ('23','U','O',(33,16),(35,16),'書斎口'),
 ('24','U','M',(43,16),(45,16),'寝室口'),
 ('25','Q','O',(30,19),(30,21),'続き間'),
 ('26','O','M',(40,21),(40,23),'続き間'),
]
# points use (x,y,z), with floor height 3.5m.
stairs=[
 ('S1','H','R',(16,0,10),(24,3.5,10),2),
 ('S2','D','R',(36,0,8),(44,3.5,8),2),
 ('S3','W','K',(14,-3.5,18),(14,0,26),2),
 ('S4','T','S',(12,-3.5,32),(12,0,38),2),
 ('S5','S','U',(16,0,32),(16,3.5,38),1.6),
]
traversals=[
 ('X1','V','C',(1,0,4),(1,0,9),7,'塀越え',[(1,2.5,5.5),(1,2.5,6.5)]),
 ('X2','C','T',(8,0,32),(22,-3.5,34),8,'地下搬入口',[(8,-3.5,32),(8,-3.5,30.8),(22,-3.5,30.8)]),
 ('X3','G','L',(48,0,39),(48,3.5,27),7,'雨どいと庇',[(48,3.5,39)]),
 ('X4','S','U',(18.5,0,37),(18.5,3.5,35),5,'保守はしご',[(18.5,3.5,37)]),
 ('X5','L','Q',(25,3.5,27),(25,3.5,24),3,'窓',[(25,4.8,26.5),(25,4.8,25.5)]),
 ('X6','L','O',(35,3.5,27),(35,3.5,24),3,'窓',[(35,4.8,26.5),(35,4.8,25.5)]),
 ('X7','L','M',(45,3.5,27),(45,3.5,24),3,'窓',[(45,4.8,26.5),(45,4.8,25.5)]),
]
# Furniture: id floor center x,z width,depth,height purpose. Low furniture is NOT full cover.
furniture=[
 ('F01',0,6,10,3,1,2.2,'X1着地を遮る搬入棚'),
 ('F02',0,6,30,1,5,2.2,'地下搬入口の目隠し'),
 ('F03',0,5,40,4,1,2.1,'小屋の道具棚'),
 ('F04',0,21,13,3,1,2.1,'正面から階段裏への視線を切る屏風'),
 ('F05',0,35,13,4,1,1,'食堂の配膳台／低いので立位は見える'),
 ('F06',0,55,17,4,1,2.1,'温室の不透明な鉢棚'),
 ('F07',0,17,21,1,5,2.1,'厨房の洗い場を遮る棚'),
 ('F08',0,14,31,1,1,2.1,'使用人室の更衣区画'),
 ('F09',0,29,21,1,5,2.4,'舞踏室南の飾り壁'),
 ('F10',0,43,21,1,5,2.4,'舞踏室東の飾り壁'),
 ('F11',0,24,30,1,3,2.4,'西翼の折り返し'),
 ('F12',0,46,39,1,5,2.5,'雨どい側の不透明な園芸棚'),
 ('F13',0,48,42,4,1,2.5,'X3待機点の南北視線を切る'),
 ('F14',-1,17,23,1,8,2.2,'ワイン棚／地下迂回'),
 ('F15',-1,23,37,6,1,2.2,'地下の運搬物陰'),
 ('F16',1,30,9,1,4,2.2,'回廊を二つの眺めに分ける屏風'),
 ('F17',1,16,18,1,6,2.2,'西回廊の曲がり'),
 ('F18',1,28,14,1,2,2.2,'私邸検問の西の死角'),
 ('F19',1,39,14,1,2,2.2,'私邸検問の東の死角'),
 ('F20',1,27,21,1,6,2.2,'客室更衣の屏風'),
 ('F21',1,37,21,1,6,2.2,'書斎机と窓を分ける本棚'),
 ('F22',1,42,19,1,4,2.2,'寝室扉と飲み物の間の屏風'),
 ('F23',1,33,10.5,4,.5,2.2,'交代護衛の休憩区画を検問から遮る屏風'),
 ('F24',0,2,6.5,.4,7,3.2,'搬入用の不透明な囲い／X1を固定検問から遮る'),
]
hides=[
 ('H01',0,3,12,'C','搬入員の服取得後に2m運ぶ'),('H02',0,7,42,'J','小屋の作業員と工具'),
 ('H03',0,18,14,'H','階段裏の警備員を隠す'),('H04',0,57,19,'N','温室の巡回を外す'),
 ('H05',0,11,23,'K','厨房の給仕長を一時退避'),('H06',0,14,35,'S','更衣時の気絶者'),
 ('H07',0,22,34,'B','西翼の事故前準備'),('H08',0,51,40,'G','雨どい見張りの退避'),
 ('H09',-1,12,23,'W','ワイン担当の服取得'),('H10',-1,26,36,'T','地下の追跡を避けた収納'),
 ('H11',1,32,7.5,'R','表階段裏の護衛'),('H12',1,12,20,'U','保守員の服'),
 ('H13',1,23,22,'Q','清掃員の服'),('H14',1,32,19,'O','書斎護衛'),
 ('H15',1,47,18,'M','寝室護衛'),
]
items=[
 ('I1',0,3,11,'給仕服','置き服1着。F01裏。搬入員の定時訪問あり'),
 ('I2',1,24,22,'清掃服','Qの更衣棚。侵入して取得する必要あり'),
 ('I3',0,4,39,'スパナ','J、シャンデリア準備に必要'),
 ('I4',-1,12,27,'致死毒','W、持込なしでも取得可／新しい在庫接続が必要'),
 ('I5',1,13,29,'録画機','U、全カメラの記録消去。周囲確認が必要'),
 ('A1',1,19,30,'吊り具','スパナで6秒。Bの吊り具へ届く保守口'),
 ('A2',1,19,33,'落下操作','2秒。見張りと客の退去を確認'),
 ('A3',1,34,22,'書類','4秒。私室侵入は服に依存しない'),
 ('A4',1,36.5,27,'突き落とし','外縁から窓の標的へ2秒'),
 ('A5',1,46,22,'飲み物','毒の仕込み4秒。服による操作禁止なし'),
]
# guard/camera design cones; conservative schematic rays, not runtime AI measurements.
watch=[
 ('G01',0,26,7,270,12,80,'正門／固定'),('G02',0,4,8,270,12,80,'搬入口／固定'),
 ('G03',0,4,25,90,14,90,'西巡回／南北に移動'),('G04',0,48,37,90,14,90,'雨どい／巡回'),
 ('G05',1,34,14,270,12,90,'隊長／護衛の顔を知る'),
 ('G06',1,18,29,270,12,90,'保守回廊／巡回'),
 ('G07',1,34,20,90,12,90,'書斎護衛／時刻で移動'),
 ('G08',1,46,20,90,12,90,'寝室護衛／時刻で移動'),
 ('W01',0,18,24,180,10,90,'給仕長／給仕の顔を知る'),
 ('W02',1,24,20,90,10,90,'清掃責任者／清掃服の顔を知る'),
 ('C1',0,9,19,0,12,70,'カメラ・高さ2.8m'),
 ('C2',1,34,12,90,10,70,'カメラ・床上2.8m'),
 ('C3',1,15,30,270,10,70,'カメラ・床上2.8m'),
]
checkpoints=[('CP1','01',(23,0,6),(27,0,6),(26,0,7),'G01','身体検査。銃・毒を持込まない'),('CP2','02',(3,0,6),(5,0,6),(4,0,8),'G02','給仕・清掃・警備・護衛'),('CP3','21',(33,3.5,12),(35,3.5,12),(34,3.5,14),'G05','職員服。私室の許可は別')]

def inside(x,z,r): return r[0]<=x<=r[2] and r[1]<=z<=r[3]
def inz(x,z,k): return any(inside(x,z,r) for r in Z[k][4])
# Generate union outlines on integer metre lattice, merge collinear segments, then subtract openings.
def boundary(rects):
 c=Counter()
 for x1,z1,x2,z2 in rects:
  for x in range(x1,x2): c[('x',z1,x)]+=1;c[('x',z2,x)]+=1
  for z in range(z1,z2): c[('z',x1,z)]+=1;c[('z',x2,z)]+=1
 return {e for e,n in c.items() if n%2}
edges={}
for k,name,f,typ,rects in zones:
 for axis,fixed,t in boundary(rects): edges.setdefault((f,axis,fixed,t),set()).add(k)
# open courtyard is still bounded by low wall with designated passages; G has perimeter boundary.
for _,a,b,p,q,_ in doors:
 f=Z[a][2];axis='x' if p[1]==q[1] else 'z';fixed=p[1] if axis=='x' else p[0]
 for t in range(int(p[0] if axis=='x' else p[1]),int(q[0] if axis=='x' else q[1])): edges.pop((f,axis,fixed,t),None)
# Traversal window sills (height 1m) remain, distinguish below.
groups={}
for (f,axis,fixed,t),owners in edges.items():
 height=2.8
 if f==0 and owners<=set('VGCP'): height=2.2
 if f==1 and 'L' in owners: height=1.0
 groups.setdefault((f,axis,fixed,','.join(sorted(owners)),height),[]).append(t)
walls=[]
for (f,axis,fixed,owners,height),ts in sorted(groups.items()):
 ts=sorted(ts);start=prev=ts[0]
 for t in ts[1:]+[None]:
  if t is not None and t==prev+1:prev=t;continue
  p=(start,fixed) if axis=='x' else (fixed,start);q=(prev+1,fixed) if axis=='x' else (fixed,prev+1)
  walls.append((f'W{len(walls)+1:03}',f,p,q,.2,height,owners))
  start=prev=t

def table(headers,rows):
 return '\n'.join(['|'+'|'.join(headers)+'|','|'+'|'.join(['---']*len(headers))+'|']+['|'+'|'.join(str(v).replace('\n','<br>') for v in r)+'|' for r in rows])+'\n'

font=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',18)
small=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',14)
title=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',28)
colors={'public':'#e1eee7','staff':'#f7e9d0','secure':'#f3dadd','outer':'#dbeaf4'}
def xy(x,z):return (80+x*22,108+(45-z)*22)
def label(d,p,s,col='#162d3b',offset=(5,-17)):
 x,y=xy(*p);d.text((x+offset[0],y+offset[1]),s,font=small,fill=col,stroke_width=1,stroke_fill='white')
def marker(d,x,z,col,shape='dot'):
 x,y=xy(x,z)
 if shape=='box':d.rectangle((x-5,y-5,x+5,y+5),fill=col)
 else:d.ellipse((x-5,y-5,x+5,y+5),fill=col)
def ray_stop(f,x,z,ang,rad):
 # Design-only plan projection clips at opaque geometry, including high shelves.
 boxes=[]
 for _,wf,p,q,w,h,_ in walls:
  if wf==f and h>=1.8:boxes.append((min(p[0],q[0])-w/2,min(p[1],q[1])-w/2,max(p[0],q[0])+w/2,max(p[1],q[1])+w/2))
 for _,ff,bx,bz,w,dep,h,_ in furniture:
  if ff==f and h>=1.8:boxes.append((bx-w/2,bz-dep/2,bx+w/2,bz+dep/2))
 for i in range(1,int(rad*10)+1):
  r=i/10;px=x+math.cos(ang)*r;pz=z+math.sin(ang)*r
  if any(inside(px,pz,b) for b in boxes):return px,pz
 return x+math.cos(ang)*rad,z+math.sin(ang)*rad
def draw(f,sight=False):
 im=Image.new('RGB',(1600,1260),'#f8fafb');d=ImageDraw.Draw(im)
 nm={-1:'地下',0:'1階',1:'2階'}[f]
 d.text((42,18),f'夜会の私邸 第2版｜{nm}'+(' 視線計画' if sight else ' 配置計画'),font=title,fill='#153247')
 d.text((42,60),'北＝＋z（上）／東＝＋x（右）　1m＝22px　全図共通原点　未実装の設計値',font=font,fill='#425b6b')
 for k,n,zf,typ,rects in zones:
  if zf!=f:continue
  for a,b,c,e in rects:d.rectangle((*xy(a,e),*xy(c,b)),fill=colors[typ])
 for x in range(0,61,5):
  d.line((*xy(x,0),*xy(x,45)),fill='#c7d1d7');d.text((xy(x,45)[0]-8,85),str(x),font=small,fill='#4c6676')
 for z in range(0,46,5):
  d.line((*xy(0,z),*xy(60,z)),fill='#c7d1d7');d.text((43,xy(0,z)[1]-9),str(z),font=small,fill='#4c6676')
 if sight:
  overlay=Image.new('RGBA',im.size);od=ImageDraw.Draw(overlay)
  for id,wf,x,z,ang,rad,fov,n in watch:
   if wf!=f:continue
   pts=[xy(x,z)]+[xy(*ray_stop(f,x,z,math.radians(ang-fov/2+i*fov/40),rad)) for i in range(41)]
   od.polygon(pts,fill=(205,55,45,48) if id.startswith('C') else (212,142,22,50))
  im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB');d=ImageDraw.Draw(im)
 for id,wf,p,q,w,h,own in walls:
  if wf==f:d.line((*xy(*p),*xy(*q)),fill='#243f50' if h>1.1 else '#8499aa',width=4 if h>1.1 else 2)
 if f==1:
  d.line((*xy(20,30),*xy(20,35)),fill='#3ab7c5',width=5)
  label(d,(20,32),'V1', '#007582', (3,3))
 for id,ff,x,z,w,dep,h,n in furniture:
  if ff==f:
   d.rectangle((*xy(x-w/2,z+dep/2),*xy(x+w/2,z-dep/2)),fill='#918778');
   if not sight:label(d,(x,z),id,offset=(3,2))
 for k,n,zf,typ,rects in zones:
  if zf==f:
   a,b,c,e=rects[0];label(d,((a+c)/2,e-1),k+' '+n,offset=(0,0))
 for id,a,b,p,q,n in doors:
  if Z[a][2]==f:
   d.line((*xy(*p),*xy(*q)),fill='#22947b',width=4)
   if not sight:label(d,((p[0]+q[0])/2,(p[1]+q[1])/2),id)
 for id,a,b,p,q,w in stairs:
  if f*3.5 in (p[1],q[1]):
   if p[0]==q[0]: bounds=(p[0]-w/2,min(p[2],q[2]),p[0]+w/2,max(p[2],q[2]))
   else: bounds=(min(p[0],q[0]),p[2]-w/2,max(p[0],q[0]),p[2]+w/2)
   a0,b0,c0,e0=bounds
   d.rectangle((*xy(a0,e0),*xy(c0,b0)),outline='#2874bd',width=3)
   d.line((*xy(p[0],p[2]),*xy(q[0],q[2])),fill='#2874bd',width=3);label(d,((p[0]+q[0])/2,(p[2]+q[2])/2),id+('→' if q[0]>p[0] else '↑' if q[2]>p[2] else '↓'), '#155a98')
 for id,a,b,p,q,sec,kind,via in traversals:
  for pt in (p,q):
   if pt[1]==f*3.5:marker(d,pt[0],pt[2],'#9c4cb1','box');label(d,(pt[0],pt[2]),id,'#823296')
 for id,hf,x,z,area,n in hides:
  if hf==f and not sight:marker(d,x,z,'#24764b','box');label(d,(x,z),id,'#24764b',(-35,9))
 for id,ff,x,z,name,n in items:
  if ff==f and not sight:marker(d,x,z,'#b67412');label(d,(x,z),id,'#955900',(-18,-25))
 for id,wf,x,z,ang,rad,fov,n in watch:
  if wf==f:
   marker(d,x,z,'#d7463c' if id.startswith('C') else '#172c3b');label(d,(x,z),id,'#a32f28' if id.startswith('C') else '#172c3b',(6,5))
 for id,door,p,q,guard,npc,allow in checkpoints:
  if p[1]==f*3.5:d.line((*xy(p[0],p[2]),*xy(q[0],q[2])),fill='#de5444',width=6);label(d,(p[0],p[2]),id,'#b83227',(-30,-28))
 d.text((80,1120),'緑＝公共　黄＝職員　桃＝私室　青＝外縁　太線＝壁　緑線＝開口　青線＝階段',font=font,fill='#223e50')
 d.text((80,1152),'F：家具　H：身体の隠し場所　I：服・道具　A：操作点　X：抜け道　G/W：人　C：カメラ',font=font,fill='#223e50')
 d.text((80,1184),'視線の扇は静止時の設計投影。高さ・移動・疑惑・検知の実測ではありません。' if sight else '壁の全座標・床穴・端点・幅・用途は設計書の同じIDを参照。図の縮小表示では寸法を測らない。',font=font,fill='#425b6b')
 d.line((1300,1170,1410,1170),fill='black',width=3);d.text((1325,1180),'5m',font=font,fill='black')
 suffix={-1:'b1',0:'1f',1:'2f'}[f]
 im.save(P/f'party-v2-{"sight" if sight else "plan"}-{suffix}.png')

def geometry_md():
 s='### 2.1 区域・床の座標\n\n'
 s+='単位m。座標は `(x,y,z)`。北は+z、東は+x。原点は敷地南西。1階y=0、地下y=-3.5、2階y=3.5。60×45m。表の矩形は `(西,南,東,北)`。複数の矩形は和集合。同じ区域内の継ぎ目に壁を作らない。区域外は歩行不可。2階の床は下記の範囲だけ。1階Bの上は吹抜とする。\n\n'
 s+=table(['区域','名称','階','種別','床矩形'],[(k,n,f,t,' / '.join(map(str,r))) for k,n,f,t,r in zones])
 s+='\n公共は全服可。職員は給仕・清掃・警備・護衛（料理人を含む既存職員服）。Qは護衛・清掃。O/Mは護衛のみ。Lは全服が禁止区域だが無人の外縁を潜る経路。服なしでも操作できる。立入表示は消さない。CとJは職業の場、Rは招待客の静かな公共、Qは私的、O/Mは個人の場。床材・職員・検問札で境界を示す。\n\n'
 s+='### 2.2 開口と検問\n\n壁の中心線を基準に下表の区間を切り取る。開口高さ2.6m。扉の開閉・施錠は作らない。各開口は両方向。幅は端点の距離。\n\n'
 s+=table(['ID','接続','床y','端1(x,z)','端2(x,z)','幅m','用途'],[(i,a+'↔'+b,Z[a][2]*3.5,p,q,round(math.dist(p,q),2),n) for i,a,b,p,q,n in doors])
 s+=table(['検問','開口','線の端1','端2','担当位置','人','許可'],checkpoints)
 s+='\nCP2担当は線から2mなので、相互に届く接近点(4,0,6.8)を確保する。CP3は(34,3.5,12.8)。実装段階で既存の検査半径を照合し、両対象に届かないなら担当を線へ近づける。正門退出時も銃・毒の問題を考慮し、取得後はX1で退出できる。\n\n'
 s+='### 2.3 階段と床穴\n\n'
 s+=table(['ID','接続','上り口(x,y,z)','下り口(x,y,z)','有効幅m','上る向き'],[(i,a+'↔'+b,p,q,w,('+x' if q[0]>p[0] else '+z' if q[2]>p[2] else '-z')) for i,a,b,p,q,w in stairs])
 s+='\n「上り口」は低い端、「下り口」は高い端。各端の外側へ同幅×1.5mの踊り場を確保。表の端間を一枚の傾斜当たり判定にする。段の見た目はその上に置く。各階の床は階段の平面投影（中心線±幅/2）を切り抜く。端の踊り場は切り抜かない。S1が横切る1階H–2階R境界、S2のD–R境界、S3/S4の地下天井、S5のS–U境界の壁も階段幅＋両側0.2mを切り欠く。これらは新しい横接続として数えない。階段上に人・物・収納を配置しない。\n\n'
 s+='### 2.4 抜け道\n\n'
 s+=table(['ID','接続','端1','端2','秒','種類','途中点'],traversals)
 s+='\nX1は高さ2.2mの塀。X2は地下へ下りた後の専用ダクト。X3は雨どいから庇を通る。途中点を含む全線に0.8m幅の見える足場・管・トンネルを設ける。X3の庇は歩行床として広げず、移動中だけ使う。X5–7は腰壁1m、開口幅1.2m（端点x±0.6）。NPCの通常経路は切る。両端に1.5×1.5mの空き。長押しを離したら開始位置へ戻り、その後の歩行入力を勝手に継続しない。\n\n'
 s+='観察窓V1は2階Uの東壁、x=20、z=30–35、床上0.5–2.5mを切り抜く。下に舞踏室B西翼が見える。この範囲の東側には2階の床を張らない。客室Qの床の下を透視させない。窓下の腰壁0.5mは衝突あり。移動リンクを定義せず、歩行は遮る。図の水色線がV1。これは視線だけの開口なので区域接続数に加えない。\n\n'
 s+='### 2.5 壁の全座標\n\n壁厚0.2m。下端はその階の床y。表の高さは床から。窓・階段の切欠きは2.3/2.4を優先。B–Pは不透明壁なので、光庭を挟んだ見通しは開口18だけに限定する。屋外の低い境界も表に指定した壁として扱い、見た目だけの柵で遮蔽を偽装しない。\n\n'
 s+=table(['ID','階','端1(x,z)','端2(x,z)','厚m','高m','接する区域'],walls)
 s+='### 2.6 家具・操作点\n\n'
 s+=table(['ID','階','x','z','幅x','奥行z','高','意味'],furniture)
 s+=table(['ID','階','x','z','内容','意味'],items)
 s+='\n家具は描画と衝突に同じ寸法を使う。F05以外は不透明。隠し場所の物体寸法は幅1.2×奥行0.8×高1.8m、長辺はx向き。前面は南、操作点は中心からz-1.1m。全15個が身体を1人以上収納できる実用品。服・道具は床上0.8mの台に置き、操作位置は表の中心から南へ1m。A1/A2はU側で操作し、壁越しにBへ歩ける穴は作らない。\n\n'
 s+='### 身体の隠し場所\n\n'
 s+=table(['ID','階','x','z','区域','理由'],hides)
 s+='\n### 開始・出口・標的の位置\n\n開始S0=(25,0,2)、出口E1=(25,0,2)、出口E2=(2,0,2)。出口の操作半径1.3m。脱出の成立は既存の標的排除条件。時刻で施錠しない。シャンデリア落下中心=(25,0,33)、半径1.5m。書類の窓辺=(35,3.5,25)、落下先=(35,0,28)。飲み物=(46,3.5,22)。\n'
 return s

if __name__=='__main__':
 for f in (-1,0,1):draw(f);draw(f,True)
 (P/'party-v2-coordinate-tables.md').write_text(geometry_md(),encoding='utf-8')
 links=[(a,b) for _,a,b,*rest in doors+stairs+traversals]
 degree=Counter(v for e in links for v in e)
 seen={'V'}
 while True:
  nxt=seen|{b for a,b in links if a in seen}|{a for a,b in links if b in seen}
  if nxt==seen:break
  seen=nxt
 errors=[]
 for id,a,b,p,q,n in doors:
  mid=((p[0]+q[0])/2,(p[1]+q[1])/2)
  if not inz(*mid,a) or not inz(*mid,b):errors.append(id+' boundary')
 for id,a,b,p,q,*rest in stairs+traversals:
  if not inz(p[0],p[2],a) or not inz(q[0],q[2],b):errors.append(id+' endpoint')
 assert len(seen)==len(zones)
 assert not errors,errors
 report={'kind':'design graph / coordinate consistency, NOT runtime navigation','areas':len(zones),'connections':len(links),'doors':len(doors),'stairs':len(stairs),'traversals':len(traversals),'parts':1,'loops':len(links)-len(zones)+1,'deadEnds':[k for k in Z if degree[k]==1],'degree':dict(sorted(degree.items())),'hides':len(hides),'walls':len(walls),'geometryErrors':errors}
 (P/'party-v2-design-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False))

