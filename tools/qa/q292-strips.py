"""Frame-strip contact sheet for tools/qa/q292-locomotion.ts / q292-l7-live.ts captures (live rows give per-frame centres).
python3 tools/qa/q292-strips.py <captureDir> <out.jpg> <tag-tier-zZoom> [...]   (one row of 8 frames per prefix)
"""
import json, os, sys
from PIL import Image, ImageDraw
src, out, prefixes = sys.argv[1], sys.argv[2], sys.argv[3:]
W, H = 200, 240
rows = []
centres = {}
for f in os.listdir(src):
    if f.startswith('rows-') and f.endswith('.json'):
        tier = f[5:-5]
        for r in json.load(open(f'{src}/{f}')):
            if 'trace' in r and r['trace'] and 'cx' in r['trace'][0]: centres[f"l7-{r['kind']}-{tier}-z{r['zoom']:g}"] = [(t['cx'], t['cy']) for t in r['trace']]
for p in prefixes:
    zoom = float(p.rsplit('-z', 1)[1])
    cw, ch = int(170 * zoom), int(205 * zoom)
    row = Image.new('RGB', (8 * (W + 2), H + 18), 'white')
    ImageDraw.Draw(row).text((4, 3), f'{p}  (0.25 s per frame)', fill='black')
    for k in range(8):
        im = Image.open(f'{src}/{p}-{k}.jpg')
        if p in centres:  # live: projected feet in device pixels (DPR 2), figure above them
            cx, cy = centres[p][k]; cw2, ch2 = int(cw * 1.1), int(ch * 1.1)
            c = im.crop((cx - cw2 // 2, cy - int(ch2 * .8), cx + cw2 // 2, cy + int(ch2 * .2)))
        else:
            cx, cy = 400, 290
            c = im.crop((cx - cw // 2, cy - ch // 2 - 20, cx + cw // 2, cy + ch // 2 - 20))
        c = c.resize((W, H), Image.LANCZOS)
        row.paste(c, (k * (W + 2), 18))
    rows.append(row)
sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), 'white')
y = 0
for r in rows: sheet.paste(r, (0, y)); y += r.height
sheet.save(out, quality=84)
