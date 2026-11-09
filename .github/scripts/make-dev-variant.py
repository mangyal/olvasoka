"""A dev környezet megkülönböztetése a telepített élestől (a deploy workflow futtatja a /dev/ mappán).

- manifest: más név, sötét témaszín; az `id` a /dev/ címre mutat, így külön alkalmazásként települ
- ikonok: a világoskék háttér helyett sötét, hogy a kezdőképernyőn ne lehessen összetéveszteni
- index.html: témaszín és iOS-cím

Használat: python3 make-dev-variant.py <dev mappa>
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1])
BG_OLD = (0xDC, 0xE9, 0xEF)   # az éles ikon háttere
BG_NEW = (0x1E, 0x2A, 0x32)   # dev: sötét
THEME = '#1E2A32'

# manifest
m_path = root / 'manifest.webmanifest'
m = json.loads(m_path.read_text(encoding='utf-8'))
m.update(name='Olvasóka DEV', short_name='Olvasóka DEV', id='./', theme_color=THEME)
m_path.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# index.html
h_path = root / 'index.html'
h = h_path.read_text(encoding='utf-8')
h = re.sub(r'(<meta name="theme-color" content=")[^"]*', r'\g<1>' + THEME, h)
h = h.replace('content="Olvasóka">', 'content="Olvasóka DEV">')
h = h.replace('<title>Olvasóka</title>', '<title>Olvasóka DEV</title>')
h_path.write_text(h, encoding='utf-8')

# SVG ikonok
for svg in (root / 'img/icons').glob('*.svg'):
    svg.write_text(svg.read_text(encoding='utf-8').replace('#DCE9EF', THEME), encoding='utf-8')

# PNG ikonok: a háttérhez közeli képpontok átszínezése, az élek finom átmenetével
def recolor(px):
    r, g, b, *a = px
    d = ((r - BG_OLD[0]) ** 2 + (g - BG_OLD[1]) ** 2 + (b - BG_OLD[2]) ** 2) ** 0.5
    w = max(0.0, 1 - d / 60)          # 1 = pontosan háttér, 0 = 60-nál távolabbi szín
    if w == 0:
        return px
    mix = lambda o, n, c: round(c + (n - o) * w)
    return (mix(BG_OLD[0], BG_NEW[0], r), mix(BG_OLD[1], BG_NEW[1], g), mix(BG_OLD[2], BG_NEW[2], b), *a)

for png in (root / 'img/icons').glob('*.png'):
    im = Image.open(png).convert('RGBA')
    pix = im.load()
    for y in range(im.height):
        for x in range(im.width):
            pix[x, y] = recolor(pix[x, y])
    im.save(png)

print('dev változat kész:', root)
