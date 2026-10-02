"""Render the looping kitchen clip from the table photo (content/source/tisch-2880.jpg).

A slow camera move visits five dishes with 1 s crossfades; the last shot fades back
into the first so the video loops without a cut.

    python tools/render_video.py content/source/tisch-2880.jpg raw-1080.mp4 1920 1080
    python tools/render_video.py content/source/tisch-2880.jpg raw-hoch.mp4 720 1280
    ffmpeg -i raw-1080.mp4 -vf scale=1600:900 -c:v libx264 -preset veryslow -crf 30 -pix_fmt yuv420p -movflags +faststart -an site/assets/video/kueche-1600.mp4
    ffmpeg -i raw-hoch.mp4 -vf scale=576:1024 -c:v libx264 -preset veryslow -crf 31 -pix_fmt yuv420p -movflags +faststart -an site/assets/video/kueche-hoch.mp4
    ffmpeg -i raw-1080.mp4 -vf "scale=640:360,gblur=sigma=10,eq=brightness=-0.06:saturation=0.9" -c:v libx264 -crf 34 -pix_fmt yuv420p -movflags +faststart -an site/assets/video/kueche-unscharf.mp4

Replace the source with real kitchen footage later by swapping the files in site/assets/video/.
"""
import sys, subprocess, math
from PIL import Image
SRC, OUT, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
img = Image.open(SRC).convert('RGB')
IW, IH = img.size
ASP = W / H
FPS, D, F = 24, 120, 24          # 5 s per shot, 1 s crossfade
# (cx, cy, size_start, size_end, dx, dy): size = window width (landscape) or height (portrait)
if ASP > 1:
    SHOTS = [(1700,1060,1750,1500,  80,  0),
             ( 860,1680,1250,1050,  40,-60),
             (2050, 380,1350,1150,-120, 20),
             ( 960, 330,1350,1180, 100, 10),
             (1760,1950,1300,1100,   0,-50)]
else:
    SHOTS = [(1700,1060,1900,1600,  60,  0),
             ( 860,1650,1500,1250,  30,-60),
             (2120, 520,1500,1300, -80, 30),
             ( 900, 520,1500,1300,  80, 20),
             (1750,1850,1500,1300,   0,-60)]
def ease(t): return 0.5 - 0.5*math.cos(math.pi*t)
def frame(shot, i):
    cx, cy, s0, s1, dx, dy = shot
    t = ease(i / (D - 1))
    s = s0 + (s1 - s0) * t
    w, h = (s, s / ASP) if ASP > 1 else (s * ASP, s)
    x = cx + dx * (t - 0.5) - w / 2
    y = cy + dy * (t - 0.5) - h / 2
    x = min(max(x, 0), IW - w); y = min(max(y, 0), IH - h)
    return img.transform((W, H), Image.Transform.EXTENT, (x, y, x + w, y + h), Image.Resampling.BICUBIC)
seq = SHOTS + [SHOTS[0]]
n = len(SHOTS)
start, end = F, n * (D - F) + F       # seamless loop window
ff = subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
    '-c:v','libx264','-preset','slow','-crf',sys.argv[5] if len(sys.argv)>5 else '27','-pix_fmt','yuv420p','-movflags','+faststart','-an',OUT], stdin=subprocess.PIPE)
for T in range(start, end):
    layers = []
    for k, sh in enumerate(seq):
        i = T - k * (D - F)
        if 0 <= i < D: layers.append((k, i))
    if len(layers) == 1:
        fr = frame(seq[layers[0][0]], layers[0][1])
    else:
        (k0, i0), (k1, i1) = layers[0], layers[1]
        a = ease(i1 / F)
        fr = Image.blend(frame(seq[k0], i0), frame(seq[k1], i1), a)
    ff.stdin.write(fr.tobytes())
    if T == start: fr.save(OUT.replace('.mp4', '-poster.jpg'), quality=80, optimize=True, progressive=True)
ff.stdin.close(); ff.wait()
print(OUT, end - start, 'frames')
