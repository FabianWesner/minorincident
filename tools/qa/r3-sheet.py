"""r3-corpse: before/after sheet from two G14 captures. Usage: r3-sheet.py <before.png> <after.png> <out.jpg>
Top row: full frames. Bottom row: crop of the dark-clothed corpse cluster (left-centre) at 2x."""
import sys
from PIL import Image, ImageDraw
before, after, out = (Image.open(sys.argv[1]).convert("RGB"), Image.open(sys.argv[2]).convert("RGB"), sys.argv[3])
box = (20, 290, 400, 530)
w, h = 640, 360
sheet = Image.new("RGB", (w * 2, h * 2), "black")
for i, img in enumerate((before, after)):
    sheet.paste(img.resize((w, h)), (i * w, 0))
    sheet.paste(img.crop(box).resize((w, int(w * (box[3] - box[1]) / (box[2] - box[0])))).crop((0, 0, w, h)), (i * w, h))
d = ImageDraw.Draw(sheet)
for i, label in enumerate(("before (main)", "after (r3-corpse)")):
    d.text((8 + i * w, 6), label, fill="white")
sheet.save(out, quality=78)
