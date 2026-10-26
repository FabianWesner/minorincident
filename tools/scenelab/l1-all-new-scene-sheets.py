"""The remaining six report captures: two crowds, three story scenes and states/motion."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

raw = Path('test-results/l1-all-new')
out = Path('docs/reports/l1-all-new')
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 20)

def cell(path, label, width=800):
    im = Image.open(path).convert('RGB')
    im = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
    result = Image.new('RGB', (width, im.height + 38), '#24242c')
    result.paste(im, (0, 38))
    ImageDraw.Draw(result).text((8, 8), label, font=font, fill='white')
    return result

def grid(cells, file, columns=2):
    width = max(im.width for im in cells)
    height = max(im.height for im in cells)
    result = Image.new('RGB', (width * columns, height * ((len(cells) + columns - 1) // columns)), '#24242c')
    for i, im in enumerate(cells):
        result.paste(im, ((i % columns) * width, (i // columns) * height))
    result.save(out / file, quality=92, optimize=True)

for prefix, source, label in [('09-crowd-before', 'crowd-before', 'PROD / 30 L1 figures'), ('10-crowd-after', 'crowd-webgpu', 'New / 30 L1 figures / WebGPU')]:
    grid([cell(raw / source / 'crowd30.png', label, 1600)], prefix + '.jpg', 1)

scenes = raw / 'scenes'
for file, scene, frames in [
    ('11-depot-scene.jpg', 'qa-handover-depot', [0, 60, 160, 330]),
    ('12-lab-scene.jpg', 'qa-handover-annex', [40, 110, 200, 360]),
    ('13-firefighter-scene.jpg', 'fight-firefighter-vs2', [30, 90, 150, 210]),
]:
    grid([cell(scenes / scene / f'shot-{frame:04}.png', f'{scene} / frame {frame}') for frame in frames], file)

models = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly', 'npc.depot-clerk', 'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'npc.firefighter-alive']
cells = [cell(scenes / f'{model}-states' / 'shot-0003.png', f'{model} / live | turned | corpse') for model in models]
for scene, frames in [('corgi-tongue-female', [300, 880, 1540]), ('corgi-tongue-male', [600]), ('corgi-sit', [420]), ('corgi-behaviour', [430, 520]), ('dog-bike-follow', [330])]:
    cells.extend(cell(scenes / scene / f'shot-{frame:04}.png', f'{scene} / frame {frame}') for frame in frames)
grid(cells, '14-states-and-motion.jpg')
