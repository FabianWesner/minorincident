"""r2-corpse contact sheet: before/after side-on Alpha line-up, the all-variant top view and killed civilians.
Usage: r2-sheet.py <out.jpg> (reads test-results/r2/...)."""
import sys
from PIL import Image, ImageDraw
cells = [
    ("BEFORE side-on Alphas (high, WebGL2)", "test-results/r2/base-side0/shot-0080.png"),
    ("AFTER side-on Alphas (high, WebGL2)", "test-results/r2/final-a/corpse-side-0/shot-0080.png"),
    ("AFTER all variants, game cam zoom 0.5 (low, WebGPU)", "test-results/r2/m-low-webgpu/corpse-z05-webgpu-low/shot-0080.png"),
    ("AFTER killed civilians (low, WebGPU)", "test-results/r2/m-low-webgpu/corpse-civilians-webgpu-low/shot-0190.png"),
]
w, h = 640, 360
sheet = Image.new("RGB", (w * 2, (h + 18) * 2), "black")
draw = ImageDraw.Draw(sheet)
for i, (label, path) in enumerate(cells):
    x, y = (i % 2) * w, (i // 2) * (h + 18)
    sheet.paste(Image.open(path).convert("RGB").resize((w, h)), (x, y + 18))
    draw.text((x + 6, y + 3), label, fill="white")
sheet.save(sys.argv[1], quality=82)
