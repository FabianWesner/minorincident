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
 phases=['before','after'] if tier=='high' else ['after'];poses=['run60','sit60','swing-mid','attack35','attack55','death180'];w,h=320,240
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

# Full-cast and L1 comparisons use the captured metre scales without reframing.
ROLL=Path('docs/reports/slim/rollout')
for view in ['front','side']:
 if not (ROLL/'lineup-after-high'/'group-12-front.jpg').exists():continue
 w,h=1200,488;out=Image.new('RGB',(w*2,12*(h+24)),'#ddd');draw=ImageDraw.Draw(out)
 for i in range(1,13):
  for x,phase in enumerate(['before','after']):
   im=Image.open(ROLL/f'lineup-{phase}-high'/f'group-{i}-{view}.jpg').convert('RGB').resize((w,h),Image.Resampling.LANCZOS);out.paste(im,(x*w,(i-1)*(h+24)+24));draw.text((x*w+8,(i-1)*(h+24)+6),f'{phase} | group {i} | {view}',fill='black')
 out.save(ROLL/f'lineup-{view}-before-after.jpg',quality=93)
for tier in ['high','low']:
 w,h=800,325;out=Image.new('RGB',(w*3,4*(h+24)),'#ddd');draw=ImageDraw.Draw(out);valid=True
 for i in range(1,13):
  p=ROLL/f'lineup-after-{tier}'/f'group-{i}-front.jpg'
  if not p.exists():valid=False;continue
  x=(i-1)%3;y=(i-1)//3;out.paste(Image.open(p).convert('RGB').resize((w,h),Image.Resampling.LANCZOS),(x*w,y*(h+24)+24));draw.text((x*w+8,y*(h+24)+6),f'final {tier} | group {i}',fill='black')
 if valid:out.save(ROLL/f'overview-{tier}.jpg',quality=94)
for name in ['depot-handover','po-bench','production-bench-0','production-bench-120']:
 paths=[ROLL/'l1'/f'{p}-{name}.png' for p in ['before','after']]
 if not all(p.exists() for p in paths):continue
 imgs=[Image.open(p).convert('RGB')for p in paths];w,h=imgs[0].size;out=Image.new('RGB',(w*2,h+28),'#ddd');draw=ImageDraw.Draw(out)
 for i,(phase,im)in enumerate(zip(['before','after'],imgs)):out.paste(im,(i*w,28));draw.text((i*w+8,8),f'{phase} | L1 {name}',fill='black')
 out.save(ROLL/'l1'/f'{name}-before-after.jpg',quality=94)
