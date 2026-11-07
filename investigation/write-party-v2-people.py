"""Expand the design's 60 NPC schedules, without writing any runtime data."""
from pathlib import Path
import json, runpy
layout=runpy.run_path(str(Path(__file__).with_name('draw-party-v2-design.py')))
table,inz,furniture,hides,stairs=(layout[k] for k in ('table','inz','furniture','hides','stairs'))
P=Path(__file__).resolve().parent
# Place coordinates describe feet. Heading: east=0, north=90, west=180, south=270.
places={
 'gate':('H',26,0,7,270),'staffgate':('C',4,0,8,270),
 'C1':('C',4,0,25,90),'C2':('C',4,0,16,270),'C3':('C',3,0,11,180),
 'J1':('J',4,0,38,90),'J2':('J',8,0,43,180),
 'H1':('H',22,0,14,90),'H2':('H',18,0,12,180),
 'D1':('D',38,0,12,90),'D2':('D',46,0,13,180),
 'N1':('N',55,0,12,90),'N2':('N',57,0,21,180),
 'K1':('K',11.5,0,20,90),'K2':('K',18,0,22,180),
 'S1':('S',18.5,0,35,270),'S2':('S',14.5,0,39,90),
 'B1':('B',25,0,33,180),'B2':('B',46,0,29,270),'B3':('B',38,0,23,270),
 'P1':('P',35,0,30,90),'G1':('G',42,0,40,180),'G2':('G',48,0,37,90),
 'W1':('W',12,-3.5,25,270),'T1':('T',24,-3.5,33,90),
 'R1':('R',27.5,3.5,9,180),'R2':('R',46,3.5,10,270),'R3':('R',33,3.5,8.5,180),'R4':('R',48,3.5,10,270),'R5':('R',42,3.5,10,270),
 'U1':('U',34,3.5,14,270),'U2':('U',18,3.5,29,270),'U3':('U',13,3.5,22,90),
 'U4':('U',44,3.5,14,270),'U5':('U',24,3.5,14,270),'U6':('U',36,3.5,14,270),'U8':('U',47,3.5,14,270),
 'Q1':('Q',24,3.5,20,90),'Q2':('Q',24,3.5,24,180),
 'O1':('O',34,3.5,20,90),'O2':('O',38,3.5,23,180),
 'O3':('O',36,3.5,25,270),'M1':('M',46,3.5,20,90),'M2':('M',46,3.5,22,90),
}
def slots(*args):
 # Endpoint seconds, destination, posture. Intervals are half-open, cover 0..1800.
 out=[];start=0
 for end,place,pose in args:out.append((start,end,place,pose));start=end
 assert start==1800
 return out
def periodic(sequence,seconds=300):
 out=[]
 for t in range(0,1800,seconds):
  begin=t
  for end,place,pose in sequence:out.append((begin,t+end,place,pose));begin=t+end
 assert out[-1][1]==1800
 return out
profiles={
 'host':slots((480,'O2','talk'),(540,'B2','talk'),(610,'B1','wait'),(660,'O2','read'),(740,'O3','read'),(840,'B2','talk'),(870,'M1','wait'),(900,'M2','drink'),(1350,'G1','talk'),(1430,'B1','wait'),(1500,'B3','talk'),(1590,'O2','read'),(1660,'O3','read'),(1710,'M1','wait'),(1770,'M2','drink'),(1800,'G1','talk')),
 'gate':slots((1800,'gate','wait')),
 'staffgate':slots((1800,'staffgate','wait')),
 'west':periodic([(120,'C1','wait'),(240,'C2','wait'),(300,'C1','wait')]),
 'garden':slots((360,'G2','wait'),(750,'N1','wait'),(780,'G2','wait'),(930,'N1','wait'),(1020,'G2','wait'),(1200,'N1','wait'),(1350,'G2','wait'),(1500,'N1','wait'),(1650,'G2','wait'),(1770,'N1','wait'),(1800,'G2','wait')),
 'captain':periodic([(180,'U1','wait'),(240,'R2','wait'),(300,'U1','wait')]),
 'maintenance':slots((300,'U2','wait'),(420,'R5','wait'),(510,'U2','wait'),(630,'R5','wait'),(1320,'U2','wait'),(1470,'R5','wait'),(1800,'U2','wait')),
 'study':slots((450,'O1','wait'),(750,'U6','wait'),(960,'O1','wait'),(1500,'U6','wait'),(1690,'U6','wait'),(1800,'O1','wait')),
 'bedroom':slots((630,'M1','wait'),(900,'R4','wait'),(1650,'M1','wait'),(1770,'R4','wait'),(1800,'M1','wait')),
 'hallguard':slots((240,'D2','wait'),(330,'H2','wait'),(840,'D2','wait'),(930,'H2','wait'),(1800,'D2','wait')),
 'offduty':slots((60,'U4','wait'),(180,'R3','wait'),(1080,'U4','wait'),(1170,'R3','wait'),(1800,'U4','wait')),
 'chief':periodic([(150,'K2','cook'),(240,'S1','wait'),(300,'K2','cook')]),
 'cleaner':slots((240,'Q1','clean'),(360,'U3','clean'),(750,'Q1','clean'),(900,'U3','clean'),(1050,'Q1','clean'),(1200,'U3','clean'),(1800,'Q1','clean')),
 'delivery':periodic([(60,'C3','wait'),(180,'K1','serve'),(300,'C3','wait')]),
 'tools':periodic([(120,'J1','clean'),(240,'S2','wait'),(300,'J1','clean')]),
 'wine':periodic([(180,'W1','wait'),(300,'T1','wait')]),
 # 2026-11-03: the gossip lasts two minutes, not one (with the conversation now starting when the agent comes near).
 'clue_chandelier':slots((90,'K1','serve'),(240,'H1','talk'),(330,'K1','serve'),(480,'H1','talk'),(1050,'S1','wait'),(1200,'H1','talk'),(1800,'K1','serve')),
 'clue_papers':slots((180,'U5','wait'),(330,'R1','talk'),(570,'U5','wait'),(720,'R1','talk'),(1170,'U5','wait'),(1320,'R1','talk'),(1800,'U5','wait')),
 # The first drink gossip ends at 4:00 as before: W09 walking back through the hall later saw the guard knocked out
 # there on the 4:30 uniform route (route test 2026-11-03).
 'clue_drink':slots((120,'K1','serve'),(240,'D1','talk'),(600,'K1','serve'),(750,'D1','talk'),(900,'K1','serve'),(1050,'D1','talk'),(1800,'K1','serve')),
 'kitchen':periodic([(120,'K1','cook'),(240,'S1','clean'),(300,'K1','cook')]),
 'gardenstaff':periodic([(120,'J2','clean'),(240,'G1','clean'),(300,'J2','clean')]),
 'cellarstaff':periodic([(150,'T1','clean'),(240,'S2','wait'),(300,'T1','clean')]),
}
people=[('host','主人','guest','suit','host',(0,0),'なし')]
guardprof=['gate','staffgate','west','garden','captain','maintenance','study','bedroom','hallguard','offduty']
for i,pr in enumerate(guardprof,1):
 people.append((f'G{i:02}', ['正門','制服入口','搬入路','庭','隊長','保守','書斎護衛','寝室護衛','玄関警備','交代護衛'][i-1], 'guard','bodyguard' if i in [5,7,8,10] else 'guard',pr,(0,0),'護衛' if i==5 else 'なし'))
staffprof=['chief','cleaner','delivery','tools','wine','clue_chandelier','clue_chandelier','clue_papers','clue_drink','clue_drink','kitchen','kitchen','gardenstaff','gardenstaff','cellarstaff','cellarstaff','kitchen']
offsets=[(0,0),(0,0),(0,-1),(0,0),(0,0),(0,0),(1,0),(0,0),(0,1),(1,1),(-1,.7),(1,-1),(0,0),(0,1),(0,0),(1,0),(-1,-.7)]
for i,(pr,off) in enumerate(zip(staffprof,offsets),1):
 outfit='cleaner' if i in [2,4,13,14,15,16] else 'waiter'
 people.append((f'W{i:02}',pr,'waiter',outfit,pr,off,'給仕' if i==1 else '清掃' if i==2 else 'なし'))
# Guests have four routes, eight distinct standing offsets each. Never occupy B1 or rainpipe bay.
guest_routes=[['D2','N2','G1','P1','B2','D2'],['N2','G1','P1','B2','D2','N2'],['G1','P1','B2','D2','N2','G1'],['P1','B2','D2','N2','G1','P1']]
for g,route in enumerate(guest_routes):
 profiles[f'guests{g+1}']=slots(*[(300*(i+1),dest,'talk' if i%2==0 else 'wait') for i,dest in enumerate(route)])
 for j in range(8):
  # +/-1.5m x and +/-0.6m z: avoid furniture and keep separate people.
  off=([-1.5,-.5,.5,1.5][j%4],-.6 if j<4 else .6)
  people.append((f'P{g*8+j+1:02}','招待客','guest','suit',f'guests{g+1}',off,'なし'))

def ts(sec):return f'{sec//60:02}:{sec%60:02}'
def point(place,off):
 zone,x,y,z,heading=places[place]
 return zone,round(x+off[0],2),y,round(z+off[1],2),heading

def main():
 s='# 第2版：全員の30分予定\n\n'
 s+='設計値。時刻はゲーム内の秒を分:秒で表示。区間は開始を含み終了を含まない。30:00で繰り返す。初期位置は各人の最初の目的地。表の時間には移動を含む。予定開始後30秒を到着余裕として確保し、実コードで遅着を測る。下記はゲームデータではなく実装の入力表。\n\n'
 s+='## 場所\n\n座標は足元。向きは東0°、北90°。姿勢は既存の文字列で表す。talk/serve/clean/cook/readは世界の設備を変更しない。\n\n'
 s+=table(['場所','区域','x','y','z','向き°'],[(id,*v) for id,v in places.items()])
 s+='\n主人のO3は書類を準備したときだけ窓辺へ向ける。未準備なら同じ区間の目的地はO2。専用チャンスが11:00–12:20と26:30–27:40にO3を上書きし、突き落とし操作は11:30以降／27:00以降に実位置を確認して出す。各窓の終わりに上書きを解除する。\n\n'
 s+='## 全員の持場と予定\n\n補正は各目的地の(x,z)へ足す。全60人を以下に列挙。会話のW06/W07とW09/W10は1m離す。客は4組×8人、各組に別の予定と8つの別座標を持つ。許可は区域表の職種を使う。roleは既存の3種類に限定する。\n\n'
 s+=table(['ID','役割','AI role','服','予定型','座標補正(x,z)','顔を知る服'],people)
 s+='\n## 各予定型の全区間\n\n'
 for pr,plan in profiles.items():
  s+='### '+pr+'\n\n'+table(['開始','終了','場所','姿勢'],[(ts(a),ts(b),c,d) for a,b,c,d in plan])+'\n'
 s+='## 移動経路の制約\n\n'
 s+='客はH–D–N–G–P–Bの開口で移動する。最短経路が厨房へ入る場合は予定中継点を足し、禁止区域を通らせない。庭の客の目的地はx≤43.5、X3下の48付近へ行かせない。GからBへはP–Bの西開口か、17の東開口。B1の円半径1.5mを9:00–10:20と22:30–24:00には客の通過にも使わない。窓の外縁には人を置かない。\n\n'
 s+='U–Rは21。K–WはS3。T–SはS4。S–UはS5。Q–O–Mは25/26。G07/G08/G10の移動は私室間かU/Rだけに収める。移動の時刻は目的地への瞬間移動ではない。30秒以内に着かない場合、出発を早め、保護した窓を狭めずに前の予定を短くする。\n\n'
 s+='客室清掃W02はQ1=(24,3.5,20)。G10はR3で休憩する。W02は4:00–6:00と18:00–20:00にはU3へ出る。G10はF23とF16の陰におり、H11へ収納する。服取得の安全時間は移動余裕後の1:30–3:00／18:30–19:30。初見の窓を逃しても後半の飲み物・書類に使える。\n\n'
 s+='## 会話の到着と発見\n\n'
 s+=table(['発見ID','話者','場所','会話可能時間','到着予定'],[
  ('chandelier','W06/W07','H1','2:00–3:00 / 6:00–7:00 / 18:00–19:00','1:30 / 5:30 / 17:30出発'),
  ('papers','W08','R1','4:00–5:00 / 10:30–11:30 / 20:30–21:30','3:30 / 10:00 / 20:00出発'),
  ('drink','W09/W10','D1','3:00–4:00 / 11:00–12:00 / 16:00–17:00','2:30 / 10:30 / 15:30出発')])
 s+='\n既存DialogueSystemのwindowは1区間なので、再機会は別の会話ID（例chandelier_2/3）として同じ内容を定義する。専用チャンスでIDを基底IDへ対応付け、発見済みなら二重発行しない。各セリフ30文字以内。屋内の会話距離は既存値を使う。言葉を最後まで聞かなければ発見扱いにしない。\n\n'
 s+='## 個人ごとに展開した実装表\n\nこちらは型参照を使わず各人の目的地座標まで展開したもの。予定の実装はこの表と同じ内容になること。\n\n'
 expanded=[];errors=[]
 for id,role,ai,outfit,pr,off,face in people:
  plan=profiles[pr];rows=[]
  for a,b,place,pose in plan:
   zone,x,y,z,heading=point(place,off)
   if not inz(x,z,zone):errors.append(f'{id} {place} outside {zone}')
   rows.append((ts(a),ts(b),zone,(x,y,z),heading,pose))
   expanded.append({'id':id,'from':a,'to':b,'zone':zone,'position':[x,y,z],'heading':heading,'pose':pose})
  s+='### '+id+'\n\n'+table(['開始','終了','区域','足元(x,y,z)','向き°','姿勢'],rows)+'\n'
 assert len(people)==60
 stationary=[id for id,_,_,_,pr,off,_ in people if len(set(row[2] for row in profiles[pr]))==1]
 assert len(stationary)==2,stationary
 assert not errors,errors
 (P/'party-v2-people.md').write_text(s,encoding='utf-8')
 report={'people':len(people),'fixed':stationary,'moving':len(people)-len(stationary),'expandedIntervals':len(expanded),'outsideZone':errors,'status':'design validation only; travel/vision unverified'}
 (P/'party-v2-people-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__': main()
