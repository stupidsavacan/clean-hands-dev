from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
P=Path(__file__).parent;m=json.loads((P/'../app/src/data/party.json').read_text(encoding='utf-8'));spec=json.loads((P/'../app/src/data/party-actions.json').read_text(encoding='utf-8'))
f=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',17);sm=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',13);title=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',25)
colors={'public':'#dceedd','staff':'#ffedce','secure':'#f8dad8','outer':'#dce8f4'}
def xy(x,z):return (80+(x+30)*20,90+(z+22.5)*20)
for floor,fn in [(-1,'b1'),(0,'1f'),(1,'2f'),(2,'attic')]:
 im=Image.new('RGB',(1440,1180),'#f7f8fa');d=ImageDraw.Draw(im);d.text((35,15),f'夜会の私邸 / {fn} / 1m = 20px（紙に印刷すると縮尺は変わります）',font=title,fill='#152d40')
 for x in range(-30,31,5):
  a=xy(x,-22.5);b=xy(x,22.5);d.line((*a,*b),fill='#d5dbe1');d.text((a[0],a[1]-25),str(x),font=sm,fill='#617381')
 for z in range(-20,23,5):
  a=xy(-30,z);b=xy(30,z);d.line((*a,*b),fill='#d5dbe1');d.text((a[0]-40,a[1]),str(z),font=sm,fill='#617381')
 for r in m['rooms']:
  if r['floor']!=floor:continue
  a=xy(r['minX'],r['minZ']);b=xy(r['maxX'],r['maxZ']);d.rectangle((*a,*b),fill=colors[r['type']],outline='#aebcc4');d.text((a[0]+5,a[1]+4),r['id']+' '+r['label'],font=sm,fill='#152d40')
 if floor==1:
  o=m['overlook'];d.rectangle((*xy(o['minX'],o['minZ']),*xy(o['maxX'],o['maxZ'])),fill='white',outline='#31516a');d.text(xy(o['minX'],o['minZ']),'吹抜',font=sm,fill='#31516a')
 for b in m['walls']+m['blockers']:
  if b.get('floor',0)!=floor:continue
  d.rectangle((*xy(b['x']-b['w']/2,b['z']-b['d']/2),*xy(b['x']+b['w']/2,b['z']+b['d']/2)),fill='#344551' if b in m['walls'] else '#938779')
 for st in m['stairs']:
  if floor*3.5 not in (st['low'],st['high']):continue
  a=xy(st['minX'],st['minZ']);b=xy(st['maxX'],st['maxZ']);d.rectangle((*a,*b),outline='#315fba',width=3);d.text((a[0],a[1]+5),'階段'+st['id'],font=sm,fill='#194b8c')
 for e in m['openings']:
  r=next(r for r in m['rooms'] if r['id']==e['a'])
  if r['floor']!=floor:continue
  x,z=(e['at'],e['fixed']) if e['axis']=='x' else (e['fixed'],e['at']);a=xy(x,z);d.ellipse((a[0]-5,a[1]-5,a[0]+5,a[1]+5),fill='#19896d');d.text((a[0]+7,a[1]-15),e['id'],font=sm,fill='#12634e')
 for t in m['traversals']:
  for side in ['start','end']:
   p=t[side]
   if abs(p['y']-floor*3.5)>.1:continue
   x,z=xy(p['x'],p['z']);d.rectangle((x-5,z-5,x+5,z+5),fill='#b03e38');d.text((x+7,z+3),t['id'],font=sm,fill='#b03e38')
 for h in m['hides']:
  if h['y']!=floor*3.5:continue
  x,z=xy(h['x'],h['z']);d.rectangle((x-6,z-5,x+6,z+5),fill='#4b63a9')
 for n in m['npcs']:
  if n['floor']!=floor:continue
  x,z=xy(n['route'][0][0],n['route'][0][1]);d.ellipse((x-3,z-3,x+3,z+3),fill='#b01830' if n['role']=='guard' else '#263b49')
 for c in m['checkpoints']:
  if floor!=0:continue
  x,z=xy(c['x'],c['z']);d.line((x-c['width']*10,z,x+c['width']*10,z),fill='#dc991a',width=5)
 for c in spec['clothes']:
  if c['pos']['y']!=floor*3.5:continue
  x,z=xy(c['pos']['x'],c['pos']['z']);d.text((x,z),'服',font=sm,fill='#7a218a')
 d.text((80,1040),'濃灰：壁　茶：家具　緑丸：開口番号　青枠：階段　赤四角：抜け道の両端',font=f,fill='#203c50')
 d.text((80,1080),'青箱：身体の収納　赤点：警備の初期位置　黒点：客・従業員　黄線：身体検査　紫：服',font=f,fill='#203c50')
 d.line((80,1130,280,1130),fill='black',width=5);d.text((290,1115),'10m / 北は上（zが小さい方）',font=f,fill='black');im.save(P/f'party-plan-{fn}.png')
# Edge-lane graph from the same source; each edge is numbered exactly once.
rows=[[-1,['W','T']],[0,['V','H','D','K','B','S','C','J','N','G']],[1,['R','Q','O','M','U','L']],[2,['A','X']]]
im=Image.new('RGB',(2300,2250),'white');d=ImageDraw.Draw(im);d.text((30,20),'区域の接続（実装データ） / 20区域・37接続',font=title,fill='black');nodes={r['id']:r for r in m['rooms']};edges=m['openings']+m['stairs']+m['traversals'];vertical=[]
for ri,(floor,ids) in enumerate(rows):
 y=100+ri*440;d.text((25,y),str(floor+1)+'階' if floor>=0 else '地下',font=title,fill='black');pos={id:(220+i*200,y+70) for i,id in enumerate(ids)}
 for id,(x,yy) in pos.items():d.rectangle((x-85,yy-25,x+85,yy+25),fill=colors[nodes[id]['type']],outline='#31516a');d.text((x-80,yy-20),id+' '+nodes[id]['label'],font=sm,fill='black')
 same=[e for e in edges if e['a'] in ids and e['b'] in ids]
 for i,e in enumerate(same):
  x,yy=pos[e['a']];xx,_=pos[e['b']];lane=y+125+i*19;color='#ad3d32' if e in m['traversals'] else '#31516a';d.line([(x,yy+25),(x,lane),(xx,lane),(xx,yy+25)],fill=color,width=2);d.rectangle((min(x,xx)+10,lane-10,min(x,xx)+44,lane+10),fill='white');d.text((min(x,xx)+12,lane-10),e['id'],font=sm,fill=color)
vertical=[e for e in edges if nodes[e['a']]['floor']!=nodes[e['b']]['floor']]
for i,e in enumerate(vertical):d.text((40+(i%4)*550,1930+(i//4)*60),e['id']+' '+e['a']+' ↔ '+e['b']+' '+e.get('kind','階段'),font=f,fill='#31516a')
d.text((40,2180),'赤：プレイヤー専用。窓には乗り越える腰壁があり、NPCの歩行格子には入りません。',font=f,fill='black');im.save(P/'party-graph.png')
print('scaled plans and graph written')

im=Image.new('RGB',(1500,900),'white');d=ImageDraw.Draw(im);d.text((30,20),'夜会：表から奥への層と外の縁',font=title,fill='black')
for i,(text,color) in enumerate([('外：V。正門は検査／使用人入口は服／塀は人目を避ける','#e7ebf0'),('客の環：H・D・B・G・N・R','#dceedd'),('裏の環：C・K・S・W・T・U・A・X','#ffedce'),('個人の核：Q（清掃員可）・O・M（護衛服）','#f8dad8')]):
 d.rectangle((35+i*90,90+i*100,1460-i*90,660-i*20),fill=color,outline='#31516a',width=2);d.text((50+i*90,105+i*100),text,font=f,fill='black')
d.text((350,520),'外の縁L：庭の雨どい → Q／O／Mの窓 → 屋根',font=f,fill='#923b38')
d.text((35,710),'主人：B 0–4分 → G 4–8分 → B 8–12分 → O 12–17分 → M 17–21分',font=f,fill='black')
d.text((35,755),'→ B 21–25分 → G 25–30分。移動には普通の開口と階段を使う。',font=f,fill='black')
d.text((35,825),'層は用途と許可の関係。実際の位置と距離は各階の縮尺付き平面図に示す。',font=f,fill='black');im.save(P/'party-layers.png')
