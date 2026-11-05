"""Small labelled before/after JPEG sheets; remove only this job's paired raw captures."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('test-results/luna-fixes-1101')
OUT = Path('test-results/luna-fixes-1101/evidence')
OUT.mkdir(parents=True, exist_ok=True)
FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 11)


def sheet(finding, group, patterns, crop):
    before, after = ROOT / f'{group}-before', ROOT / f'{group}-after'
    names = sorted({f.name for pattern in patterns for f in before.glob(pattern) if (after / f.name).exists()})
    if not names:
        raise RuntimeError(f'No paired captures for {finding}')
    cols, width, height = 2, 640, 250
    result = Image.new('RGB', (cols * width, ((len(names) + cols - 1) // cols) * height), '#182026')
    draw, raw = ImageDraw.Draw(result), []
    for i, name in enumerate(names):
        x, y = i % cols * width, i // cols * height
        draw.text((x + 3, y + 2), name.removesuffix('.jpg'), font=FONT, fill='#ffe9ae')
        draw.text((x + 3, y + 16), 'before', font=FONT, fill='white')
        draw.text((x + 323, y + 16), 'after', font=FONT, fill='white')
        for side, folder in enumerate((before, after)):
            path = folder / name
            image = Image.open(path).convert('RGB')
            if crop:
                image = image.crop(crop(name))
            image.thumbnail((316, 218))
            result.paste(image, (x + side * 320 + (320 - image.width) // 2, y + 31))
            raw.append(path)
    result.save(OUT / f'{finding}.jpg', quality=84, optimize=True)
    (OUT / f'{finding}.json').write_text(json.dumps({'pairs': names, 'baseline': '0e3e33219', 'receipts': [str(before / 'receipts.json'), str(after / 'receipts.json')]}, indent=2) + '\n')
    for path in raw:
        path.unlink()
    print(f'{finding}: {len(names)} pairs, {(OUT / f"{finding}.jpg").stat().st_size} bytes; raw deleted')


if __name__ == '__main__':
    sheet('Q-314-fence-reveal', 'visual', ['*-Q314-0-*.jpg'], lambda name: (400, 90, 900, 650) if 'z0.5' in name else (500, 210, 800, 470))
    sheet('Q-318-horde-silhouette', 'visual', ['*-Q318-*.jpg'], lambda name: (420, 70, 870, 560) if 'z0.5' in name else (460, 180, 820, 500))
    sheet('Q-316-APC-seat', 'visual', ['*-Q316-*.jpg'], None)
    sheet('Q-319-alley-clearance', 'routes', ['*.jpg'], None)
