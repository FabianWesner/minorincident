from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import json
root=Path('docs/reports/slim/garments');(root/'sheets').mkdir(exist_ok=True)
build=json.load(open('docs/reports/slim/rollout/build.json'));reverted=set(json.load(open(root/'reverted.json')))
entries=[]
for r in build['receipts']:
 for q in r['files'][0]['figures']:
  name=r['id']+('-'+q['rootName'] if q.get('rootName') else '')
  sheet=Image.new('RGB',(1200,1060),'#ddd');draw=ImageDraw.Draw(sheet);draw.text((12,8),name+' | '+('REVERTED to pre-slim' if r['id'] in reverted else 'body-following field')+' | game zoom 1.5',fill='black')
  for y,tier in enumerate(['high','low']):
   for x,view in enumerate(['front','side','three-quarter']):
    p=root/f'crops-{tier}'/f'{name}-{view}.jpg'
    if not p.exists():raise RuntimeError(str(p))
    im=Image.open(p).convert('RGB');im=im.crop((0,round(im.height*.21),im.width,round(im.height*.86)));im=ImageOps.contain(im,(396,480));px=x*400+(400-im.width)//2;py=52+y*504+(480-im.height)//2;sheet.paste(im,(px,py));draw.text((x*400+10,32+y*504),f'{tier} | {view}',fill='black')
  sheet.save(root/'sheets'/f'{name}.jpg',quality=95);entries.append(name)
for page,start in enumerate(range(0,len(entries),4),1):
 atlas=Image.new('RGB',(2400,2120),'#aaa')
 for i,name in enumerate(entries[start:start+4]):atlas.paste(Image.open(root/'sheets'/f'{name}.jpg'),((i%2)*1200,(i//2)*1060))
 atlas.save(root/f'review-{page:02}.jpg',quality=95)
(root/'sheet-index.json').write_text(json.dumps(entries,indent=2)+'\n')
print(len(entries),'individual sheets;', (len(entries)+3)//4,'review pages')
