from pathlib import Path
from math import atan2, hypot, pi
from random import Random
from runpy import run_path
from club_population import populate
import json,sys
P=Path(__file__).resolve().parent; D=P.parent/'app/src/data'
def read(n):return json.loads((D/n).read_text(encoding='utf-8'))
def write(n,v):(D/n).write_text(json.dumps(v,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
def rect(a,b,c,d):return dict(minX=a,minZ=b,maxX=c,maxZ=d)
# 2026-11-03 re-plan (playtest: the plan did not read as a real building). Front of house runs street -> lobby ->
# hall; the smoking yard and the toilets open off the lobby; the VIP mezzanine sits over a lounge on the west with
# its stair beside the lounge, not in front of the bar; the bar is on the east wall with its store behind; the stage,
# equipment room, office and kitchen share a back corridor; the catwalk is a technicians' walk reached only by the
# equipment-room ladder, with a staff door into the back of VIP.
v=dict(version=1,stage=2,name='クラブ 第2.5段階',ground=rect(0,0,48,42),spawn=dict(x=22,z=2),spawnHeading=0,rooms=[],walls=[],furniture=[],openings=[],stairs=[],traversals=[],traversalRules=dict(radius=.8,suspicionPerSecond=0),npcs=[],actors={},schedulePlaces={},hides=[],markers=[],checkpoints=[],uniformGates=[])
staff=['bartender','chef','bottle_server','technician','manager','dj']
permissions={'Q':['bartender','manager'],'D1':['bartender','bottle_server','manager'],'O':['bartender','bottle_server','manager'],'G':['technician','dj','manager'],'H':['technician'],'M':['technician'],'J':['bartender','chef','cleaner','bottle_server','manager'],'R':staff+['cleaner'],'K':['bartender','chef','cleaner','manager'],'L':['manager'],'I':['vip_guest','bottle_server','bodyguard']}
def room(id,label,r,f=0,t='public',outdoor=False):
 v['rooms'].append(dict(id=id,label=label,floor=f,type=t,**rect(*r),surface='service' if t=='staff' else 'carpet',indoor=not outdoor,allowedDisguises=[] if t=='public' else list(dict.fromkeys(permissions.get('I' if id.startswith('S') else id,[])+(['bodyguard'] if t=='secure' else [] if id=='M' else ['guard','bodyguard'])))))
for id,label,r,t,out in [
 ('A','表通り',(0,0,48,6),'public',True),('F','喫煙所',(0,6,10,14),'public',True),
 ('Q','クローク裏',(10,6,13.5,9),'staff',False),('B','入口・クローク',(10,6,30,14),'public',False),('E','トイレ',(30,6,44,14),'public',False),
 ('N','ラウンジ',(4,14,14,30),'public',False),('C','フロア',(14,14,34,30),'public',False),
 ('D','バー',(34,14,38,30),'public',False),('D1','バー内',(38,14,44,30),'staff',False),
 ('O','バー倉庫',(38,30,44,34),'staff',False),('G','DJブース',(18,30,30,34),'staff',False),
 ('H','機材室',(30,30,38,34),'staff',False),('L','事務所',(14,30,18,34),'staff',False),
 ('R','裏通路',(14,34,44,36),'staff',False),('J','厨房',(4,30,14,36),'staff',False),
 ('K','搬入口',(0,36,20,42),'staff',True),('K','裏路地',(0,14,4,36),'staff',True)]:room(id,label,r,t=t,outdoor=out)
room('I','VIP席',(4,14,14,30),1,'secure');room('M','キャットウォーク',(14,28,38,30),1,'staff');room('M','技術足場',(34,30,38,34),1,'staff')
# S1: the guests' stair to VIP, rising north beside the lounge (guarded at its foot). S2: the service stair from the
# kitchen up to the back of VIP, for bottle service.
for id,label,x0,z0,x1,z1,rise in [('S1','正面階段',12,16,14,23,'+z'),('S2','裏階段',4,23,6,30,'-z')]:
 v['stairs'].append(dict(id=id,**rect(x0,z0,x1,z1),low=0,high=3.5,rise=rise,floor=0))
 for f in [0,1]:room(id,label,(x0,z0,x1,z1),f,'secure')
# 2026-11-03: the DJ booth is an open stage now, a step up (28 cm) from the floor with a few steps at both front
# corners; a low lip along the rest of the front keeps people to the steps. ground=True: the floor under it is gone.
for id,x0,x1 in [('SA',18.3,19.5),('SB',28.5,29.7)]:v['stairs'].append(dict(id=id,**rect(x0,28.8,x1,30),low=0,high=.28,rise='+z',floor=0))
v['platforms']=[dict(id='stage',**rect(18,30,30,34),y=.28)]
v['traversals']=[dict(id='X1',a='H',b='M',kind='ladder',start=dict(x=36,y=0,z=32),end=dict(x=36,y=3.5,z=30.8),via=[dict(x=36,y=3.5,z=32)])]
v['geometry']=dict(floors=[dict(floor=1,y=3.5)],shafts=[dict(**rect(35.4,31.4,36.6,32.6),floor=1)],collisionOnlyPrefixes=['glass'])
def wall(id,x,z,w,d,h=6.8,y=0,floor=None):v['walls'].append(dict(id=id,x=x,z=z,w=w,d=d,h=h,y=y,floor=round(y/3.5) if floor is None else floor))
def line(id,axis,k,lo,hi,openings=[],h=6.8,y=0,lintel=None):
 parts=[(lo,hi)]
 for at,width in openings:
  parts=[s for a,b in parts for s in ([(a,min(b,at-width/2))] if a<at-width/2 else [])+([(max(a,at+width/2),b)] if b>at+width/2 else []) if s[1]-s[0]>.01]
 for i,(a,b) in enumerate(parts):wall(id+'-'+str(i),(a+b)/2 if axis=='z' else k,k if axis=='z' else (a+b)/2,b-a if axis=='z' else .2,.2 if axis=='z' else b-a,h,y)
 for j,(at,width) in enumerate(openings):
  v['openings'].append(dict(id=id,axis=axis,at=at,k=k,width=width))
  # Doors in tall walls keep the wall above them.
  top=lintel if lintel is not None else 2.4
  if h-top>.05:wall(id+'-lintel-'+str(j),at if axis=='z' else k,k if axis=='z' else at,width if axis=='z' else .2,.2 if axis=='z' else width,h-top,y+top,round(y/3.5))
# Building shell (full height).
line('front','z',6,10,44,[(22,2.4)]);
# The cloak's back room (staff): the bartenders' spare uniforms hang there, out of the lobby's sight (playtest
# 2026-11-03: changing at an open locker in the lobby was seen at once). Door faces the back of the counter.
line('cloak-room','x',13.5,6,9,[(8.3,1.0)],2.8);line('cloak-room-north','z',9,10,13.5,[],2.8)
line('smoking-lobby','x',10,6,14,[(10,1.6)])
line('entry','z',14,4,44,[(20,3)],lintel=3.2);line('west','x',4,14,36,[(33,1.4)]);line('east','x',44,6,36)
line('rear','z',36,4,44,[(6,1.6),(16,2)]);line('vip-north','z',30,4,14,[(5,2)])
# Rooms inside (one storey).
line('toilet','x',30,6,14,[(12.6,1.4)],2.8);line('toilet-screen','x',32.2,10.5,14,[],2.2)
line('stairwell-s2','x',6.15,23,30,[],3.4)
line('kitchen-office','x',14,30,36,[(35,1.4)],2.8);line('hall-office','z',30,14,18,[],2.8);line('office-stage','x',18,30,34,[],2.8)
line('stage-front','z',30,18,30,[(18.9,1.2),(29.1,1.2)],.28);line('hall-equip','z',30,30,38,[],2.8);line('bar-store','z',30,38,44,[(41,1.4)],2.8)
line('stage-equipment','x',30,30,34,[(32,1.4)],2.8);line('equip-store','x',38,30,34,[],2.8)
line('corridor','z',34,14,44,[(16,1.2),(24,1.4),(34,1.2),(41,1.2)],2.8)
# Outdoor fences.
line('smoking-street','z',6,0,10,[],2.2);line('smoking-alley','z',14,0,4,[(2,1.4)],2.2);line('outer-west','x',.1,6,42,[],2.2)
line('outer-north','z',41.9,0,20,[],2.2);line('outer-east','x',20,36,42,[],2.2);line('street-east','z',6,44,48,[],2.2)
# Upper edges have real rail colliders; the transparent infill does not block sight.
line('glass-vip','x',14,14,28,[],1.1,3.5);line('vip-staff-door','x',14,28,30,[(29,1)],2.6,3.5,lintel=2.2)
line('rail-s1-west','x',11.85,16,23,[],1.1,3.5);line('rail-s1-south','z',15.85,12,14,[],1.1,3.5);line('rail-s2','x',6.15,23,30,[],1.1,3.5)
line('rail-walk-front','z',28,14,38,[],1.1,3.5);line('rail-walk-back','z',30,14,34,[],1.1,3.5);line('rail-walk-east','x',38,28,34,[],1.1,3.5)
line('rail-walk-west','x',34,30,34,[],1.1,3.5);line('rail-walk-end','z',34,34,38,[],1.1,3.5)
def prop(id,x,z,w,d,h=1,y=0):v['furniture'].append(dict(id=id,x=x,z=z,w=w,d=d,h=h,y=y,floor=round(y/3.5)))
prop('counter-cloak',16.2,6.8,4,.8,1.1)
for z in [16,18,20,22,24,26]:prop('counter-bar-'+str(z),38.4,z,.8,2,1.1)
for z in [18,24]:prop('shelf-bottles-'+str(z),43.6,z,.5,2,2)
prop('sofa-lounge-west',4.8,18,1,4,.8);prop('table-lounge-west',6.6,18,1,1.6,.5);prop('sofa-lounge-north',10,29.4,4,1,.8);prop('table-lounge-north',10,27.8,1.6,1,.5)
prop('sofa-vip',4.8,18.5,1.2,4,.8,3.5);prop('table-vip',7.2,18.5,1.3,2,.5,3.5);prop('sofa-vip-south',9.5,14.8,4,1,.8,3.5)
for x in [18.7,29.3]:prop('speaker-'+str(x),x,33.4,.8,1.1,2.3,.28)
prop('desk-dj',24,31.6,5,1,1,.28);prop('machine-lighting',32,33.2,1.2,1,1.4);prop('rack-equip',31,31,.8,1,2);prop('desk-office',14.6,31.5,.8,2.5,.8)
prop('counter-kitchen',9,32.8,4,1,.9);prop('counter-wash',9,35.4,2,.8,.9);prop('machine-freezer',12.9,31,1.2,1.4,2);prop('locker-static',13.4,33,.65,1.2,1.9)
for i,z in enumerate([31.2,32.8]):prop('crate-store-'+str(i),42.6,z,1.2,1.2,1.2)
for x,z in [(2,38),(3.3,38),(2,39.3)]:prop('crate-'+str(x)+'-'+str(z),x,z,1.2,1.2,1.2)
prop('car-loading',14,39.5,1.8,4,1.3);prop('planter-entry',18.5,5,1.2,.8,1);prop('planter-entry-2',25.5,5,1.2,.8,1);prop('planter-smoking',2,8,1.2,1.2,1)
for z in [8,10,12]:prop('toilet-partition-'+str(z),42,z,4,.12,2)
prop('counter-wash-toilet',37,6.6,4,.8,.9)
populate(v)
# Places on the stage stand on its boards.
for pl in v['schedulePlaces'].values():
 for st in v.get('platforms',[]):
  if st['minX']<=pl['x']<=st['maxX'] and st['minZ']<=pl['z']<=st['maxZ'] and pl['y']<1:pl['y']=st['y']
# 2026-11-10: once the layout has been edited and saved in the map lab (8795/map-lab), writing it from here would throw
# that work away. Pass --overwrite-map-lab-edits to do it anyway.
if read('club-layout.json').get('editedInMapLab') and '--overwrite-map-lab-edits' not in sys.argv:
 sys.exit('club-layout.json はマップ編集ラボで編集されています。上書きするなら --overwrite-map-lab-edits を付けてください。')
write('club-layout.json',v)
# 2026-11-03 (playtest: night was too dark to read the building): daytime with the house lights on. The coloured
# lights stay but are weak; the rooms read by their real finishes below.
look=dict(background='#c9d6e2',ambientSky='#ffffff',ambientGround='#8c857a',ambientIntensity=1.35,sunColor='#fff2dc',sunIntensity=1.5,exposure=1.0,points=[dict(x=24,y=4,z=22,color='#875cff',intensity=8,distance=14),dict(x=40,y=2,z=22,color='#23cbef',intensity=5,distance=8)],emissive=[])
# Finishes like a real club. Floors by room label: base colour, joint colour, joint spacing in metres (0 = none),
# pattern (slab, plank, tile, grate, carpet, speckle), roughness, metalness.
look['floors']={
 '表通り':['#a7a7a1','#8c8c86',1.5,'slab',.95,0],'喫煙所':['#8f8e88','#77766f',1.2,'slab',.95,0],
 '入口・クローク':['#2b2a29','#3a3836',0,'speckle',.8,0],'クローク裏':['#77787a','#68696b',2,'slab',.85,0],'フロア':['#3a3a3c','#2f2f31',3,'slab',.38,.12],
 'ラウンジ':['#3b2e2a','#463631',0,'carpet',.95,0],
 'バー':['#4b3626','#36261b',.18,'plank',.6,0],'バー内':['#262626','#3a3a3a',.05,'speckle',.9,0],'バー倉庫':['#77787a','#68696b',2,'slab',.85,0],
 'トイレ':['#6c7073','#c9ccc9',.3,'tile',.5,0],'DJブース':['#1d1d1f','#2a2a2c',1.2,'plank',.85,0],
 '機材室':['#77787a','#68696b',2,'slab',.85,0],'裏通路':['#7d7e80','#6b6c6e',2,'slab',.85,0],'厨房':['#86493d','#5f362e',.15,'tile',.7,0],
 '搬入口':['#8f8e89','#777671',2,'slab',.95,0],'裏路地':['#7f7e79','#6a6964',2,'slab',.95,0],
 '事務所':['#56606b','#4b545e',.5,'tile',.95,0],'VIP席':['#4c1f28','#5a2731',0,'carpet',.95,0],
 'キャットウォーク':['#4d5156','#2f3236',.05,'grate',.6,.5],'技術足場':['#4d5156','#2f3236',.05,'grate',.6,.5],
 '正面階段':['#2d2a28','#2d2a28',0,'slab',.6,0],'裏階段':['#8a8a86','#8a8a86',0,'slab',.9,0]}
look['street']='#3c3e42'
# Walls by id prefix (first match wins): kitchen and toilet tile, black stage, brick outside, dark paint inside.
look['walls']=[['kitchen','#e4e6e2'],['toilet','#5d6266'],['stage','#202022'],['outer','#8a5a48'],['front','#8a5a48'],['smoking','#8a5a48'],['street','#8a5a48'],['rear','#8b8a85'],['office','#c9c6bd'],['corridor','#9a9b9d'],['','#46474d']]
look['rail']='#2a2a2c'
# A black club ceiling over the indoor part, seen only from below; the lobby and toilets have a low one.
look['ceilings']=[dict(minX=4,maxX=44,minZ=14,maxZ=36,y=7,color='#55565b',emissive='#2e2f33'),dict(minX=10,maxX=44,minZ=6,maxZ=14,y=3.2,color='#55565b',emissive='#2e2f33')]
look['mirrorBall']=dict(color='#d9dde2',emissive='#8f9aa8',emissiveIntensity=.25)
look['stairs']={'S1':'#2d2a28','S2':'#8a8a86'}
look['props']=[['speaker','#18181a'],['desk-dj','#1f1f22'],['machine-lighting','#2a2d31'],['rack-equip','#2a2d31'],['counter-kitchen','#b8bcbf'],['counter-wash','#b8bcbf'],['counter-cloak','#2d2a28'],['machine-freezer','#c3c7ca'],['sofa-vip','#5a1e2e'],['sofa-lounge','#3a3433'],['table-vip','#1e1e20'],['table-lounge','#1e1e20'],['shelf-bottles','#3b2a1f'],['toilet-partition','#3d4247'],['desk-office','#6b5a48'],['locker','#6f7b84'],['stair-cheek','#2d2a28']]
def glow(id,x,y,z,w,h,d,color):look['emissive'].append(dict(id=id,x=x,y=y,z=z,w=w,h=h,d=d,color=color))
# House lights (cleaning lights) are on in the day: plain white strips under the ceilings.
for x in [17,22,27,32,37,42]:
 for z in [17,21,25,33]:glow('house-light',x,6.9,z,2.4,.06,.25,'#f4f6f2')
for z in [17,23]:glow('house-light',9,6.9,z,2.4,.06,.25,'#f4f6f2')
for x in [14,20,26,34,40]:glow('house-light',x,3.1,10,2.4,.06,.25,'#f4f6f2')
for x in [19.5,24.5]:glow('entry-neon',x,1.7,5.85,0.12,1.1,.12,'#ee4dcc')
glow('entry-sign',22,3.2,5.8,6,.25,.15,'#36d8ef');glow('dj-front',24,.12,29.84,9.4,.14,.06,'#c953ff')
for z,d in [(15,1.6),(24.5,2),(27,2)]:glow('vip-gold',13.9,3.5,z,.06,.1,d,'#ffc866')
for z in [18,24]:glow('bar-light',43.3,1.8,z,.08,.1,2,'#39e8ea')
for z in [16,21,26]:glow('bar-front',38,.25,z,.04,.08,2,'#39e8ea')
for z in [32,34.6]:glow('kitchen-white',9,2.7,z,2,.08,.4,'#f1fff8')
glow('office-white',16,2.7,32,2,.08,.4,'#f1fff8')
for x in [6,16]:glow('loading-white',x,2.6,36.2,1.6,.1,.2,'#f1fff8')
for x in [18,24,30]:glow('dance-stripe',x,.02,22,.08,.01,14,'#383c91')
glow('walk-front-light',26,3.5,27.95,24,.08,.08,'#4a8da9')
# Wall linings: a shared wall is one collider with one colour, so the kitchen and the toilets get thin tiled faces
# on their side only (drawn, not collided).
look['linings']=[]
def lining(axis,k,lo,hi,gaps,color,h=2.8):
 parts=[(lo,hi)]
 for a,b in gaps:parts=[s for x,y in parts for s in ([(x,min(y,a))] if x<a else [])+([(max(x,b),y)] if y>b else []) if s[1]-s[0]>.01]
 for a,b in parts:look['linings'].append(dict(x=(a+b)/2 if axis=='z' else k,z=k if axis=='z' else (a+b)/2,w=b-a if axis=='z' else .04,d=.04 if axis=='z' else b-a,h=h,color=color))
K,T='#e4e6e2','#c9ccc9'
lining('z',30.13,6.05,14,[],K);lining('x',4.13,30,36,[(32.3,33.7)],K);lining('z',35.87,4,14,[(5.2,6.8)],K)
lining('z',6.13,30,44,[],T);lining('x',43.87,6,14,[],T);lining('z',13.87,30,44,[],T);lining('x',30.13,6,14,[(11.9,13.3)],T)
write('club-look.json',look)
# Club-specific configuration keeps the existing runtime data shapes.
for name in ['rules','detection','mission','actions']:
 a=read('party-'+name+'.json')
 if name=='detection':
  a['blend']=[];a['recorder'].update(x=1000,z=1000)
  # 2026-11-06: the tools lie where their work is (ROADMAP N01/N03/N04/N07/N33; swung, stabbed or thrown, app/src/melee.ts).
  a['worldItems']=[dict(id='wrench-equipment',item='wrench',x=34.1,z=31.0,floor=0),dict(id='hammer-equipment',item='hammer',x=34.6,z=31.0,floor=0),dict(id='crowbar-loading',item='crowbar',x=5.2,z=38.4,floor=0),
   dict(id='knife-kitchen',item='kitchen_knife',x=6.0,z=31.2,floor=0),dict(id='pan-kitchen',item='frying_pan',x=11.2,z=34.3,floor=0),
   dict(id='brick-smoking',item='brick',x=4.5,z=10.5,floor=0),
   dict(id='earphones-smoking',item='wire_earphones',x=4.0,z=10.5,floor=0),
   dict(id='tape-equipment',item='wire_tape',x=34.9,z=31.0,floor=0),
   dict(id='briefcase-office',item='briefcase',x=17.2,z=33.2,floor=0),dict(id='toolbox-loading',item='toolbox',x=6.6,z=38.6,floor=0),dict(id='katana-vip',item='katana',x=10.0,z=22.0,floor=1)]
  # 2026-11-05: the hand-held items with GLBs (assets/items); placed above (2026-11-06).
  a['items']['wrench']['allowedFor']=['technician','cleaner','guard','bodyguard']
  a['items'].update(hammer=dict(label='ハンマー',legality='suspicious',concealable=False,allowedFor=['technician','cleaner']),
   crowbar=dict(label='バール',legality='suspicious',concealable=False,allowedFor=['technician']),
   wire_earphones=dict(label='イヤホン型ワイヤー',legality='illegal',concealable=True),
   wire_tape=dict(label='メジャー型ワイヤー',legality='illegal',concealable=True),
   kitchen_knife=dict(label='包丁',legality='illegal',concealable=True,allowedFor=['chef']),
   frying_pan=dict(label='フライパン',legality='suspicious',concealable=False,allowedFor=['chef']),
   brick=dict(label='レンガ',legality='normal',concealable=False),
   # 2026-11-06 (M09/M10, M14/M15): a sword is illegal for everyone; a briefcase is an ordinary thing to carry.
   katana=dict(label='刀',legality='illegal',concealable=False),briefcase=dict(label='ブリーフケース',legality='normal',concealable=False),
   # 2026-11-07 (HD12): the toolbox case, ordinary to carry like the briefcase.
   toolbox=dict(label='工具箱',legality='normal',concealable=False))
 if name=='mission':a.update(title='クラブを歩く',targets=[],briefing=[],tools=[dict(id='coin',label='コイン',note='3枚'),dict(id='poison_lethal',label='毒',note='検査を通る')],fixedTools=[dict(id='wire',label='ワイヤー',note='検査を通る')],pistols=[dict(id='',label='持ち込まない'),dict(id='pistol_silenced',label='消音ピストル',note='入口の検査で止められる'),dict(id='tranq_pistol',label='鎮静ダーツ銃',note='当てると数秒で眠る（殺さない）。1発ずつ、予備4発。入口の検査で止められる')],starts=[dict(id='S1',label='表通り',open=True,note='建物と光を確かめる')],
   # 2026-11-06 (ROADMAP H46): where the pistol can be left in advance instead of carried through the frisk.
   pickups=[dict(id='P1',label='喫煙所の植え込み',note='客も出入りする所。入口の検査の内側',x=3.0,z=8.0,floor=0),
    dict(id='P2',label='搬入口の木箱',note='裏の職員区域',x=4.3,z=39.3,floor=0),
    dict(id='P3',label='トイレの洗面台の下',note='客が使う所。検査の内側',x=37,z=7.4,floor=0)],
   # 2026-11-07 (HD11; 194-item table row 21 「可能（ケース選択…）」): the briefcase can be brought in from the start.
   cases=[dict(id='briefcase',label='ブリーフケース',note='手に持って始める。殴る・投げる・銃を1丁入れられる')],
   # 2026-11-06 (ROADMAP H15): a radio on a crate at the loading dock; switched on, kitchen staff come out to switch it off.
   # 2026-11-06 (H06): who cleans up messes (the dishwasher, in cleaner's clothes), with the corridor vacuum.
   cleaners=['cleaner'],
   devices=[dict(id='radio-loading',kind='radio',label='ラジカセ',x=3.3,z=38.0,y=1.2,floor=0,heading=1.5708,approach=dict(x=4.5,z=38.0)),
    # 2026-11-06 (H16, H17): a TV on the office desk (the one who comes watches it for 10 s), a vacuum cleaner in the back corridor (loud).
    dict(id='tv-office',kind='tv',label='テレビ',x=14.6,z=32.2,y=.8,floor=0,heading=1.5708,approach=dict(x=16.0,z=32.2)),
    dict(id='vacuum-corridor',kind='vacuum',label='掃除機',x=30.0,z=35.5,y=0,floor=0,heading=3.1416,approach=dict(x=30.0,z=34.7))])
 if name=='actions':
  a['clothes']=[dict(id='cloak-uniform',disguise='bartender',pos=dict(x=11.1,y=0,z=6.7)),dict(id='kitchen-uniform',disguise='chef',pos=dict(x=12.4,y=0,z=33))];a['acts']=[]
 if name=='rules':
  for key,label in [('bartender','バーテンダー'),('technician','技術係'),('vip_guest','招待客'),('bottle_server','ボトル係'),('manager','店長'),('dj','DJ')]:a['disguises'][key]=dict(a['disguises']['suit'],label=label)
  a['m4']['uniformModels'].update(bartender='waiter',technician='delivery',bottle_server='sommelier',manager='guest_suit',dj='photographer')
  # All security in black suits: the bouncer's uniform is the bodyguards' suit and sunglasses (2026-11-03).
  a['m4']['uniformModels']['guard']='bodyguard';a['m4']['uniformHides']['guard']=a['m4']['uniformHides']['bodyguard']
  for key,label in dict(guard='用心棒',bodyguard='護衛',chef='料理人',cleaner='皿洗い',beachbar='バー係').items():
   a['disguises'][key]['label']=label
  for outfit in a['disguises'].values():
   outfit.update(public='allow',staff='deny',secure='deny',outer='allow')
  a['m4']['items']['poison_lethal']['friskDetect']=False
  a['render']['pixelRatioCap']=1.5
  a['render']['hudFps']=60
  # Guards within this range tell each other who they saw (hotel and party use the same 15 m).
  a['radio']=15
  # HITMAN: a reported outfit is known to security, not to every cook and guest in the building.
  a['compromisedBy']='guards'
 write('club-'+name+'.json',a)
write('club-chances.json',{});write('club-schedule.json',dict(actors=v['actors']));write('club-dialogue.json',{})
print(json.dumps(dict(rooms=len(v['rooms']),walls=len(v['walls']),npcs=len(v['npcs']))))

combat=read('combat.json')
combat['reinforcements'].update(waves=0,spawn=[])
combat['closedExitsAtAlert3']=[]
combat['placed']=[dict(gun='pistol_guard',x=16.5,y=.42,z=31.5,where='事務所の金庫')]
combat['weaponRecoveryScanSeconds']=.25
# Claude 2026-11-03: with no reinforcements a gunfight was won in seventy seconds at 40 HP. The guards on the map shoot
# sooner and straighter and hit harder, so going loud costs the agent (three or four hits) without new waves.
combat['enemies']['guard'].update(hit=28)
combat['enemies']['bodyguard'].update(hit=18)
combat['accuracy']=dict(near=[5,.75],far=[20,.35])
combat['reactionTime']=.4
combat['player']['regen']=dict(delay=15,perSecond=4)
combat['localResponse']=dict(radius=18,count=2,seconds=24,protectedRoles=['escort'],protectedIds=['gate_frisk'])
write('club-combat.json',combat)

# Crowd positions are frozen candidates. Keep a one-metre lane plus clearance
# for the figure and the quarter-metre sampling error in the stage-two tracks.
lanes = {tuple(map(int,s.split(','))) for s in json.loads((P/'club-crowd-lanes.json').read_text())}
crowd=[]
used=[]
for id,zone,x,z,width,depth,count,heading,pose in [
 # 2026-11-03: the dancers pack toward the stage (front rows ~1.5 m from its lip, leaving the walk to the steps).
 ('C1','C',19.5,24.6,6,5.6,12,0,'dance'), ('C2','C',25,25,5,5.6,14,0,'dance'),
 ('C3','C',30.5,24.6,6,5.6,14,0,'dance'), ('D1','D',36.4,22,2.7,12,12,1.57,'lean'),
 ('N1','N',8.4,24,6,6.5,8,1.57,'chat')]:
 rng=Random('club:'+id)
 points=[]
 def free(a,b):
  ia,ib=round(a*4),round(b*4)
  return (not any(hypot(a-i/4,b-j/4)<.83 and (i,j) in lanes for i in range(ia-4,ia+5) for j in range(ib-4,ib+5))
    and not any(hypot(a-px,b-pz)<.56 for px,pz in used)
    and not any(st['minX']-.32<a<st['maxX']+.32 and st['minZ']-.32<b<st['maxZ']+.32 for st in v['stairs'])
    and not any(f['floor']==0 and abs(a-f['x'])<f['w']/2+.25 and abs(b-f['z'])<f['d']/2+.25 for f in v['furniture']))
 def candidate():
  return (round(x+rng.uniform(-.5,.5)*width,3),
          round(z+(rng.random()**(.72 if pose=='dance' else 1)-.5)*depth,3))
 def add(a,b,face,style,group=None,seat=False):
  points.append(dict(x=a,z=b,heading=round(face,4),phase=round(rng.uniform(0,2*pi),5),
    speed=round(rng.uniform(.75,1.47),5),height=round(rng.uniform(.95,1.05),4),
    pose=style,group=group,seat=seat))
  used.append((a,b))
 if id=='N1':
  for a,b in [(5.57,18.68),(5.57,19.44)]:
   if free(a,b):add(a,b,pi/2,'sit',seat=True)
 for limit in [count,count*2]:
  grouped=0
  while count//2-grouped>=2:
   size=rng.randint(2,min(4,count//2-grouped))
   if len(points)+size>limit:break
   for attempt in range(500):
    anchor=candidate()
    if not free(*anchor):continue
    nearby=[]
    for j in range(45):
     a,b=candidate()
     if .65<hypot(a-anchor[0],b-anchor[1])<1.45 and free(a,b) and all(hypot(a-c,b-d)>.61 for c,d in nearby):
      nearby.append((a,b))
      if len(nearby)==size-1:break
    if len(nearby)<size-1:continue
    group=[anchor,*nearby];mx=sum(a for a,b in group)/size;mz=sum(b for a,b in group)/size
    label=id+'-'+str(len(points))
    for a,b in group:add(a,b,atan2(mx-a,mz-b)+rng.uniform(-.22,.22),rng.choice(['jump','bounce','twist','glass'] if pose=='dance' else ['chat','glass']),label)
    grouped+=size
    break
   else:break
  for attempt in range(25000):
   if len(points)>=limit:break
   a,b=candidate()
   if not free(a,b):continue
   if pose=='dance':
    style='raise' if id=='C3' and not any(p['pose']=='raise' for p in points) else rng.choice(['jump','jump','jump','bounce','twist','raise','jump','glass'] if b>24.5 else ['jump','bounce','bounce','twist','raise','phone','glass'])
    face=atan2(24-a,31-b)+rng.uniform(-.55,.55) if rng.random()<.72 else rng.uniform(-pi,pi)
   elif pose=='lean':
    style='lean' if len(points)%2==0 else rng.choice(['glass','phone'])
    face=(heading+pi if style=='lean' else heading)+rng.uniform(-.3,.3)
   else:
    style=rng.choice(['chat','glass','phone']);face=rng.uniform(-pi,pi)
   add(a,b,face,style)
 if len(points)<count*2:raise ValueError(f'{id}: {len(points)} free positions for {count*2}')
 crowd.append(dict(id=id,zone=zone,x=x,z=z,width=width,depth=depth,count=count,heading=heading,pose=pose,floor=0,points=points))
write('club-crowd.json',dict(places=crowd,ghostWitness=True,hear=15,see=8,calm=8,guardHear=12))
run_path(str(P/'build-club-stage3.py'),run_name='__main__')
