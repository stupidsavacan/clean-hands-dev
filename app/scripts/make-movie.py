"""Cut the observatory's introduction movie from the filmed takes (2026-11-13).

  python scripts/make-movie.py            ->  movie/observatory-intro.mp4  (1920x1080, 30 fps, with sound)
  python scripts/make-movie.py --sheet    ->  movie/work/storyboard.jpg    (one picture per cut, to check the edit)

The takes are the game itself, filmed by observatory-trailer.html into movie/frames/<take>/ (tools/film.py).
This script only edits: which frames of which take, in what order; the titles and captions; a film look
(letterbox, a mild grade, vignette, grain); and the sound track, which is synthesized here (rain, wind, thunder,
machines and a slow score) and placed against the same cut list, so picture and sound cannot drift apart.
Needs: pip install pillow numpy scipy imageio-ffmpeg.
"""
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import signal
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent.parent
MOVIE = ROOT / 'movie'
FRAMES = MOVIE / 'frames'
WORK = MOVIE / 'work'
W, H, FPS = 1920, 1080, 30
BAR = 138  # letterbox bars: the picture is 1920x804 (2.39:1)
FONTS = Path('C:/Windows/Fonts')
MINCHO = str(FONTS / 'yumindb.ttf')
GOTHIC = str(FONTS / 'YuGothM.ttc')
LATIN = str(FONTS / 'bahnschrift.ttf') if (FONTS / 'bahnschrift.ttf').exists() else GOTHIC

# ---- the cut list ---------------------------------------------------------------------------------------------------
# kind 'take': frames [start, start+n) of a filmed take.  kind 'card': black with words.
# captions: (text, from second, to second) within the cut.  sound: what the place sounds like.
# events: (name, second within the cut) for one-off sounds.
CUTS = [
    dict(id='open', kind='card', n=96, lines=[('標高二三〇〇メートル。台風の夜。', 0.4, 2.9)], place='black', events=[('thunder_far', 0.9)]),
    dict(id='approach', kind='take', take='approach', start=6, n=112, place='out', fade_in=14),
    dict(id='title', kind='take', take='aerial', start=40, n=226, place='out_wide', title=('星見岳天文台', '嵐の観望会', 0.7, 6.4)),
    dict(id='lobby', kind='take', take='lobby', start=24, n=126, place='in', captions=[('観望会は中止。後援者たちは、山を下りられない。', 0.4, 3.8)]),
    dict(id='target', kind='take', take='target', start=24, n=162, place='in',
         captions=[('標的 ―― 天文台の所長', 0.5, 4.9)], sub=('衛星追跡データを横流ししている', 1.2, 4.9)),
    dict(id='three', kind='card', n=114, lines=[('この山では、三つのものが繋がっている。', 0.3, 3.5), ('嵐　　電気　　空気', 1.6, 3.5)], place='black',
         second_big=True),
    dict(id='reveal', kind='take', take='aerial', start=266, n=176, place='out_wide', events=[('zap', 'flash'), ('thunder_near', 'flash+0.1')]),
    dict(id='pole', kind='take', take='pole', start=56, n=82, place='out', captions=[('嵐が、送電線を断つ。', 0.2, 1.9)],
         events=[('zap', 'flash'), ('thunder_near', 'flash+0.08'), ('powerdown', 'flash+0.1')]),
    dict(id='blackout', kind='take', take='blackout', start=16, n=96, place='in_dark', captions=[('停電。', 0.4, 2.8)]),
    dict(id='facade', kind='take', take='facade', start=96, n=186, place='out',
         captions=[('発電機は、すべてを賄えない。', 3.4, 5.9)], events=[('powerup', 'lights')]),
    dict(id='generator', kind='take', take='generator', start=8, n=72, place='generator'),
    dict(id='stove', kind='take', take='stove', start=20, n=150, place='in_fire', captions=[('暖房が止まる。人は、火のそばへ集まる。', 0.4, 4.6)]),
    dict(id='use', kind='card', n=84, lines=[('繋がりは、切ることも、使うこともできる。', 0.3, 2.6)], place='black'),
    dict(id='valve', kind='take', take='valve', start=20, n=196, place='lab', captions=[('空気は、警告しない。', 3.4, 6.2)], events=[('hiss', 3.0)]),
    dict(id='fog', kind='take', take='fog', start=6, n=84, place='lab', events=[('hiss', 0.0)]),
    dict(id='enter', kind='take', take='enter', start=0, n=300, place='lab_quiet', events=[('thud', 'fall')]),
    dict(id='dome', kind='take', take='dome', start=30, n=132, place='out_calm', captions=[('嵐の切れ間、ドームが開く。', 0.4, 4.0)]),
    dict(id='crank', kind='take', take='crank', start=30, n=168, place='out', captions=[('雨が戻る。シャッターは、閉まらない。', 0.4, 4.8)],
         events=[('crank', 0.0)]),
    dict(id='strike', kind='take', take='strike', start=60, n=170, place='out_wide', captions=[('雷は、相手を選ばない。', 0.3, 2.4)],
         events=[('zap', 'flash'), ('thunder_near', 'flash+0.08')]),
    dict(id='exit', kind='take', take='exit', start=50, n=236, place='out', captions=[('すべては、事故に見える。', 1.0, 4.6)],
         events=[('zap', 'flash'), ('thunder_near', 'flash+0.1')], fade_out=30),
    dict(id='end', kind='card', n=168, end=('CLEAN HANDS', '星見岳天文台 ―― 嵐の観望会', 0.5, 5.2), place='black'),
]

# Moments that are read from the pictures or set by hand, in seconds from the start of their cut.
#  'flash': the first frame of a cut that is much brighter than the cut's usual (lightning).
#  'lights' (facade): when the windows come back on.  'fall' (enter): when the director goes down.
MARKS = {'lights': 3.6, 'fall': 5.6}

# The take 'enter' is long; these two frame numbers are where he comes in and a little after he falls
# (set by looking at the storyboard of that take: python scripts/make-movie.py --enter).
ENTER = (40, 300)


_flash = {}


def flash_second(cut):
    """Seconds into the cut at which lightning first lights the picture (None if it never does)."""
    key = cut['id']
    if key not in _flash:
        levels = [np.asarray(Image.open(FRAMES / cut['take'] / f'{cut_start(cut) + k:05d}.jpg').resize((64, 36))).mean() for k in range(cut_frames(cut))]
        usual = float(np.median(levels))
        hit = next((k for k, v in enumerate(levels) if v > usual * 1.45 + 4), None)
        _flash[key] = None if hit is None else hit / FPS
        print('flash', key, _flash[key])
    return _flash[key]


def event_second(cut, at):
    if isinstance(at, (int, float)):
        return float(at)
    name, _, extra = at.partition('+')
    base = flash_second(cut) if name == 'flash' else MARKS[name]
    return None if base is None else base + float(extra or 0)


def cut_frames(cut):
    return ENTER[1] - ENTER[0] if cut.get('take') == 'enter' else cut['n']


def cut_start(cut):
    return ENTER[0] if cut.get('take') == 'enter' else cut['start']


# ---- words ----------------------------------------------------------------------------------------------------------
def font(path, size):
    return ImageFont.truetype(path, size)


def spaced(draw, xy, text, fnt, fill, spacing):
    """Draw text with letter spacing, centred on xy[0]."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = xy[0] - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, xy[1]), ch, font=fnt, fill=fill)
        x += w + spacing


def words(text, path, size, spacing, y, glow=True):
    """A transparent 1920x1080 layer with one centred line (and a soft dark halo so it reads on any picture)."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if glow:
        shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        spaced(ImageDraw.Draw(shadow), (W / 2, y), text, font(path, size), (0, 0, 0, 255), spacing)
        shadow = shadow.filter(ImageFilter.GaussianBlur(7))
        layer = Image.alpha_composite(layer, shadow)
        layer = Image.alpha_composite(layer, shadow)
    spaced(ImageDraw.Draw(layer), (W / 2, y), text, font(path, size), (238, 240, 244, 255), spacing)
    return np.asarray(layer).astype(np.float32) / 255


def ramp(t, start, end, fade=0.55):
    """0..1: fades in after `start`, out before `end`."""
    if t <= start or t >= end:
        return 0.0
    k = min((t - start) / fade, (end - t) / fade, 1.0)
    return k * k * (3 - 2 * k)


def layers_for(cut):
    """[(layer, from, to)] for a cut."""
    out = []
    for text, a, b in cut.get('captions', []):
        out.append((words(text, MINCHO, 44, 7, H - BAR - 92), a, b))
    if 'sub' in cut:
        text, a, b = cut['sub']
        out.append((words(text, GOTHIC, 25, 5, H - BAR - 40), a, b))
    if 'title' in cut:
        big, small, a, b = cut['title']
        out.append((words(big, MINCHO, 132, 34, 392), a, b))
        out.append((words(small, MINCHO, 44, 30, 566), a + .5, b))
    if cut['kind'] == 'card':
        if 'big' in cut:
            out.append((words(cut['big'], LATIN, 74, 30, 470, glow=False), .5, cut['n'] / FPS - .4))
            out.append((words(cut['small'], MINCHO, 30, 16, 580, glow=False), 1.3, cut['n'] / FPS - .4))
        lines = cut.get('lines', [])
        for i, (text, a, b) in enumerate(lines):
            second = i == 1 and cut.get('second_big')
            y = 500 if len(lines) == 1 else (452 if i == 0 else 560)
            out.append((words(text, MINCHO, 58 if second else 46, 26 if second else 9, y, glow=False), a, b))
        if 'end' in cut:
            big, small, a, b = cut['end']
            out.append((words(big, LATIN, 86, 34, 440, glow=False), a, b))
            out.append((words(small, MINCHO, 32, 12, 580, glow=False), a + .5, b))
    return out


# ---- the film look --------------------------------------------------------------------------------------------------
def look_tables():
    x = np.arange(256) / 255
    s = x * x * (3 - 2 * x)
    base = x * .55 + s * .45  # a little more contrast
    r = np.clip(base * 1.03 + .004, 0, 1)
    g = np.clip(base * 1.0, 0, 1)
    b = np.clip(base * .97 + .022 * (1 - x), 0, 1)  # cooler shadows, warmer lights
    return [(c * 255).astype(np.uint8) for c in (r, g, b)]


def vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2) * .62)
    return (1 - .34 * np.clip(d - .35, 0, 1) ** 1.6)[..., None].astype(np.float32)


def load(take, n):
    path = FRAMES / take / f'{n:05d}.jpg'
    return Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)


def render(sheet=False):
    tables, vig, rng = look_tables(), vignette(), np.random.default_rng(7)
    total = sum(cut_frames(c) for c in CUTS)
    if sheet:
        thumbs = []
    else:
        cmd = [imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', str(WORK / 'sound.wav'),
               '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
               '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', str(MOVIE / 'observatory-intro.mp4')]
        pipe = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    done = 0
    for cut in CUTS:
        n, layers = cut_frames(cut), layers_for(cut)
        picks = [n // 2] if sheet else range(n)
        for k in picks:
            t = k / FPS
            if cut['kind'] == 'take':
                img = np.asarray(load(cut['take'], cut_start(cut) + k))
                img = np.stack([tables[i][img[..., i]] for i in range(3)], axis=-1).astype(np.float32) / 255
                img *= vig
                img += rng.normal(0, .012, (H // 2, W // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1)
                fade = 1.0
                if cut.get('fade_in'):
                    fade = min(fade, (k + 1) / cut['fade_in'])
                if cut.get('fade_out'):
                    fade = min(fade, (n - k) / cut['fade_out'])
                # Every cut breathes in and out of black for two frames, so cuts do not pop.
                fade = min(fade, (k + 1) / 3, (n - k) / 3, 1.0)
                img *= fade
                img[:BAR] = 0
                img[H - BAR:] = 0
            else:
                img = np.zeros((H, W, 3), np.float32)
            for layer, a, b in layers:
                alpha = ramp(t, a, b)
                if alpha > 0:
                    m = layer[..., 3:4] * alpha
                    img = img * (1 - m) + layer[..., :3] * m
            frame = (np.clip(img, 0, 1) * 255 + .5).astype(np.uint8)
            if sheet:
                label = cut.get('take', 'card')
                thumbs.append((label, Image.fromarray(frame).resize((480, 270), Image.LANCZOS)))
            else:
                pipe.stdin.write(frame.tobytes())
                done += 1
                if done % 300 == 0:
                    print(f'{done}/{total}', flush=True)
    if sheet:
        cols = 5
        rows = math.ceil(len(thumbs) / cols)
        board = Image.new('RGB', (cols * 480, rows * 270))
        for i, (label, im) in enumerate(thumbs):
            board.paste(im, ((i % cols) * 480, (i // cols) * 270))
            ImageDraw.Draw(board).text(((i % cols) * 480 + 8, (i // cols) * 270 + 6), f'{i + 1} {label}', font=font(GOTHIC, 18), fill=(255, 220, 120))
        board.save(WORK / 'storyboard.jpg', quality=88)
        print('storyboard', len(thumbs), 'cuts', total / FPS, 's')
    else:
        pipe.stdin.close()
        pipe.wait()
        print('wrote', MOVIE / 'observatory-intro.mp4', total / FPS, 's')


# ---- sound ----------------------------------------------------------------------------------------------------------
SR = 48000


def noise(n, rng):
    return rng.standard_normal(n).astype(np.float32)


def filt(x, kind, freq, order=2):
    sos = signal.butter(order, freq, kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x).astype(np.float32)


def env_points(n, points):
    """A curve through (second, value) points."""
    t = np.arange(n) / SR
    return np.interp(t, [p[0] for p in points], [p[1] for p in points]).astype(np.float32)


def place(track, clip, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= track.shape[0]:
        return
    clip = clip[: track.shape[0] - i]
    if clip.ndim == 1:
        track[i:i + len(clip), 0] += clip * gain * (1 - max(0, pan))
        track[i:i + len(clip), 1] += clip * gain * (1 + min(0, pan))
    else:
        track[i:i + len(clip)] += clip * gain


def thunder(rng, near):
    n = int(SR * (7.5 if near else 9))
    t = np.arange(n) / SR
    out = np.zeros((n, 2), np.float32)
    for ch in range(2):
        x = noise(n, rng)
        low = filt(x, 'low', 90, 3) * 5 + filt(x, 'low', 260, 2) * 1.6
        roll = np.exp(-t / (2.6 if near else 3.4)) * (1 + .5 * np.sin(2 * np.pi * (.7 + ch * .13) * t + rng.uniform(0, 6)) * np.exp(-t / 3))
        body = low * roll
        if near:
            crack = filt(x, 'band', [500, 4200], 2) * np.exp(-t / .09) * 2.6 + filt(x, 'band', [200, 1500], 2) * np.exp(-t / .35) * 1.4
            body += crack
        else:
            body *= np.clip(t / .8, 0, 1)
        out[:, ch] = body
    out[:, 0] += np.sin(2 * np.pi * 38 * t) * np.exp(-t / 1.2) * (.9 if near else .3)
    out[:, 1] += np.sin(2 * np.pi * 38 * t) * np.exp(-t / 1.2) * (.9 if near else .3)
    return out * (.9 if near else .45)


def tone(freq, seconds, harmonics, decay, attack=.01):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * freq * (i + 1) * t) for i, a in enumerate(harmonics))
    return (x * np.exp(-t / decay) * np.clip(t / attack, 0, 1)).astype(np.float32)


def pad(freqs, seconds, rng, bright=900):
    """A slow chord: detuned saws through a low-pass, with a long swell."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = np.zeros((n, 2), np.float32)
    for f in freqs:
        for ch in range(2):
            for det in (-.4, .3):
                ph = rng.uniform(0, 1)
                out[:, ch] += (2 * ((f * (1 + det * .004 + ch * .0015) * t + ph) % 1) - 1).astype(np.float32)
    out = np.stack([filt(out[:, ch], 'low', bright, 2) for ch in range(2)], 1)
    swell = np.clip(t / (seconds * .35), 0, 1) * np.clip((seconds - t) / (seconds * .4), 0, 1)
    return out * swell[:, None] / (len(freqs) * 4)


def reverb(x, rng, seconds=3.2, wet=.35):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = x.copy()
    for ch in range(2):
        ir = noise(n, rng) * np.exp(-t / (seconds / 5))
        ir = filt(ir, 'low', 3800, 1)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] += signal.fftconvolve(x[:, ch], ir)[: len(x)] * wet
    return out


def sound():
    rng = np.random.default_rng(1124)
    starts, at = [], 0.0
    for cut in CUTS:
        starts.append(at)
        at += cut_frames(cut) / FPS
    total = at
    n = int(SR * (total + .5))
    t = np.arange(n) / SR
    amb = np.zeros((n, 2), np.float32)
    fx = np.zeros((n, 2), np.float32)
    music = np.zeros((n, 2), np.float32)

    # The storm bed: rain and wind whose level and muffling follow where the camera is.
    PLACES = {  # rain, wind, low-pass on the rain (Hz), room tone
        'black': (.10, .10, 2500), 'out': (.55, .45, 9000), 'out_wide': (.7, .7, 9000), 'out_calm': (.16, .3, 9000),
        'in': (.13, .08, 1400), 'in_dark': (.16, .1, 1400), 'in_fire': (.12, .07, 1300), 'generator': (.14, .08, 1500),
        'lab': (.04, .02, 900), 'lab_quiet': (.03, .02, 800),
    }
    keys_rain, keys_wind, keys_bright = [], [], []
    for cut, s in zip(CUTS, starts):
        rain, wind, bright = PLACES[cut['place']]
        e = s + cut_frames(cut) / FPS
        for keys, v in ((keys_rain, rain), (keys_wind, wind), (keys_bright, bright)):
            keys.append((s + .12, v))
            keys.append((e - .12, v))
    rain_env, wind_env, bright_env = (env_points(n, k) for k in (keys_rain, keys_wind, keys_bright))
    for ch in range(2):
        x = noise(n, rng)
        open_rain = filt(filt(x, 'high', 1400), 'low', 9000)
        dull_rain = filt(x, 'low', 1100, 2) * 2.2
        mixk = np.clip((bright_env - 1000) / 6000, 0, 1)
        amb[:, ch] += (open_rain * mixk + dull_rain * (1 - mixk)) * rain_env * .16
        w = filt(noise(n, rng), 'band', [180, 620], 2)
        lfo = .6 + .4 * np.sin(2 * np.pi * .11 * t + ch * 1.3) * np.sin(2 * np.pi * .037 * t + 2)
        amb[:, ch] += w * wind_env * lfo * 1.5
    # Machines and rooms that have a sound of their own.
    for cut, s in zip(CUTS, starts):
        d = cut_frames(cut) / FPS
        m = int(d * SR)
        tt = np.arange(m) / SR
        edge = np.clip(tt / .15, 0, 1) * np.clip((d - tt) / .15, 0, 1)
        if cut['place'] == 'generator':
            hum = sum(a * (2 * ((f * tt) % 1) - 1) for f, a in ((52, .5), (104, .3), (157, .18)))
            hum = filt(hum.astype(np.float32), 'low', 420, 2) * (1 + .12 * np.sin(2 * np.pi * 13 * tt))
            place(fx, hum * edge * .5, s)
        if cut['place'] == 'in_fire':
            crackle = (rng.random(m) > .9993).astype(np.float32) * rng.uniform(.3, 1, m).astype(np.float32)
            crackle = filt(signal.lfilter([1], [1, -.985], crackle).astype(np.float32), 'band', [900, 5000], 2)
            place(fx, crackle * edge * .9, s, pan=-.3)
            place(fx, filt(noise(m, rng), 'low', 300, 2) * edge * .05, s)
        if cut['place'] in ('in', 'in_dark'):
            place(fx, np.sin(2 * np.pi * 100 * tt).astype(np.float32) * edge * (.012 if cut['place'] == 'in' else 0), s)
        for name, at in cut.get('events', []):
            at = event_second(cut, at)
            if at is None:
                continue
            when = s + at
            if name == 'thunder_far':
                place(fx, thunder(rng, False), when, 1.0)
            elif name == 'thunder_near':
                place(fx, thunder(rng, True), when, 1.25)
            elif name == 'zap':
                z = int(SR * .5)
                zt = np.arange(z) / SR
                crack = filt(noise(z, rng), 'high', 2500) * np.exp(-zt / .05) * 1.2 + np.sign(np.sin(2 * np.pi * 110 * zt)) * np.exp(-zt / .12) * .35
                place(fx, crack.astype(np.float32), when, .9)
            elif name == 'powerdown':
                z = int(SR * 2.2)
                zt = np.arange(z) / SR
                sweep = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-zt / .5) + 22) / SR) * np.exp(-zt / .7)
                place(fx, sweep.astype(np.float32), when, .5)
                place(fx, tone(55, .5, [1, .4], .12), when, 1.1)
            elif name == 'powerup':
                z = int(SR * 2.4)
                zt = np.arange(z) / SR
                sweep = np.sin(2 * np.pi * np.cumsum(30 + 75 * (1 - np.exp(-zt / .8))) / SR) * np.clip(zt / .3, 0, 1) * np.exp(-zt / 1.3)
                place(fx, filt(sweep.astype(np.float32), 'low', 500, 2), when, .55)
                place(fx, tone(1800, .08, [1], .02), when + .05, .12)
            elif name == 'hiss':
                hs = filt(noise(m, rng), 'band', [2600, 9000], 2) * edge * (1 + .15 * np.sin(2 * np.pi * 5 * tt))
                place(fx, hs.astype(np.float32), s, .11, pan=.25)
            elif name == 'thud':
                place(fx, tone(62, .7, [1, .5, .2], .11) + filt(noise(int(SR * .7), rng), 'low', 500, 2) * np.exp(-np.arange(int(SR * .7)) / SR / .06) * .6, when, 1.0)
            elif name == 'crank':
                for i in range(int(d / .62)):
                    c = int(SR * .2)
                    ct = np.arange(c) / SR
                    sq = filt(noise(c, rng), 'band', [1700 + 250 * (i % 2), 2600 + 250 * (i % 2)], 2) * np.sin(np.pi * ct / .2) ** 2
                    place(fx, sq.astype(np.float32), s + .3 + i * .62, .12, pan=-.2)

    # The score: a low drone in D, slow chords, a few bell notes, a pulse while things are being arranged.
    D = 36.71
    drone = np.zeros(n, np.float32)
    for f, a in ((D, .5), (D * 2, .35), (D * 3, .12)):
        drone += a * (2 * ((f * t + .3) % 1) - 1).astype(np.float32)
    drone = filt(drone, 'low', 170, 2) * (1 + .15 * np.sin(2 * np.pi * .07 * t))
    S = {cut['id']: st for cut, st in zip(CUTS, starts)}
    lab_at = S['valve']
    enter_at = S['enter']
    fall_at = enter_at + MARKS['fall']
    strike_at = S['strike'] + (flash_second(CUTS[[c['id'] for c in CUTS].index('strike')]) or 3.0)
    end_at = S['end']
    drone_env = env_points(n, [(0, 0), (3, .5), (S['three'], .7), (S['reveal'], .85), (lab_at, .9), (fall_at - .5, 1.0), (fall_at + .2, .25),
                               (S['dome'], .6), (strike_at - .2, 1.1), (strike_at + .3, .25), (S['exit'], .6), (end_at, .5), (total - 1.5, .35), (total, 0)])
    music[:, 0] += drone * drone_env * .34
    music[:, 1] += drone * drone_env * .34
    chords = {'Dm': (146.83, 174.61, 220.0), 'Bb': (116.54, 146.83, 174.61), 'Gm': (98.0, 116.54, 146.83), 'A': (110.0, 138.59, 164.81),
              'Dm9': (146.83, 174.61, 220.0, 329.63), 'F': (174.61, 220.0, 261.63)}
    plan = [(S['approach'], 'Dm', 9, .5), (S['title'] + 1, 'Bb', 8, .5), (S['lobby'], 'Gm', 7, .4), (S['target'], 'A', 7, .4), (S['three'], 'Dm9', 6, .45),
            (S['reveal'], 'Bb', 7, .45), (S['blackout'], 'Gm', 8, .42), (S['facade'] + 3, 'F', 7, .4), (S['stove'], 'Dm', 7, .4), (S['use'], 'A', 5, .4),
            (lab_at, 'Dm', 10, .45), (S['fog'], 'Bb', 8, .4), (enter_at + 1.5, 'Gm', 8, .4),
            (S['dome'], 'F', 7, .45), (S['crank'], 'Bb', 7, .5), (S['strike'] - 1.5, 'A', 5, .6), (S['exit'] + .5, 'Dm', 9, .55), (end_at + .3, 'Dm9', 6.5, .6)]
    for when, name, secs, gain in plan:
        place(music, pad(chords[name], secs, rng), when, gain * 1.5)
    # Bell notes (D minor, sparse).
    bell = lambda f, g=1.0: tone(f, 4.5, [1, .0, .32, 0, .12, 0, .05], 1.5, .004) * g
    notes = [(S['approach'] + .6, 587.33), (S['approach'] + 2.4, 698.46), (S['title'] + .8, 880.0), (S['title'] + 3.0, 659.25), (S['title'] + 5.2, 587.33),
             (S['lobby'] + .8, 523.25), (S['lobby'] + 2.6, 466.16), (S['target'] + .9, 440.0), (S['target'] + 2.9, 554.37), (S['three'] + 1.6, 293.66),
             (S['stove'] + 1, 523.25), (S['stove'] + 3, 440.0), (lab_at + 1, 587.33), (lab_at + 3.5, 698.46), (S['fog'] + 1, 466.16),
             (S['dome'] + 1, 698.46), (S['dome'] + 3, 880.0), (S['crank'] + 1, 932.33), (S['crank'] + 3.4, 880.0),
             (S['exit'] + 1.2, 587.33), (S['exit'] + 3.2, 698.46), (end_at + .8, 587.33), (end_at + 1.6, 880.0)]
    for i, (when, f) in enumerate(notes):
        place(music, bell(f), when, .07, pan=(-.35 if i % 2 else .35))
    # A heartbeat pulse under the two set-ups, stopping dead when he falls and when the bolt lands.
    beat = tone(48, .4, [1, .5], .09)
    for a, b, period in ((lab_at, fall_at - .4, .92), (S['crank'], strike_at - .3, .8)):
        k = 0
        while a + k * period < b:
            g = .25 + .45 * (k * period / (b - a))
            place(music, beat, a + k * period, g)
            place(music, beat, a + k * period + .22, g * .6)
            k += 1
    # The bolt: one low hit with a long tail.
    place(music, tone(36.7, 5, [1, .6, .3, .1], 1.6, .002), strike_at, .9)

    music = reverb(music, rng)
    fx = reverb(fx, rng, 2.2, .18)
    mix = amb * .9 + fx * .9 + music * 1.0
    # Fade the whole track in and out, tame the peaks.
    mix *= (np.clip(t / 1.2, 0, 1) * np.clip((total - t) / 2.0, 0, 1))[:, None]
    mix = np.tanh(mix * 1.6) / np.tanh(1.6)
    mix *= .89 / np.abs(mix).max()
    WORK.mkdir(parents=True, exist_ok=True)
    with wave.open(str(WORK / 'sound.wav'), 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((mix[: int(total * SR)] * 32767).astype('<i2').tobytes())
    print('sound', round(total, 1), 's')


def enter_board():
    """Every 30th frame of the long take, to choose ENTER."""
    files = sorted((FRAMES / 'enter').glob('*.jpg'))
    picks = files[::30]
    cols = 8
    board = Image.new('RGB', (cols * 360, math.ceil(len(picks) / cols) * 203))
    for i, p in enumerate(picks):
        board.paste(Image.open(p).resize((360, 203), Image.LANCZOS), ((i % cols) * 360, (i // cols) * 203))
        ImageDraw.Draw(board).text(((i % cols) * 360 + 6, (i // cols) * 203 + 4), p.stem, font=font(GOTHIC, 18), fill=(255, 220, 120))
    WORK.mkdir(parents=True, exist_ok=True)
    board.save(WORK / 'enter.jpg', quality=85)
    print('enter board', len(picks))


if __name__ == '__main__':
    WORK.mkdir(parents=True, exist_ok=True)
    if '--enter' in sys.argv:
        enter_board()
    elif '--sheet' in sys.argv:
        render(sheet=True)
    elif '--sound' in sys.argv:
        sound()
    else:
        sound()
        render()
