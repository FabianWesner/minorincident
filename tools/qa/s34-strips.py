"""Compose unchanged Scene Lab shots into labelled walk/attack/hit strips.

python3 tools/qa/s34-strips.py test-results/s34-visual
Captures stay in test-results; the centre crop preserves game-camera pixel size.
"""
import pathlib
import sys

from PIL import Image, ImageDraw

windows = {
    'walk': [30, 60, 90, 120],
    'attack': [298, 314, 330, 346],
    'hit': [420, 432, 438, 450],
    'melee': [510, 516, 522, 528, 534, 540, 546, 552],
    'sustained': [800, 806, 812, 818, 824, 830, 836, 842],
}
for directory in sorted(pathlib.Path(sys.argv[1]).iterdir()):
    if not directory.is_dir():
        continue
    for phase, frames in windows.items():
        paths = [directory / f'shot-{frame:04d}.png' for frame in frames]
        if not all(path.exists() for path in paths):
            continue
        sheet = Image.new('RGB', (256 * 4, 280 * ((len(frames) + 3) // 4)), '#181818')
        draw = ImageDraw.Draw(sheet)
        for index, (frame, path) in enumerate(zip(frames, paths)):
            with Image.open(path) as source:
                left, top = (source.width - 256) // 2, (source.height - 256) // 2
                sheet.paste(source.crop((left, top, left + 256, top + 256)), ((index % 4) * 256, (index // 4) * 280 + 24))
            draw.text(((index % 4) * 256 + 8, (index // 4) * 280 + 5), f'{directory.name} {phase} frame {frame}', fill='white')
        sheet.save(directory / f'strip-{phase}.jpg', quality=92)

    strips = [directory / f'strip-{phase}.jpg' for phase in windows if (directory / f'strip-{phase}.jpg').exists()]
    if strips:
        loaded = [Image.open(path) for path in strips]
        review = Image.new('RGB', (1024, sum(strip.height for strip in loaded)), '#181818')
        y = 0
        for strip in loaded:
            review.paste(strip, (0, y)); y += strip.height; strip.close()
        review.save(directory / 'review.jpg', quality=95)
