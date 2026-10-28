"""Compose reviewed L10 evidence without changing native figure pixel scale."""
import json, math, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path('test-results/l10-all-new'); OUT=Path('docs/reports/l10-all-new'); OUT.mkdir(parents=True,exist_ok=True)
IDS=['inf.mega-alpha','inf.mega-alpha-ashen','inf.mega-alpha-ember']
FONT=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14);BG='#23232d'
def grid(cells,dest,width=800,cols=2,crop=None):
 h=round(width*((crop[3]-crop[1])/(crop[2]-crop[0]) if crop else 9/16))+30;im=Image.new('RGB',(width*cols,h*math.ceil(len(cells)/cols)),BG);d=ImageDraw.Draw(im)
 for i,(file,label) in enumerate(cells):
  pic=Image.open(file).convert('RGB');pic=pic.crop(crop) if crop else pic;pic.thumbnail((width,h-30));x=i%cols*width;y=i//cols*h
  im.paste(pic,(x+(width-pic.width)//2,y+30));d.text((x+6,y+6),label,font=FONT,fill='white')
 im.save(dest,quality=92,optimize=True)
def figures():
 for n,ident in enumerate(IDS,1):
  rows=[]
  for config in ['high-webgl2','high-webgpu','low-webgl2','low-webgpu']:
   for pixels in [120,400]:
    cells=[]
    for yaw in [-45,135]:
     for v in ['old','new']:
      receipts=json.loads((ROOT/f'portraits-{v}-{config}/receipts.json').read_text())
      r=next(r for r in receipts if (r['id'],r['targetPixels'],r['yaw'])==(ident,pixels,yaw))
      pic=Image.open(r['file']).convert('RGB');a,b,c,d=r['bounds'];p=10
      cells.append((pic.crop((int(a)-p,int(b)-p,int(c)+p+1,int(d)+p+1)),f'{v} {pixels}px {"front" if yaw==-45 else "back"}'))
    w=max(220,max(p.width for p,_ in cells)+10);h=max(p.height for p,_ in cells)+52
    row=Image.new('RGB',(w*4,h),BG);dr=ImageDraw.Draw(row);dr.text((8,4),config,font=FONT,fill='white')
    for k,(pic,label) in enumerate(cells):row.paste(pic,(w*k+(w-pic.width)//2,50));dr.text((w*k+6,26),label,font=FONT,fill='white')
    rows.append(row)
  w=max(r.width for r in rows);im=Image.new('RGB',(w,sum(r.height for r in rows)+36),BG);ImageDraw.Draw(im).text((8,8),f'{ident} | L10 light, 25 degree game lens | native pixels',font=FONT,fill='white');y=36
  for row in rows:im.paste(row,((w-row.width)//2,y));y+=row.height
  im.save(OUT/f'{n:02}-{ident}.jpg',quality=92,optimize=True)
def runtime():
 configs=['high-webgl2','high-webgpu','low-webgl2','low-webgpu']
 grid([(ROOT/f'crowd-{v}-{c}/zoom-{zoom}.png',f'{v} | {c} | zoom {zoom} | 30 figures')for c in configs for zoom in [1,1.5] for v in ['old','new']],OUT/'04-crowd-old-new.jpg',width=800,cols=2)
 grid([(ROOT/f'states-new-{c}/{ident}-roar-{frame}.png',f'{ident} {c} | roar {frame}')for c in ['high-webgl2','low-webgpu'] for ident in IDS for frame in [30,120]],OUT/'05-motion.jpg',width=500,cols=3,crop=(300,100,1300,850))
 grid([(ROOT/f'states-{v}-{c}/{ident}-corpse.png',f'{ident} {v} {c} | frozen')for c in ['high-webgl2','low-webgpu'] for ident in IDS for v in ['old','new']],OUT/'06-corpses-old-new.jpg',width=500,cols=3,crop=(300,100,1300,850))
 cells=[(ROOT/f'level-new-{tier}-webgpu/assault.png',f'Actual L10 finale | {tier} WebGPU')for tier in ['low','high']if(ROOT/f'level-new-{tier}-webgpu/assault.png').exists()]
 for folder in sorted((ROOT/'story-new-high-webgl2').iterdir()):
  if not folder.is_dir():continue
  shots=sorted(folder.glob('shot-*.png'))
  for shot in [shots[0],shots[len(shots)//2],shots[-1]]:cells.append((shot,f'{folder.name} | {shot.stem}'))
 if cells:grid(cells,OUT/'07-story-finale.jpg',width=640,cols=3)
 sources=[(Path('/Users/wesner/Workspace/trellis-highs/mega-alpha/solidified/sheet.jpg'),'Base Mega | reconstructed source')]
 for ident in IDS[1:]:
  file=Path('/Users/wesner/Workspace/3dp-l10-all-new/cast/wave2')/ident/'sheet.png'
  if file.exists():sources.append((file,f'{ident} | pipeline source'))
 grid(sources,OUT/'08-pipeline-source.jpg',width=920,cols=1)
def showcase():
 folder=Path('/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/showcase/img');folder.mkdir(parents=True,exist_ok=True)
 dest=folder/'l8-crowd-old-new.jpg';grid([(ROOT/f'crowd-{v}-high-webgpu/zoom-1.5.png',f'L10 | {v.upper()} | 30 figures | high WebGPU')for v in ['old','new']],dest,width=1400,cols=1)
 im=Image.open(dest);im.thumbnail((1600,1600),Image.Resampling.LANCZOS);im.save(dest,quality=93,optimize=True)
 (OUT/'showcase.json').write_text(json.dumps({'file':str(dest),'size':list(im.size),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bestCaptures':['04-crowd-old-new.jpg','01-inf.mega-alpha.jpg','02-inf.mega-alpha-ashen.jpg','03-inf.mega-alpha-ember.jpg']},indent=2)+'\n')
if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['figures','runtime','showcase']);a=p.parse_args();globals()[a.mode]()
