"""Compose labelled reference/LOD/peer JPGs without enlarging game-camera models."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess
ROOT=Path(__file__).resolve().parents[2]
common=Path(subprocess.check_output(['git','rev-parse','--git-common-dir'],cwd=ROOT,text=True).strip())
MAIN=(ROOT/common).resolve().parent
OUTPUT=ROOT/'test-results/l5-military-wrecks-and-line'
FONT=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
DEST=Path('/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets')
DEST.mkdir(parents=True,exist_ok=True)
for label in ['veh.tank.wrecked','veh.military-apc.wrecked','veh.military-truck.wrecked','decay.abandoned-checkpoint']:
 d=OUTPUT/label
 reference=MAIN/'assets'/('veh.military-truck' if label=='veh.military-truck.wrecked' else label)/'reference-upscaled.png'
 sheet=Image.new('RGB',(1600,560),(42,39,48));draw=ImageDraw.Draw(sheet)
 draw.text((12,10),label+' | game camera FOV25 / azimuth45 / polar0.30pi',font=FONT,fill='white')
 for row,pixels in enumerate([135,190]):
  top=42+row*255
  for col,quality in enumerate(['reference','high','lod1','lod2','peer']):
   heading=('REFERENCE (intact fallback)' if label=='veh.military-truck.wrecked' else 'REFERENCE') if col==0 else ('integrated peer' if col==4 else 'LOD'+str(col-1))
   draw.text((col*320+10,top),heading+f' / {pixels}px',font=FONT,fill='white')
   if col==0:
    im=Image.open(reference).convert('RGB')
    if label in ['veh.tank.wrecked','veh.military-apc.wrecked']:im=im.crop((1500,170,2048,570))
    elif label=='veh.military-truck.wrecked':im=im.crop((300,0,1320,670))
    im.thumbnail((pixels,pixels));sheet.paste(im,(col*320+(320-im.width)//2,top+26+(218-im.height)//2))
   else:
    role='peer' if col==4 else 'wreck';q='high' if col==4 else quality
    im=Image.open(d/f'{role}-{pixels}-{q}.png').convert('RGB').crop((80,70,400,290))
    sheet.paste(im,(col*320,top+26))
 path=d/'game-reference-peer.jpg';sheet.save(path,quality=93);shutil_path=DEST/(label+'.jpg');shutil_path.write_bytes(path.read_bytes())
 # Contact sheet needs the reference alongside all matching LOD views.
 contact=Image.open(d/'lod-contact.png').convert('RGB');contact.thumbnail((1200,1500))
 ref=Image.open(reference).convert('RGB');ref.thumbnail((360,500))
 full=Image.new('RGB',(1600,1540),(42,39,48));dr=ImageDraw.Draw(full)
 dr.text((10,10),label+' / authored LOD0, LOD1, LOD2 / 45,135,225,315,0 degrees',font=FONT,fill='white')
 full.paste(contact,(400,40));full.paste(ref,((400-ref.width)//2,60));dr.text((10,575),'Reference'+(' (intact fallback)' if label=='veh.military-truck.wrecked' else ''),font=FONT,fill='white')
 full.save(d/'reference-lod-contact.jpg',quality=91)
 (DEST/(label+'-lods.jpg')).write_bytes((d/'reference-lod-contact.jpg').read_bytes())
 Image.open(d/'comparison.png').convert('RGB').save(d/'turntable.jpg',quality=91)
 (DEST/(label+'-turntable.jpg')).write_bytes((d/'turntable.jpg').read_bytes())
 # Required sheets survive; transient capture frames are removed.
 for role in ['wreck','peer']:
  for p in d.glob(role+'-*.png'):p.unlink()
 for p in d.glob('turntable_*.png'):p.unlink()
