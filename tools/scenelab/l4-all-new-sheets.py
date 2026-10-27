"""Compose L4 native 120/400px comparisons and condensed runtime evidence."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path('test-results/l4-all-new');OUT=Path('docs/reports/l4-all-new');OUT.mkdir(parents=True,exist_ok=True)
FONT=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',15)
IDS=['inf.crawler','inf.riot-cop','inf.firefighter','inf.hazmat','inf.alpha','inf.alpha-worker','inf.alpha-hoodie','inf.alpha-fire','inf.alpha-suit']
BG='#23232d'
def figures():
 for number,ident in enumerate(IDS,1):
  rows=[]
  for config in ['high-webgl2','high-webgpu','low-webgl2','low-webgpu']:
   folder=ROOT/'figures'/config
   if not (folder/'receipts.json').exists():continue
   receipts=json.loads((folder/'receipts.json').read_text())
   for pixels in [120,400]:
    cells=[]
    for yaw in [-45,135]:
     for variant in ['old','new']:
      matches=[r for r in receipts if (r['id'],r['variant'],r['targetPixels'],r['yaw'])==(ident,variant,pixels,yaw)]
      if not matches:continue
      r=matches[-1];im=Image.open(r['file']).convert('RGB');a,b,c,d=r['bounds'];pad=12
      cells.append((im.crop((int(a)-pad,int(b)-pad,int(c)+pad+1,int(d)+pad+1)),f'{variant} {pixels}px {"front" if yaw==-45 else "back"}'))
    if len(cells)!=4:continue
    width=max(240,max(i.width for i,_ in cells)+8);height=max(i.height for i,_ in cells)+54
    row=Image.new('RGB',(width*4,height),BG);draw=ImageDraw.Draw(row);draw.text((8,5),config,font=FONT,fill='white')
    for k,(im,label) in enumerate(cells):row.paste(im,(width*k+(width-im.width)//2,52));draw.text((k*width+8,28),label,font=FONT,fill='white')
    rows.append(row)
  if not rows:continue
  width=max(i.width for i in rows);sheet=Image.new('RGB',(width,sum(i.height for i in rows)+40),BG);ImageDraw.Draw(sheet).text((10,10),ident+' | L4 game camera | native pixels',font=FONT,fill='white');y=40
  for row in rows:sheet.paste(row,((width-row.width)//2,y));y+=row.height
  sheet.save(OUT/f'{number:02}-{ident}.jpg',quality=91,optimize=True)
def grid(cells,dest,width=800,cols=2):
 height=round(width*9/16)+30;sheet=Image.new('RGB',(width*cols,height*math.ceil(len(cells)/cols)),BG);draw=ImageDraw.Draw(sheet)
 for i,(file,label) in enumerate(cells):
  im=Image.open(file).convert('RGB');im.thumbnail((width,height-30));x=i%cols*width;y=i//cols*height
  sheet.paste(im,(x+(width-im.width)//2,y+30));draw.text((x+8,y+7),label,font=FONT,fill='white')
 sheet.save(dest,quality=91,optimize=True)
if __name__=='__main__':figures()
