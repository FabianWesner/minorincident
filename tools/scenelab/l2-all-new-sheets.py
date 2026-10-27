"""Native 120/400px figures in low/high L2 lighting; no resizing of figure pixels."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path('test-results/l2-all-new');out=Path('docs/reports/l2-all-new');out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',15)
for n,ident in enumerate(['npc.civilian-kid','npc.police-officer'],1):
 rows=[]
 for backend in ['webgl2','webgpu']:
  for tier in ['low','high']:
   raw=root/(f'figures-{tier}' if backend=='webgl2' else f'figures-webgpu-{tier}');receipts=json.loads((raw/f'{ident}-receipts.json').read_text())
   for pixels in [120,400]:
    cells=[]
    for yaw in [-45,135]:
     for variant in ['old','new']:
      r=next(r for r in receipts if r['variant']==variant and r['targetPixels']==pixels and r['yaw']==yaw)
      x0,y0,x1,y1=r['bounds'];im=Image.open(r['file']).convert('RGB').crop((math.floor(x0)-12,math.floor(y0)-12,math.ceil(x1)+12,math.ceil(y1)+12))
      cells.append((im,f'{"GL2" if backend=="webgl2" else "GPU"} {tier} | {variant} {pixels}px {"front" if yaw==-45 else "back"}'))
    cw=max(330,max(im.width for im,_ in cells)+12);ch=max(im.height for im,_ in cells)+33
    row=Image.new('RGB',(cw*4,ch),'#24242c');d=ImageDraw.Draw(row)
    for k,(im,label) in enumerate(cells):row.paste(im,(k*cw+(cw-im.width)//2,30));d.text((k*cw+5,5),label,font=font,fill='white')
    rows.append(row)
 width=max(im.width for im in rows);sheet=Image.new('RGB',(width,sum(im.height for im in rows)+35),'#181820');d=ImageDraw.Draw(sheet);d.text((9,8),ident+' | L2 game camera | new skin: production tint, tone 0',font=font,fill='white');y=35
 for im in rows:sheet.paste(im,((width-im.width)//2,y));y+=im.height
 sheet.save(out/f'{n:02}-{ident}.jpg',quality=92,optimize=True)

if (root/'crowd-new-low/shot-0003.png').exists():
 panels=[]
 for variant,label in [('old','BEFORE | main 0cc2f1d95'),('new','AFTER | all L2 figures on v2 skins')]:
  im=Image.open(root/f'crowd-{variant}-low/shot-0003.png').convert('RGB').crop((180,170,1540,840))
  panel=Image.new('RGB',(im.width,im.height+29),'#181820');panel.paste(im,(0,29));ImageDraw.Draw(panel).text((8,6),label+' | 30 figures, L2 low, WebGL2',font=font,fill='white');panels.append(panel)
 sheet=Image.new('RGB',(panels[0].width,sum(p.height for p in panels)+8),'#181820');y=0
 for panel in panels:sheet.paste(panel,(0,y));y+=panel.height+8
 sheet.save(out/'03-l2-crowd-old-new.jpg',quality=92,optimize=True)

names=['fix-p1-l2-start-courier-crew','qa-l2-truck-drive-full','collision-l2-release','l2-finale-streets','l2-finale-bridge','l2-market-doors']
for number,name in enumerate(names,4):
 paths=[root/f'story-new-{tier}'/name/'sheet.jpg' for tier in ['low','high']]
 if not all(p.exists() for p in paths):continue
 images=[Image.open(p).convert('RGB') for p in paths];width=max(i.width for i in images);sheet=Image.new('RGB',(width,sum(i.height for i in images)+64),'#181820');d=ImageDraw.Draw(sheet);y=0
 for tier,im in zip(['low','high'],images):d.text((8,y+6),f'{name} | {tier} | L2 game camera',font=font,fill='white');sheet.paste(im,((width-im.width)//2,y+30));y+=im.height+32
 sheet.save(out/f'{number:02}-{name}.jpg',quality=92,optimize=True)

states=['npc.civilian-kid-healthy','npc.police-officer-healthy','npc.police-officer-turned','npc.police-officer-corpse']
paths=[root/'states-new-low'/name/'sheet.jpg' for name in states]
if all(p.exists() for p in paths):
 images=[Image.open(p).convert('RGB') for p in paths];width=max(i.width for i in images);sheet=Image.new('RGB',(width,sum(i.height for i in images)+32*len(images)),'#181820');d=ImageDraw.Draw(sheet);y=0
 for name,im in zip(states,images):d.text((8,y+6),name+' | L2 low, production clips',font=font,fill='white');sheet.paste(im,(0,y+30));y+=im.height+32
 sheet.save(out/'10-states-and-motion.jpg',quality=92,optimize=True)
