"""Checks only design tables. Does not substitute for runtime navigation or LOS tests."""
from pathlib import Path
import runpy,json,re,math
P=Path(__file__).resolve().parent
a=runpy.run_path(str(P/'write-party-v2-people.py'));d=a['layout']
errors=set()
for id,role,ai,outfit,pr,off,face in a['people']:
 plan=a['profiles'][pr]
 assert plan[0][0]==0 and plan[-1][1]==1800
 assert all(plan[i][1]==plan[i+1][0] for i in range(len(plan)-1))
 for start,end,place,pose in plan:
  zone,x,y,z,heading=a['point'](place,off)
  for fid,f,bx,bz,w,dep,h,n in d['furniture']:
   if y==f*3.5 and abs(x-bx)<w/2+.25 and abs(z-bz)<dep/2+.25:errors.add((id,place,fid,'furniture'))
  for hid,f,hx,hz,area,n in d['hides']:
   if y==f*3.5 and abs(x-hx)<.85 and abs(z-hz)<.65:errors.add((id,place,hid,'hide'))
  for sid,za,zb,lo,hi,w in d['stairs']:
   if y not in [lo[1],hi[1]]:continue
   if lo[0]==hi[0]:within=abs(x-lo[0])<w/2+.25 and min(lo[2],hi[2])<z<max(lo[2],hi[2])
   else:within=abs(z-lo[2])<w/2+.25 and min(lo[0],hi[0])<x<max(lo[0],hi[0])
   if within:errors.add((id,place,sid,'stairs'))
missing=[]
for fn in ['party-v2-design.md','party-v2-coordinate-tables.md','party-v2-people.md']:
 for link in re.findall(r'\]\(([^)]+)\)',(P/fn).read_text(encoding='utf-8')):
  target=link.split('#')[0]
  if target and not (P/target).exists():missing.append((fn,target))
report={'scope':'design only','scheduleCoverage':'all 60 cover 0..1800 without gaps','npcDestinationCollisions':sorted(errors),'missingLocalLinks':missing,'notVerified':['runtime navigation','dynamic visibility','Ghost completion','player timing','performance']}
(P/'party-v2-consistency-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
assert not errors and not missing
