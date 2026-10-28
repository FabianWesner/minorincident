"""Compose L5 native 120/400px comparisons and condensed runtime evidence."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path('test-results/l5-all-new');OUT=Path('docs/reports/l5-all-new');OUT.mkdir(parents=True,exist_ok=True)
FONT=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',15)
IDS=json.loads((OUT/'census.json').read_text())['scope']
BG='#23232d'
def figures():
 for number,ident in enumerate(IDS,1):
  rows=[]
  for config in ['high-webgl2','high-webgpu','low-webgl2','low-webgpu','low-webgl2-tone5','high-webgpu-tone5']:
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
  viewer=Path('/Users/wesner/Workspace/3dp-l5-all-new/cast/l5')/ident/'pipeline-view.png'
  if viewer.exists():
   im=Image.open(viewer).convert('RGB');im=im.crop((300,0,1150,1000));im.thumbnail((400,400))
   footer=Image.new('RGB',(960,440),BG);footer.paste(im,(20,35));draw=ImageDraw.Draw(footer);draw.text((8,8),'Pipeline viewer | published skinned body',font=FONT,fill='white')
   draw.text((435,80),'Reviewed: face / exposed limbs',font=FONT,fill='white');draw.text((435,115),'Front + back: hair / headwear',font=FONT,fill='white');draw.text((435,150),'Authored outfit + carried props',font=FONT,fill='white')
   if ident=='npc.mr-okafor.aftermath':
    cane=ROOT/'crowd-new-high-webgpu'/'okafor-cane.png'
    if cane.exists():
     prop=Image.open(cane).convert('RGB').crop((550,110,1080,850));prop.thumbnail((330,360));draw.rectangle((425,30,959,439),fill=BG);footer.paste(prop,(430,65));draw.text((435,40),'Live cane / pavement contact',font=FONT,fill='white')
   rows.append(footer)
  if not rows:continue
  width=max(i.width for i in rows);sheet=Image.new('RGB',(width,sum(i.height for i in rows)+40),BG);ImageDraw.Draw(sheet).text((10,10),ident+' | L5 game camera | native pixels',font=FONT,fill='white');y=40
  for row in rows:sheet.paste(row,((width-row.width)//2,y));y+=row.height
  sheet.save(OUT/f'{number:02}-{ident}.jpg',quality=91,optimize=True)
def grid(cells,dest,width=800,cols=2):
 height=round(width*9/16)+30;sheet=Image.new('RGB',(width*cols,height*math.ceil(len(cells)/cols)),BG);draw=ImageDraw.Draw(sheet)
 for i,(file,label) in enumerate(cells):
  im=Image.open(file).convert('RGB');im.thumbnail((width,height-30));x=i%cols*width;y=i//cols*height
  sheet.paste(im,(x+(width-im.width)//2,y+30));draw.text((x+8,y+7),label,font=FONT,fill='white')
 sheet.save(dest,quality=91,optimize=True)

def corpse_close():
 grid([(ROOT/f'states-{variant}-high-webgpu'/f'corpse-{i}.png',f'{ident} | {variant} frozen pose') for i,ident in enumerate(IDS) for variant in ['old','new']],OUT/'14-corpses-old-new.jpg')

def runtime():
 configs=['high-webgl2','high-webgpu','low-webgl2','low-webgpu']
 grid([(ROOT/f'crowd-{variant}-{config}'/'zoom-1.5.png',f'{config} | {variant} | 30 L5 street figures') for config in configs for variant in ['old','new']],OUT/'09-crowd-old-new.jpg')
 def story(name,config='high-webgpu'):
  folder=ROOT/f'story-new-{config}'/name;return sorted(folder.glob('shot-*.png'))[-1]
 grid([(story('qa-l5-hide-'+who),who+' | high WebGPU | scripted reveal') for who in ['dale','rosa','okafor','mia','sam']],OUT/'10-story-five-survivors.jpg')
 grid([(story('qa-l5-'+name,config),name+' | '+config) for name in ['group','emergence','sparse-infected','metro-arrival'] for config in ['high-webgpu','low-webgl2']],OUT/'11-story-group-metro.jpg')
 grid([(ROOT/f'states-new-{config}'/f'group-{group}-{state}.png',f'{config} | group {group} | {state}') for config in ['high-webgpu','low-webgl2'] for group in [0,1] for state in ['live','turned','corpse']]+[(ROOT/'crowd-new-high-webgpu'/'okafor-cane.png','Authored cane | fixed grip / pavement contact'),(ROOT/'crowd-new-high-webgpu'/'courier-shotgun.png','Actual held shotgun | unified gun asset path')],OUT/'12-states-and-held-props.jpg')
 grid([(story('qa-l5-pair-'+name+'-l5',config),name+' | '+config) for name in ['kessler-lane','harbor-street','plaza','metro-entrance'] for config in ['high-webgpu','low-webgl2']],OUT/'13-story-locations.jpg')

if __name__=='__main__':
 import sys
 figures()
 if '--runtime' in sys.argv:
  runtime()
  corpse_close()
