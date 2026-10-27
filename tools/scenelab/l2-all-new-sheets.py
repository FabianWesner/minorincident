"""Native 120/400px figures in low/high L2 lighting; no resizing of figure pixels."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path('test-results/l2-all-new');out=Path('docs/reports/l2-all-new');out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',15)
for n,ident in enumerate(['npc.civilian-kid','npc.police-officer'],1):
 rows=[]
 for tier in ['low','high']:
  raw=root/f'figures-{tier}';receipts=json.loads((raw/f'{ident}-receipts.json').read_text())
  for pixels in [120,400]:
   cells=[]
   for yaw in [-45,135]:
    for variant in ['old','new']:
     r=next(r for r in receipts if r['variant']==variant and r['targetPixels']==pixels and r['yaw']==yaw)
     x0,y0,x1,y1=r['bounds'];im=Image.open(r['file']).convert('RGB').crop((math.floor(x0)-12,math.floor(y0)-12,math.ceil(x1)+12,math.ceil(y1)+12))
     cells.append((im,f'{tier} | {variant} | {pixels}px | {"front" if yaw==-45 else "back"}'))
   cw=max(285,max(im.width for im,_ in cells)+12);ch=max(im.height for im,_ in cells)+33
   row=Image.new('RGB',(cw*4,ch),'#24242c');d=ImageDraw.Draw(row)
   for k,(im,label) in enumerate(cells):row.paste(im,(k*cw+(cw-im.width)//2,30));d.text((k*cw+5,5),label,font=font,fill='white')
   rows.append(row)
 width=max(im.width for im in rows);sheet=Image.new('RGB',(width,sum(im.height for im in rows)+35),'#181820');d=ImageDraw.Draw(sheet);d.text((9,8),ident+' | game camera, L2 midday',font=font,fill='white');y=35
 for im in rows:sheet.paste(im,((width-im.width)//2,y));y+=im.height
 sheet.save(out/f'{n:02}-{ident}.jpg',quality=92,optimize=True)
