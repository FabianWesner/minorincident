from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
names=['lion','lioness','flamingo','zebra','gorilla','monkey','elephant']
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15)
bold=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',17)
W,H=210,210
canvas=Image.new('RGB',(150+6*W,55+len(names)*4*H),(238,235,227))
d=ImageDraw.Draw(canvas)
d.text((12,8),'Animal / view',font=bold,fill=(20,20,20))
for lod in range(3):
 for col,revision in enumerate(('old','new')):
  x=150+(lod*2+col)*W
  d.text((x+12,8),f'LOD{lod} · {revision.upper()}',font=bold,fill=(20,20,20))
missing=[]
for ni,name in enumerate(names):
 for ti,tier in enumerate(('high','low')):
  for zi,zoom in enumerate(('1','1.5')):
   row=ni*4+ti*2+zi; y=55+row*H
   d.text((10,y+30),name,font=bold,fill=(20,20,20)); d.text((10,y+55),f'{tier.upper()}  zoom {zoom}',font=font,fill=(40,40,40))
   for lod in range(3):
    for col,revision in enumerate(('old','new')):
     p=Path('test-results/s224-lod-'+revision)/f'lod{lod}-{tier}-{name}-z{zoom}.png'
     if not p.exists(): missing.append(str(p));continue
     im=Image.open(p).convert('RGB').crop((240,120,560,440)).resize((W,H), Image.Resampling.LANCZOS)
     canvas.paste(im,(150+(lod*2+col)*W,y))
   d.line((0,y+H-1,canvas.width,y+H-1),fill=(190,186,177))
if missing: raise SystemExit('Missing: '+', '.join(missing))
canvas.save('test-results/s224-animal-lod-comparison.jpg',quality=82,optimize=True)
print(canvas.size,Path('test-results/s224-animal-lod-comparison.jpg').stat().st_size)
