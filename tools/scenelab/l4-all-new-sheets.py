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

def runtime():
 configs=['high-webgl2','high-webgpu','low-webgl2','low-webgpu']
 sheets={
  '10-crowd-old-new.jpg':[(ROOT/f'crowd-{v}-{c}/zoom-1.5.png',f'{v} {c} | 30 submitted figures') for c in configs for v in ['old','new']],
  '11-corpses-old-new.jpg':[(ROOT/f'corpses-{v}-high-webgl2/group-{i}.png',f'{v} corpse group {i} | high WebGL2') for i in range(3) for v in ['old','new']]+[(ROOT/f'corpses-{v}-low-webgpu/courier-cut.png',f'{v} | courier see-through, low WebGPU') for v in ['old','new']],
  '12-story-plaza-war.jpg':[(ROOT/f'story-new-high-webgl2/{n}/shot-{f:04}.png',n) for n,f in [('qa-l4-plaza-safe',239),('qa-l4-gate-convoy',119),('qa-l4-war-line',120),('qa-l4-fuel-chain',150)]],
  '13-story-tank-cellar.jpg':[(ROOT/f'story-new-high-webgl2/{n}/shot-{f:04}.png',n) for n,f in [('qa-l4-tank-heli',170),('qa-l4-kessler-cellar',20),('qa-l4-kessler-cellar',150),('l4-finale-cellar',0)]],
  '14-breach-old-new.jpg':[(ROOT/f'battle-{v}-high-webgl2/{t}s.png',f'{v} | {t}s after turn | zoom 1') for t in [30,60,120,180] for v in ['old','new']],
 }
 for name,cells in sheets.items():grid(cells,OUT/name)
 # Keep the shared held-gun review alongside L4's story beats, within fourteen report files.
 weapon_sources=[]
 story=Image.open(OUT/'12-story-plaza-war.jpg').convert('RGB');strip_height=340
 combined=Image.new('RGB',(1600,story.height+strip_height*2),BG);combined.paste(story,(0,0));draw=ImageDraw.Draw(combined)
 for row,config in enumerate(['high-webgl2','low-webgpu']):
  for col,(prop,yaw) in enumerate([('hmg',45),('rifle',225),('hunting-rifle',45),('pistol',225),('shotgun',225)]):
   file=ROOT/f'guns-new-{config}/{prop}-{yaw}.png';weapon_sources.append(str(file))
   im=Image.open(file).convert('RGB').crop((540,200,1060,700));im.thumbnail((320,307))
   x=col*320;y=story.height+row*strip_height;combined.paste(im,(x,y+30));draw.text((x+4,y+7),f'{prop} | {config}',font=FONT,fill='white')
 combined.save(OUT/'12-story-plaza-war.jpg',quality=91,optimize=True)
 import hashlib
 index=[]
 for p in sorted(OUT.glob('*.jpg')):
  im=Image.open(p);index.append({'file':p.name,'size':list(im.size),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sources':[str(source) for source,_ in sheets.get(p.name,[])]+(weapon_sources if p.name=='12-story-plaza-war.jpg' else [])})
 assert len(index)==14
 (OUT/'capture-index.json').write_text(json.dumps(index,indent=2)+'\n')

def showcase():
 import hashlib,subprocess
 folder=Path('/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/showcase/img')
 folder.mkdir(parents=True,exist_ok=True);sources=[];width=1430;height=820
 sheet=Image.new('RGB',(width,(height+32)*2),BG);draw=ImageDraw.Draw(sheet)
 for i,variant in enumerate(['old','new']):
  p=ROOT/f'crowd-{variant}-high-webgpu/zoom-1.5.png';sources.append(str(p));im=Image.open(p).convert('RGB').crop((100,70,1530,890))
  sheet.paste(im,(0,i*(height+32)+32));draw.text((14,i*(height+32)+8),f'L4 | {"OLD" if variant=="old" else "V2 COMBAT FIGURES"} | 30 figures | high WebGPU',font=FONT,fill='white')
 sheet.thumbnail((1600,1600),Image.Resampling.LANCZOS);dest=folder/'l4-crowd-old-new.jpg';sheet.save(dest,quality=93,optimize=True)
 (OUT/'showcase.json').write_text(json.dumps({'file':str(dest),'size':list(sheet.size),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'sources':sources,'revision':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'bestCaptures':['10-crowd-old-new.jpg','14-breach-old-new.jpg','02-inf.riot-cop.jpg','05-inf.alpha.jpg']},indent=2)+'\n')

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--runtime',action='store_true');parser.add_argument('--showcase',action='store_true');parser.add_argument('--figures',action='store_true');args=parser.parse_args()
 if args.figures or not(args.runtime or args.showcase):figures()
 if args.runtime:runtime()
 if args.showcase:showcase()
