"""Compose actual render captures without changing figure geometry or proportions."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('docs/reports/q249/pilot-2')
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BG, INK = '#ecedf0', '#17212c'

def text(image, xy, words, size=26):
    ImageDraw.Draw(image).text(xy, words, font=ImageFont.truetype(FONT, size), fill=INK)

studio = Image.new('RGB', (1780, 2710), BG)
text(studio, (24, 14), 'q249 | PILOT 2 | BLUE-SHIRT MAN', 40)
text(studio, (24, 66), 'Heroine at left in every panel. Same game metres, camera and pixel scale throughout.', 26)
for row, view in enumerate(['front', 'three-quarter', 'side']):
    y = 120 + row * 850
    for col, phase in enumerate(['before', 'after']):
        x = col * 890
        text(studio, (x + 20, y + 8), f'{phase.upper()} | {view}', 30)
        image = Image.open(ROOT / f'studio-{phase}-{view}.png').convert('RGB')
        studio.paste(image.crop((160, 75, 1050, 875)), (x, y + 50))
text(studio, (24, 2675), 'After: body scale 1.000 | head XYZ 0.78793 | hands 0.75 | shoulder width unchanged: 0.57149 m', 24)
studio.save(ROOT / 'studio-sheet.png')

game = Image.new('RGB', (1800, 2100), BG)
text(game, (24, 14), 'q249 | PILOT 2 | SCENE LAB | HIGH', 40)
text(game, (24, 65), 'Columns: idle / walk +12 ticks / walk +24 ticks. Before and after use identical camera poses.', 27)
for row, (view, phase) in enumerate([(v, p) for v in ['zoom15', 'close3m'] for p in ['before', 'after']]):
    y = 115 + row * 485
    label = 'Game zoom 1.5 | native pixel crop' if view == 'zoom15' else '3 m close | 50% of full capture'
    text(game, (20, y + 6), f'{phase.upper()} | {label}', 28)
    for col, pose in enumerate(['idle', 'walk12', 'walk24']):
        image = Image.open(ROOT / f'game-{phase}-{view}-{pose}.png').convert('RGB')
        image = image.crop((300, 260, 900, 710)) if view == 'zoom15' else image.resize((600, 450), Image.Resampling.LANCZOS)
        game.paste(image, (col * 600, y + 35))
text(game, (24, 2070), 'Bare authored hair is explicit in both fixtures. Full 1200 x 900 PNG captures and motion receipts are beside this sheet.', 24)
game.save(ROOT / 'game-sheet.png')
