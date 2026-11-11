"""Compose unchanged Scene Lab shots into labelled walk/attack/hit strips.

python3 tools/qa/s34-strips.py test-results/s34-visual
Captures stay in test-results; the centre crop preserves game-camera pixel size.
"""
import pathlib
import sys

from PIL import Image, ImageDraw

windows = {
    'walk': [132, 140, 148, 156, 164, 172, 180, 188],
    'attack': [298, 306, 314, 322, 330, 338, 346, 354],
    'hit': [420, 426, 432, 438, 444, 450, 456, 462],
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
        sheet = Image.new('RGB', (512 * 4, 408 * 2), '#181818')
        draw = ImageDraw.Draw(sheet)
        for index, (frame, path) in enumerate(zip(frames, paths)):
            with Image.open(path) as source:
                left, top = (source.width - 512) // 2, (source.height - 384) // 2
                sheet.paste(source.crop((left, top, left + 512, top + 384)), ((index % 4) * 512, (index // 4) * 408 + 24))
            draw.text(((index % 4) * 512 + 8, (index // 4) * 408 + 5), f'{directory.name} {phase} frame {frame}', fill='white')
        sheet.save(directory / f'strip-{phase}.jpg', quality=92)
