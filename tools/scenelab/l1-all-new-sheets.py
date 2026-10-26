"""Compose native-pixel game-camera comparisons; no figure resampling."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
raw=Path('test-results/l1-all-new/figures')
out=Path('docs/reports/l1-all-new'); out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',16)
receipts={}
for path in raw.glob('*receipts*.json'):
 for row in json.loads(path.read_text()): receipts[(row['id'],row['variant'],row['targetPixels'],row['yaw'])]=row

def figure(id):
 rows=[]
 for pixels in [120,400]:
  cells=[]
  for yaw in [-45,135]:
   for variant in ['old','new']:
    r=receipts[(id,variant,pixels,yaw)]
    image=Image.open(raw/f'{id}-{variant}-{pixels}-{yaw}.png').convert('RGB')
    x0,y0,x1,y1=r['bounds']; pad=16
    crop=image.crop((int(x0)-pad,int(y0)-pad,int(x1)+pad+1,int(y1)+pad+1))
    cells.append((crop,f'{variant} | {pixels}px | {"front" if yaw==-45 else "back"}'))
  cellw=max(260,max(i.width for i,_ in cells)+12); cellh=max(i.height for i,_ in cells)+32
  row=Image.new('RGB',(cellw*4,cellh),'#24242c');draw=ImageDraw.Draw(row)
  for k,(im,label) in enumerate(cells):
   row.paste(im,(k*cellw+(cellw-im.width)//2,30));draw.text((k*cellw+6,6),label,font=font,fill='white')
  rows.append(row)
 width=max(r.width for r in rows)
 sheet=Image.new('RGB',(width,sum(r.height for r in rows)+32),'#24242c');draw=ImageDraw.Draw(sheet);draw.text((8,7),id,font=font,fill='white')
 y=32
 for r in rows: sheet.paste(r,((width-r.width)//2,y));y+=r.height
 return sheet

def group(ids,file):
 ims=[figure(id) for id in ids];width=max(im.width for im in ims)
 sheet=Image.new('RGB',(width,sum(im.height for im in ims)+8*(len(ims)-1)),'#181820');y=0
 for im in ims:sheet.paste(im,((width-im.width)//2,y));y+=im.height+8
 sheet.save(out/file,quality=90,optimize=True)

peds=['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly','char.courier-female','char.courier-male','inf.common-worker']
group(peds,'01-pedestrians.jpg')
for n,id in enumerate(['npc.depot-clerk','npc.lab-tech-a','npc.lab-tech-b','npc.lab-guard','npc.firefighter-alive'],2):group([id],f'{n:02}-{id}.jpg')
group(['char.corgi'],'07-corgi.jpg')
group(['amb.dog','amb.dog.black','amb.dog.cream','inf.dog','inf.dog.black','inf.dog.cream'],'08-dogs.jpg')
