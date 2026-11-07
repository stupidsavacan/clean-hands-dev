"""Export reviewed design to party-only build input. Stage 1 has one stationary target.
Run with --stage 1..4; subsequent stages require the preceding acceptance report.
"""
from pathlib import Path
import runpy,json,sys,math,random
P=Path(__file__).resolve().parent;D=P.parent/'app/src/data'
a=runpy.run_path(str(P/'write-party-v2-people.py'));v=a['layout']
a['places']['U5']=('U',36,3.5,14,270)
a['places']['R1']=('R',36,3.5,9,90)
stage=int(sys.argv[sys.argv.index('--stage')+1]) if '--stage' in sys.argv else 1
def pos(p):return dict(zip(('x','y','z'),p))
def rect(r):return dict(zip(('minX','minZ','maxX','maxZ'),r))
def write(n,d): (D/n).write_text(json.dumps(d,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
rooms=[]
for id,label,f,t,rs in v['zones']:
 for r in rs:rooms.append(dict(id=id,label=label,floor=f,type=t,**rect(r),surface='grass' if id in ['V','G','P'] else 'service' if t=='staff' else 'wood',indoor=id not in ['V','G','P','C','L'],allowedDisguises=['cleaner'] if id=='Q' else []))
stairs=[]
for id,aa,b,p,q,w in v['stairs']:
 along=p[0]==q[0]
 stairs.append(dict(id=id,a=aa,b=b,minX=p[0]-w/2 if along else min(p[0],q[0]),maxX=p[0]+w/2 if along else max(p[0],q[0]),minZ=min(p[2],q[2]) if along else p[2]-w/2,maxZ=max(p[2],q[2]) if along else p[2]+w/2,low=p[1],high=q[1],rise=('+z' if q[2]>p[2] else '-z') if along else ('+x' if q[0]>p[0] else '-x'),floor=round(p[1]/3.5)))
traversals=[]
for id,aa,b,p,q,sec,kind,via in v['traversals']:
 traversals.append(dict(id=id,a=aa,b=b,start=pos(p),end=pos(q),seconds=sec,kind='window' if id in ['X5','X6','X7'] else 'drainpipe' if id=='X3' else 'ladder' if id in ['X2','X4'] else 'ledge',via=list(map(pos,via))))
walls=[dict(id=id,x=(p[0]+q[0])/2,z=(p[1]+q[1])/2,w=max(.2,abs(q[0]-p[0])),d=max(.2,abs(q[1]-p[1])),y=f*3.5,h=h,floor=f) for id,f,p,q,th,h,owners in v['walls']]
furniture=[dict(id='shelf-'+id,x=x,z=z,y=f*3.5,w=w,d=dep,h=h,floor=f) for id,f,x,z,w,dep,h,_ in v['furniture']]
hides=[dict(id=id,label=area+'の収納 '+id,x=x,y=f*3.5,z=z,heading=0,capacity=1,approach=dict(x=0,z=-1.1),size=dict(w=1.2,d=.8,h=1.8)) for id,f,x,z,area,_ in v['hides']]
items=[dict(id=id,at=pos((x,f*3.5,z)),label=label) for id,f,x,z,label,_ in v['items']]
planned=[];npcs=[];actors={};places={}
for id,label,role,outfit,profile,off,faces in a['people']:
 label={'chief':'給仕長','cleaner':'清掃係','delivery':'配膳係','tools':'用具係','wine':'ワイン係','clue_chandelier':'給仕','clue_papers':'書斎係','clue_drink':'給仕','kitchen':'厨房係','gardenstaff':'庭師','cellarstaff':'地下係'}.get(label,label)
 plan=[]
 entries=a['profiles'][profile]
 # 2026-11-03 (playtest: guests stood in 4x2 rows and the whole house moved every five minutes): each group of
 # eight is two conversation circles of four, standing round a point and facing in; every circle moves at its own
 # time (the group's 65 s step plus up to +-60 s of its own), its members a few seconds apart.
 if id.startswith('P'):
  k=int(id[1:])-1;g,c,m=k//8,(k%8)//4,k%4;circle=random.Random(1000+g*2+c);jitter=[circle.uniform(-60,60) for _ in range(len(entries)+1)]
  delay=g*65;each=random.Random(2000+k).uniform(0,5)
  entries=[(0 if not start else round(start+delay+jitter[j]+each),end if end>=1800 else round(end+delay+jitter[j+1]+each),key,'talk') for j,(start,end,key,pose) in enumerate(entries)]
  # Each group has its own side of the spot (a quarter turn apart), so two groups meeting there do not overlap.
  turn=g*math.pi/2+c*math.pi;cx,cz=1.15*math.cos(turn),1.15*math.sin(turn);ang=m*math.pi/2+math.pi/4
  off=(round(cx+.6*math.cos(ang),2),round(cz+.6*math.sin(ang),2));face=round(math.degrees(math.atan2(-math.sin(ang),-math.cos(ang))))
 # Kitchen and garden staff keep their five-minute rounds, each starting at a different moment. The cellar staff
 # keep theirs: W15 still at the cellar spot when the no-uniform route comes off the X2 ladder saw the agent.
 if profile in ('kitchen','gardenstaff'):
  shift=(int(id[1:])*41)%150
  entries=[(0 if not start else start+shift,end if end>=1800 else end+shift,key,pose) for start,end,key,pose in entries]
  entries=[(start,min(end,1800),key,pose) for start,end,key,pose in entries if start<1800];entries[-1]=(*entries[-1][:1],1800,*entries[-1][2:])
 for j,(start,end,key,pose) in enumerate(entries):
  if id=='host' and key=='O3':key='O2'
  # A table south of the north lounge's spot (N2) leaves less room on that side: that circle stands closer in.
  zone,x,y,z,heading=a['point'](key,(off[0],off[1]+.55) if id.startswith('P') and key=='N2' and off[1]<-1 else off);pid=id+'-'+str(j)
  if id.startswith('P'):heading=face
  places[pid]=dict(x=x,y=y,z=z,heading=(90-heading)*3.141592653589793/180,label=zone+' '+label,outdoor=zone in ['V','C','J','G','P','L'])
  planned.append(dict(id=pid,owner=id,x=x,y=y,z=z))
  plan.append(dict(from_=start,to=end,place=pid,do=pose))
  plan[-1]['from']=plan[-1].pop('from_')
 first=places[id+'-0']
 model={'suit':'guest_male','waiter':'waiter','guard':'guard','bodyguard':'bodyguard','cleaner':'cleaner'}[outfit]
 # Shown in subtitles and the HUD: what the player would call them, without the internal id (stage 3 note).
 shown='館の主人' if id=='host' else ('護衛隊長' if label=='隊長' else label if label.endswith('護衛') else label+'の警備') if role=='guard' else label
 # F09 (2026-11-02 fix): who they work for and how they fight, written out. The party's bodyguards were guards by
 # the old id rule (100 health, a pistol); that is kept, so the nine routes are not changed by it.
 security=dict(faction='private_security',securityRole='captain' if id=='G05' else 'escort',combatProfile='guard',loadout='pistol_guard',disguiseId='bodyguard') if outfit=='bodyguard' else dict(faction='estate_security',securityRole='gate' if id in ('G01','G02') else 'patrol',combatProfile='guard',loadout='pistol_guard',disguiseId='guard') if role=='guard' else dict(faction='guest' if role=='guest' else 'estate_staff',combatProfile='civilian',disguiseId=outfit)
 npc=dict(id=id,label=shown,**security,role=role,outfit=outfit,model=model,target=id=='host',floor=round(first['y']/3.5),route=[[first['x'],first['z'],5,(first['heading']*180/3.141592653589793)]],knowsFaces=['bodyguard'] if faces=='護衛' else ['waiter'] if faces=='給仕' else ['cleaner'] if faces=='清掃' else [])
 if stage>1:actors[id]=dict(plan=plan);npcs.append(npc)
 elif id=='host':npcs.append(npc)
openings=[dict(id=id,a=aa,b=b,axis='x' if p[1]==q[1] else 'z',fixed=p[1] if p[1]==q[1] else p[0],at=(p[0]+q[0])/2 if p[1]==q[1] else (p[1]+q[1])/2,width=abs(p[0]-q[0])+abs(p[1]-q[1])) for id,aa,b,p,q,_ in v['doors']]
spec=dict(version=2,stage=stage,name='夜会の私邸 第2版',ground=dict(minX=0,maxX=60,minZ=0,maxZ=45),spawn=dict(x=25,z=2),spawnHeading=0,rooms=rooms,walls=walls,furniture=furniture,hides=hides,stairs=stairs,traversals=traversals,openings=openings,markers=items,npcs=npcs,actors=actors,schedulePlaces=places,plannedPositions=planned,traversalRules=dict(radius=1.15,suspicionPerSecond=25),overlook=dict(minX=20,maxX=28,minZ=30,maxZ=35,railHeight=.5,lowerRailHeight=0),checkpoints=[dict(id='CP1',label='正門の身体検査',x=25,z=6,y=0,width=4,normal=dict(x=0,z=-1),zone='public',guardId='G01',exempt=['guard'])],uniformGates=[dict(id=id,x=(p[0]+q[0])/2,z=(p[2]+q[2])/2,y=p[1],width=abs(p[0]-q[0]),zone='C' if id=='CP2' else 'U') for id,door,p,q,guard,npc,allow in v['checkpoints'] if id!='CP1'],cameras=[dict(id=id,label='監視 '+id,x=x,y=f*3.5+2.8,z=z,floor=f,heading=(90-ang)*3.141592653589793/180,range=r,fov=fov) for id,f,x,z,ang,r,fov,_ in v['watch'] if id.startswith('C') and stage>1])
write('party-layout.json',spec)
if stage>=3:
 dialogue={}
 for base,speakers,windows,lines in [
  ('chandelier',['W06','W07'],[(120,240),(360,480),(1080,1200)],['西翼の吊り具、まだ古いままです','主人の挨拶は九分半と二十三分です']),
  ('papers',['W08'],[(210,330),(600,720),(1200,1320)],['書類の確認は十一分半と二十七分','護衛は回廊で待つよう言われた']),
  ('drink',['W09','W10'],[(150,240),(630,750),(930,1050)],['飲む時刻は十四分半と二十八分半','運ぶのは先です。主人は後から'])]:
  for i,(start,end) in enumerate(windows):
   entry=next(e for e in actors[speakers[0]]['plan'] if e['from']<=start<e['to'])
   dialogue[base if i==0 else base+'_'+str(i+1)]=dict(place=entry['place'],speakers=speakers,lines=[[speakers[j%len(speakers)],line] for j,line in enumerate(lines)],trigger=True,window=[start,end])
 write('party-dialogue.json',dialogue)
print(json.dumps(dict(stage=stage,rooms=len(set(r['id'] for r in rooms)),npcs=len(npcs),plannedPositions=len(planned))))




