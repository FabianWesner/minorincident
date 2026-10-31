"""Compose saved screenshots; all figure scale comes from the captures."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path('docs/reports/slim/pilot')
def sheet(name,rows,columns,cell,crop=None):
 w,h=cell;out=Image.new('RGB',(len(columns)*w,len(rows)*(h+28)),'#ddd');draw=ImageDraw.Draw(out)
 for y,(directory,label) in enumerate(rows):
  for x,(suffix,title) in enumerate(columns):
   path=ROOT/directory/suffix
   if not path.exists():return
   im=Image.open(path).convert('RGB')
   if crop:im=im.crop(crop)
   im=im.resize(cell,Image.Resampling.LANCZOS);out.paste(im,(x*w,y*(h+28)+28));draw.text((x*w+6,y*(h+28)+7),label+' | '+title,fill='#17212c')
 out.save(ROOT/name,quality=94)
for view in ['zoom15','close3m']:
 rows=[(f'game-{phase}-high',f'{figure} {phase}') for figure in ['man-a','woman-a'] for phase in ['before','after']]
 # Each figure has its own filename stem, so compose four separate rows below.
 w,h=600,450;out=Image.new('RGB',(1800,4*(h+28)),'#ddd');draw=ImageDraw.Draw(out);valid=True
 for y,(figure,phase) in enumerate((f,p)for f in ['man-a','woman-a']for p in ['before','after']):
  for x,pose in enumerate(['idle','walk12','walk24']):
   path=ROOT/f'game-{phase}-high'/f'{figure}-{pose}-{view}.jpg'
   if not path.exists():valid=False;continue
   im=Image.open(path).convert('RGB');im=im.crop((300,260,900,710)) if view=='zoom15' else im.resize((w,h),Image.Resampling.LANCZOS)
   out.paste(im,(x*w,y*(h+28)+28));draw.text((x*w+6,y*(h+28)+7),f'{figure} {phase} | {view} | {pose}',fill='black')
 if valid:out.save(ROOT/f'game-sheet-{view}.jpg',quality=94)
for tier in ['high','low']:
 phases=['before','after'] if tier=='high' else ['after'];poses=['run60','sit60','attack35','attack55','death180'];w,h=320,240
 out=Image.new('RGB',(len(poses)*w,len(phases)*2*(h+28)),'#ddd');draw=ImageDraw.Draw(out);valid=True
 for y,(figure,phase) in enumerate((f,p)for f in ['man-a','woman-a']for p in phases):
  for x,pose in enumerate(poses):
   path=ROOT/f'game-{phase}-{tier}'/f'{figure}-{pose}-close3m.jpg'
   if not path.exists():valid=False;continue
   out.paste(Image.open(path).convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x*w,y*(h+28)+28));draw.text((x*w+6,y*(h+28)+7),f'{figure} {phase} {tier} | {pose}',fill='black')
 if valid:out.save(ROOT/f'motion-sheet-{tier}.jpg',quality=94)
# Front / three-quarter / side, before | after. Actual game height classes.
w,h=600,450;out=Image.new('RGB',(3600,2*(h+28)),'#ddd');draw=ImageDraw.Draw(out)
for y,figure in enumerate(['man-a','woman-a']):
 for x,(view,phase) in enumerate((v,p)for v in ['front','three-quarter','side']for p in ['before','after']):
  out.paste(Image.open(ROOT/f'studio-{figure}-{phase}-{view}.png').convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x*w,y*(h+28)+28));draw.text((x*w+6,y*(h+28)+7),f'{figure} {phase} | {view} | heroine at left',fill='black')
out.save(ROOT/'studio-sheet.jpg',quality=94)

# Lower-body views retain literal 3 m framing, including the corpse footprint.
for tier in ['high','low']:
 phases=['before','after'] if tier=='high' else ['after'];poses=['walk12','run60','sit60','death180'];w,h=400,300
 out=Image.new('RGB',(len(poses)*w,len(phases)*2*(h+28)),'#ddd');draw=ImageDraw.Draw(out);valid=True
 for y,(figure,phase) in enumerate((f,p)for f in ['man-a','woman-a']for p in phases):
  for x,pose in enumerate(poses):
   path=ROOT/f'game-{phase}-{tier}'/f'{figure}-{pose}-close3m-lower.jpg'
   if not path.exists():valid=False;continue
   out.paste(Image.open(path).convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x*w,y*(h+28)+28));draw.text((x*w+6,y*(h+28)+7),f'{figure} {phase} {tier} | {pose}',fill='black')
 if valid:out.save(ROOT/f'lower-sheet-{tier}.jpg',quality=94)
