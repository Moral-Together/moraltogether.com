#!/usr/bin/env python3
"""Convert the site's raster images to WebP at the size they are actually displayed.

Local tool, like tools/compress-media.mjs — it needs Pillow on the machine and is not part of
any build. The site itself stays dependency-free.

    python3 tools/convert-images.py --dry     measure without writing
    python3 tools/convert-images.py           write the WebP files

The hero backgrounds also keep a JPEG twin: they are set from CSS, where image-set() can offer
a fallback for nothing, and a hero that fails to load is the most visible failure on the site.
Everything else is referenced from <img>, where WebP has been safe since Safari 14.

Originals are not deleted here — that happens in the same commit, by hand, once the references
have been rewritten and the pages checked.
"""

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is required: pip3 install Pillow')

# file -> (max width, quality, also write a JPEG twin)
PLAN = {
    'images/Background_Light_desctop.png': (1920, 80, True),
    'images/Background_Black_desctop.png': (1920, 80, True),
    'images/Background_Light_tablet.png': (1400, 78, True),
    'images/Background_Black_tablet.png': (1400, 78, True),
    'images/Background_Light_mobile.png': (900, 78, True),
    'images/Background_Black_mobile.png': (900, 78, True),
}

# Cards, logos and section art: shown at a few hundred pixels at most.
CARDS = [
    'images/p1-logo.png', 'images/p2-logo.png', 'images/p3-logo.png', 'images/p4-logo.png',
    'images/p4-logo.jpg', 'images/p5-logo.png', 'images/p5-logo2.png', 'images/p6-logo2.png',
    'images/p8-logo.png', 'images/p9-logo.png', 'images/p10-logo.png', 'images/p11-logo.png',
    'images/p12-logo.png', 'images/p14-logo.png', 'images/p16-logo.png',
    'images/moral-tv-logo.png', 'images/moral-for-good-logo.png', 'images/radio-m1-logo.png',
    'images/art.png', 'images/urban.png', 'images/nature.png', 'images/connect.png',
]
for card in CARDS:
    PLAN[card] = (800, 80, False)

# The wordmark carries fine lettering and transparency; a little more room and quality.
for logo in ('MoralTogetherLogoWhite.png', 'MoralTogetherLogoBlack.png',
             'images/MoralTogetherLogoWhite.png', 'images/MoralTogetherLogoBlack.png'):
    PLAN[logo] = (900, 86, False)

parser = argparse.ArgumentParser()
parser.add_argument('--dry', action='store_true')
args = parser.parse_args()

before = after = 0
rows = []

for path, (cap, quality, want_jpeg) in sorted(PLAN.items()):
    if not os.path.exists(path):
        rows.append((path, 'нет файла', 0, 0))
        continue

    im = Image.open(path)
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and 'transparency' in im.info or im.mode in ('RGBA', 'LA')
    im = im.convert('RGBA' if has_alpha else 'RGB')
    size_note = f'{im.width}×{im.height}'
    if im.width > cap:
        im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
        size_note += f' → {im.width}×{im.height}'

    webp = os.path.splitext(path)[0] + '.webp'
    was = os.path.getsize(path)
    if args.dry:
        import io
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=quality, method=6)
        now = buf.tell()
    else:
        im.save(webp, 'WEBP', quality=quality, method=6)
        now = os.path.getsize(webp)
        if want_jpeg:
            twin = os.path.splitext(path)[0] + '.jpg'
            im.convert('RGB').save(twin, 'JPEG', quality=quality - 4, optimize=True, progressive=True)

    before += was
    after += now
    rows.append((path, size_note, was, now))

width = max(len(r[0]) for r in rows)
for path, note, was, now in rows:
    if not was:
        print(f'{path:{width}}  {note}')
        continue
    print(f'{path:{width}}  {note:22}  {was / 1048576:6.2f} → {now / 1048576:5.2f} МБ  −{round(100 - 100 * now / was):2}%')

print('—' * (width + 46))
print(f'{"итого":{width}}  {"":22}  {before / 1048576:6.2f} → {after / 1048576:5.2f} МБ  '
      f'−{round(100 - 100 * after / before)}%')
if args.dry:
    print('\n--dry: ничего не записано')
