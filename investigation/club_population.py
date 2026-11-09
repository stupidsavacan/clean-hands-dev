"""Generate the club population without changing the floor plan."""
from math import cos, sin
from random import Random

def populate(v):
    actors, places = v['actors'], v['schedulePlaces']
    departures = {}

    def place(id, room, x, z, heading=0, y=0):
        places[id] = dict(x=x, y=y, z=z, heading=heading, label=room,
                          outdoor=room in {'喫煙所','表通り','搬入口'})
        return id

    def actor(id, label, role, outfit, model, visits, *, security='', follow=None, face=()):
        p = places[visits[0][1]]
        v['npcs'].append(dict(id=id,label=label,role=role,outfit=outfit,model=model,
          floor=round(p['y']/3.5),route=[[p['x'],p['z'],0]],look=[p['x']+sin(p['heading']),p['z']+cos(p['heading'])],
          faction='club_security' if security else 'club',securityRole=security,
          combatProfile='guard' if security else 'civilian',disguiseId=outfit,knowsFaces=list(face)))
        if security:
            v['npcs'][-1]['loadout']='pistol_guard'
        plan=[]
        if follow:
            actors[id]=dict(plan=plan,follow=follow,offset=[.9,-.7])
            return
        for i,(t,dest,action) in enumerate(visits):
            plan.append({'from':t,'to':visits[i+1][0] if i+1<len(visits) else 1800,'place':dest,'do':action})
        actors[id]=dict(plan=plan)

    models=['guest_suit','guest_dress','photographer','lawyer','wine_merchant','pool_guest_resort']
    for i in range(16):
        rng=Random(2026110300+i)
        id=f'guest_{i+1:02}'
        points=[
          ('フロア',17+(i%8)*2.05,18+(i//8)*5.2,'dance',120,300),
          ('バー',35+(i%2)*1.3,15+(i//2)*1.7,'drink',60,120),
          ('ラウンジ',7.9+(i%3)*1.12,17+(i//3)*1.35,'sit',120,240),
          ('トイレ',34.4+(i%4)*1.57,7.65+(i//4)*1.53,'idle',30,60),
          ('喫煙所',3.3+(i%4)*1.75,7.4+(i//4)*1.5,'idle',120,180)]
        destinations=[place(f'{id}_{j}',room,x,z,rng.uniform(-3.14,3.14))
                      for j,(room,x,z,*_) in enumerate(points)]
        j=[0,0,0,1,2,0,1,2,0,0,3,4,2,0,1,0][i]
        t=0
        visits=[]
        while t<1800:
            visits.append((t,destinations[j],points[j][3]))
            t+=rng.randint(*points[j][4:]) if t else rng.randint(22,98)
            while departures.get(t,0)>=2:
                t+=1
            if t<=1755:
                departures[t]=departures.get(t,0)+1
            else:
                break
            j=rng.choice([k for k in range(5) if k!=j])
        actor(id,f'客 {i+1}','guest','suit',models[i%len(models)],visits)

    def fixed(id,label,outfit,model,points,visits,role='waiter',**kw):
        for i,(room,x,z,*extra) in enumerate(points):
            place(f'{id}_{i}',room,x,z,*extra)
        actor(id,label,role,outfit,model,[(t,f'{id}_{i}',a) for t,i,a in visits],**kw)

    for i in range(4):
        offset=43+i*37
        fixed(f'vip_{i+1}',f'招待客 {i+1}','vip_guest',models[i%2],
              [('VIP席',8.9+i%2*1.45,16.5+i//2*4,1.2,3.5),('バー',35.1,16+i*3,-1.2)],
              [(0,0,'idle')]+[(t+offset,j,a) for t,j,a in
                  [(180,1,'drink'),(300,0,'idle'),(770,1,'drink'),(910,0,'idle'),(1340,1,'drink'),(1470,0,'idle')]],'guest')
    fixed('investor','投資家','vip_guest','investor',
          [('VIP席',11.1,26.1,1.7,3.5),('フロア',26,26,3),('バー',36.4,27.8,1.4),('トイレ',35.3,11.4,2)],
          [(0,0,'idle'),(311,1,'idle'),(430,2,'drink'),(539,0,'idle'),(875,3,'idle'),(955,0,'idle'),(1321,2,'drink'),(1492,0,'idle')],'guest')
    fixed('escort','投資家の護衛','bodyguard','bodyguard',
          [('VIP席',12,25.4,1,3.5)],[(0,0,'idle')],'guard',security='escort',follow='investor',face=('bodyguard',))
    fixed('gate_frisk','入口の検査役','guard','bodyguard',[('入口',21.0,7.25,3.14)],[(0,0,'idle')],'guard',security='gate',face=('guard',))
    fixed('gate_watch','列の監視役','guard','bodyguard',[('入口',24.1,7.4,3.14)],[(0,0,'idle')],'guard',security='gate')
    fixed('vip_guard','VIP階段の護衛','bodyguard','bodyguard',[('ラウンジ',11,15.1,1.3)],[(0,0,'idle')],'guard',security='post')
    fixed('patrol','巡回の用心棒','guard','bodyguard',
          [('フロア',30,26,2),('バー',37,27.7,3),('喫煙所',8.8,11.7,3)],
          [(0,0,'idle')]+[(t+j*260,i,'idle') for j in range(6) for t,i in [(52,1),(131,2),(221,0)]],
          'guard',security='patrol')
    # Claude 2026-11-03 (playtest: five guards fell in seventy seconds): a bouncer at the stage front, where the
    # investor presses the drop, and a back-of-house patrol along the service corridor past the office door.
    fixed('stage_guard','舞台前の用心棒','guard','bodyguard',[('フロア',24,29.2,3.14)],[(0,0,'idle')],'guard',security='post')
    fixed('back_patrol','裏の巡回','guard','bodyguard',[('裏通路',17,35,1.57),('裏通路',33,35,-1.57)],
          [(0,0,'idle')]+[(t+j*150,i,'idle') for j in range(12) for t,i in [(40,1),(115,0)]],'guard',security='patrol')
    # 【未検証・False】VIP席の守りを足す（HITMAN の要人警備の調査、2026-11-03）。True にすると、裏階段の上に1人、
    # VIP席の中で客を見張る護衛が1人増える。人数の試験（36人・警備7人）と予定の通しを直してから使う。
    EXTRA_VIP_GUARDS = False
    if EXTRA_VIP_GUARDS:
        fixed('vip_back_guard','裏階段の護衛','bodyguard','bodyguard',[('VIP席',6.6,22.2,3.14,3.5)],[(0,0,'idle')],'guard',security='post')
        fixed('vip_floor_guard','VIP席の護衛','bodyguard','bodyguard',[('VIP席',9.6,21.5,-1.57,3.5)],[(0,0,'idle')],'guard',security='post',face=('vip_guest',))
    for i in range(2):
        fixed(f'bartender_{i+1}',f'バーテンダー {i+1}','bartender','waiter',
              [('バー内',40+i*1.7,18+i*6,-1.57),('バー倉庫',39.6+i*1.3,31.7,1)],
              [(0,0,'serve')]+[(t+k*300+i*38,j,'serve' if j==0 else 'work') for k in range(5) for t,j in [(94,1),(133,0)]],
              face=('bartender','manager') if i==0 else ('manager',))
    fixed('bottle_server','ボトル係','bottle_server','sommelier',
          [('厨房',6.6,31.2,1),('VIP席',7.1,27.3,1.1,3.5)],
          [(0,0,'serve')]+[(t+k*280,j,'serve') for k in range(6) for t,j in [(77,1),(142,0)]])
    fixed('dj','DJ','dj','photographer',[('DJブース',24,32.6,3.14)],[(0,0,'work')],face=('technician',))
    fixed('technician','技術係','technician','delivery',
          [('機材室',34.7,32.5,1),('DJブース',28,32.8,-1.5),('キャットウォーク',26,29,3.14,3.5)],
          [(0,0,'work')]+[(t+k*300,j,'work') for k in range(5) for t,j in [(103,1),(157,2),(224,0)]],face=('dj',))
    fixed('chef','料理人','chef','chef',[('厨房',8.3,31.7,0),('厨房',10.8,34,3.14)],
          [(0,0,'cook')]+[(t+k*335,j,'cook') for k in range(5) for t,j in [(116,1),(193,0)]],face=('cleaner','manager'))
    fixed('cleaner','皿洗い','cleaner','cleaner',[('厨房',8.9,34.4,0),('搬入口',3.8,39.5,-1.6)],
          [(0,0,'clean')]+[(t+k*340,j,'clean') for k in range(5) for t,j in [(151,1),(203,0)]],face=('chef',))
    fixed('manager','店長','manager','guest_suit',[('事務所',16.25,32.6, -1.57),('バー内',42.2,27.3,-1.5)],
          [(0,0,'work')]+[(t+k*325,j,'work') for k in range(5) for t,j in [(123,1),(190,0)]],face=('bartender','bottle_server','chef'))
    v['checkpoints']=[dict(id='front_frisk',label='入口の身体検査',x=22,y=0,z=6,
      width=2.8,normal=dict(x=0,z=-1),zone='public',guardId='gate_frisk',weaponPolicy='no_weapons',
      exempt=['guard','bodyguard'])]
    v['hides']=[
      dict(id='locker-cloak',label='クロークのロッカー',x=10.45,y=0,z=8.1,heading=1.5707963267948966,capacity=1,
           approach=dict(x=1,z=0),size=dict(w=.65,d=.55,h=1.9)),
      dict(id='locker-kitchen',label='厨房のロッカー',x=13.4,y=0,z=33,heading=0,capacity=1,
           approach=dict(x=-1,z=0),size=dict(w=.65,d=1.2,h=1.9))]
    v['furniture']=[b for b in v['furniture'] if b['id']!='locker-static']
    v['furniture'] += [dict(id=h['id'],x=h['x'],y=h['y'],z=h['z'],floor=0,**h['size']) for h in v['hides']]
    v['furniture'].append(dict(id='safe-office',x=16.5,y=0,z=31.5,floor=0,w=.65,d=.65,h=.8,prefab='safe'))
    # 2026-11-03: every guard wears the black suit (bouncers included).
    # Enforcers (HITMAN): each staff outfit is seen through by the one or two people who work beside its wearer.
    assert len(v['npcs'])==(38 if EXTRA_VIP_GUARDS else 36)
