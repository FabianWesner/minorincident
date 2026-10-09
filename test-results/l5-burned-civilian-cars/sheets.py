from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageFont
ids=['veh.sedan-red','veh.sedan-blue','veh.sedan-white','veh.suv-dark']
root=Path('test-results/l5-burned-civilian-cars')
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',17)
for id in ids:
 d=root/(id+'.burned')
 ref=Image.open(Path('/Users/wesner/Workspace/minorincident/assets')/(id+'.burned')/'reference-upscaled.png').convert('RGB')
 sheet=Image.new('RGB',(1250,560),(42,39,48));draw=ImageDraw.Draw(sheet)
 paths=[None,'game-high.png','game-lod1.png','game-lod2.png','peer.png']
 labels=['Reference','LOD0','LOD1','LOD2','Integrated base']
 for row,px in enumerate([135,190]):
  draw.text((12,row*280+10),f'{id}.burned · FOV25 / azimuth45 / polar0.30π · {px}px',font=font,fill='white')
  for col,(path,label) in enumerate(zip(paths,labels)):
   im=ref.copy() if path is None else Image.open(d/path).convert('RGB')
   if path is None:
    # Only the hero car at top of the reference, not its smaller turnarounds.
    im=im.crop((0,0,im.width,int(im.height*(.64 if id in ('veh.sedan-blue','veh.sedan-white') else .69))))
   bg=Image.new('RGB',im.size,im.getpixel((0,0)))
   mask=ImageChops.difference(im,bg).convert('L').point(lambda x:255 if x>12 else 0)
   bounds=mask.getbbox()
   if bounds: im=im.crop(bounds)
   scale=px/max(im.size);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
   sheet.paste(im,(col*250+(250-im.width)//2,row*280+64+(190-im.height)//2))
   draw.text((col*250+12,row*280+39),label,font=font,fill='white')
 sheet.save(d/'game-reference-peer.jpg',quality=94)
 # Reference next to matching near/mid/far five-angle view grid.
 lod=Image.open(d/'lod-contact.png').convert('RGB');lod=lod.resize((1120,1400),Image.Resampling.LANCZOS)
 contact=Image.new('RGB',(1600,1400),(42,39,48));contact.paste(lod,(480,0))
 r=ref.copy();r.thumbnail((460,500));contact.paste(r,((480-r.width)//2,60))
 draw=ImageDraw.Draw(contact);draw.text((14,16),id+'.burned reference',font=font,fill='white')
 draw.text((14,600),'Native livery and anchors retained',font=font,fill='white')
 draw.text((14,630),'Missing glazing / exposed seats',font=font,fill='white')
 draw.text((14,660),'Bounded heat tears / bent panels',font=font,fill='white')
 draw.text((14,690),'Collapsed tyres / lights OFF',font=font,fill='white')
 contact.save(d/'reference-lod-contact.jpg',quality=94)
 # Keep the actual contact sheets and loading reports; drop intermediate shots.
 for name in ['peer.png','game-high.png','game-lod1.png','game-lod2.png']:
  (d/name).unlink()
 for p in d.glob('turntable_*.png'):p.unlink()
 dest=Path('/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets');dest.mkdir(parents=True,exist_ok=True)
 for name in ['game-reference-peer.jpg','reference-lod-contact.jpg']:
  import shutil
  shutil.copyfile(d/name,dest/(id+'.burned-'+name))
