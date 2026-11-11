"""Generate the club's stage-three mission data without moving the existing map."""

def build(read, write):
    config = read('club-stage3.json')
    drop, meet = config['drop'], config['meet']
    layout = read('club-layout.json')
    layout.update(stage=3, name='クラブ 第3段階', exits=config['exits'])
    next(n for n in layout['npcs'] if n['id'] == 'investor')['target'] = True
    freezer = next(b for b in layout['furniture'] if b['id'] == 'machine-freezer')
    layout['hides'] = [h for h in layout['hides'] if h['id'] != freezer['id']]
    layout['hides'].append(dict(
        id=freezer['id'], label='厨房の冷凍庫', x=freezer['x'], y=freezer['y'], z=freezer['z'],
        heading=1.5707963267948966, capacity=1, approach=config['freezerApproach'],
        size={axis: freezer[axis] for axis in ('w', 'd', 'h')}))
    write('club-layout.json', layout)

    mission = read('club-mission.json')
    mission.update(title='貸し切りの夜', targets=['investor'],
                   briefing=[dict(id='investor', label='投資家', text='ファンドの成功を祝う今夜の主役。投資家を排除して脱出する。')])
    write('club-mission.json', mission)
    actions = read('club-actions.json')
    write('club-actions.json', {**{key: actions[key] for key in ('radius', 'clothes')}, 'acts': config['acts']})

    crowd = read('club-crowd.json')
    crowd.update(sight=dict(touch=.7, frontDot=.42, floorTolerance=1.25),
                 occlusion=dict(density=.31, depth=1.65, bottom=.35, top=1.72),
                 blend=dict(radius=1.4, people=2))
    write('club-crowd.json', crowd)

    def dialogue(place, speakers, lines, **extra):
        return dict(place=place, speakers=speakers, lines=lines, trigger=True, **extra)

    write('club-dialogue.json', dict(
        drop_mic=dialogue('dj_0', ['dj'], [['dj', '今夜は主役がドロップを押します！12分にお楽しみに']],
                          broadcastZone=drop['blackout']['zone'], window=[0, drop['times'][0]]),
        drop_mic_late=dialogue('dj_0', ['dj'], [['dj', '次も主役がドロップを押します！24分にお楽しみに']],
                               broadcastZone=drop['blackout']['zone'], window=[drop['times'][0], 1800]),
        drop_tech=dialogue('technician_0', ['technician'], [['technician', '舞台の配線がむき出しだ。誰かが触ったら終わりだぞ']]),
        meet_rumor=dialogue('bottle_server_0', ['bottle_server', 'chef'],
                            [['bottle_server', '社長はあとで裏に来るってさ。'], ['chef', '護衛は入れるなって。']])
    ))

    def chance(title, clue, rumor, window, steps):
        return dict(title=title, rumor=rumor, target='investor', trigger=dict(heard=clue),
                    window=window, steps=[dict(text=text, done=done) for text, done in steps])

    write('club-chances.json', dict(
        drop=chance('ドロップのボタン', 'drop_clue', 'フロアのDJの案内',
                    [drop['times'][0], drop['times'][0] + drop['graceSeconds']], [
                        ('機材室の近くで技術係の独り言を聞く', dict(any=[dict(flag='drop_tech'), dict(flag='drop_wires')])),
                        ('機材室で配線を外す。照明卓にも細工できる', dict(flag='drop_wires')),
                        ('投資家がボタンを押すのを待つ', dict(killed='investor', by='club_electrocution'))]),
        meet=chance('裏の密会', 'meet_clue', '厨房の立ち話か事務所の机のメモ',
                    [meet['time'], meet['time'] + meet['staySeconds']], [
                        ('裏の密会の手がかりをつかむ', dict(flag='meet_hint')),
                        ('18:00に搬入口へ。事務所の内線で前倒しもできる', dict(flag='meet_arrived')),
                        ('搬入口で投資家を排除する。冷凍庫に隠せる', dict(killed='investor', at='club_dock'))])
    ))

if __name__ == '__main__':
    raise SystemExit('Use build-club-source.py to preview generated data or export candidates.')
