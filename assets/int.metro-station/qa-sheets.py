from PIL import Image,ImageDraw
from pathlib import Path
out=Path('test-results/l5-shelter-arrival-and-skins')
copy=Path('/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets');copy.mkdir(parents=True,exist_ok=True)
for folder in out.iterdir():
 if not folder.is_dir() or not (folder/'loading.json').exists():continue
 import json
 data=json.loads((folder/'loading.json').read_text());id=folder.name;blocked=data['blocked'];ref=Image.open(Path('/Users/wesner/Workspace/minorincident/assets')/id/'reference-upscaled.png').convert('RGB')
 title=id+(' | BLOCKED: existing base only, no aftermath skin' if blocked else ' | authored LODs')
 def paste(s,im,box):
  im=im.copy();im.thumbnail((box[2],box[3]));s.paste(im,(box[0]+(box[2]-im.width)//2,box[1]+(box[3]-im.height)//2))
 game=Image.new('RGB',(1500,660),'#2a2730');draw=ImageDraw.Draw(game);draw.text((10,8),title,fill='white')
 for row,px in enumerate([135,190]):
  y=35+row*310;paste(game,ref,(0,y+20,300,280));draw.text((5,y),'Reference',fill='white')
  for col,lod in enumerate(['high','lod1','lod2']):
   paste(game,Image.open(folder/f'model-{lod}-{px}.png').convert('RGB'),((col+1)*300,y+20,300,280));draw.text(((col+1)*300+5,y),f'LOD{col} ~{px}px'+(' BASE AUDIT' if blocked else ''),fill='white')
  paste(game,Image.open(folder/f'peer-high-{px}.png').convert('RGB'),(1200,y+20,300,280));draw.text((1205,y),f'Shipped peer ~{px}px',fill='white')
 game.save(folder/'game-reference-peer.jpg',quality=94);game.save(copy/(id+'.jpg'),quality=94)
 sheet=Image.new('RGB',(1600,1585),'#2a2730');draw=ImageDraw.Draw(sheet);draw.text((10,8),title,fill='white');paste(sheet,ref,(0,50,400,550));draw.text((10,650),'Reference | '+data['loaded'],fill='white')
 for row,ang in enumerate([45,135,225,315,0]):
  for col,lod in enumerate(['high','lod1','lod2']):
   x=400+col*400;y=35+row*310;paste(sheet,Image.open(folder/f'ring-{lod}-{ang}.png').convert('RGB'),(x,y+20,400,280));draw.text((x+8,y),f'LOD{col} | {ang} degrees',fill='white')
 sheet.save(folder/'reference-lod-contact.jpg',quality=93)
 # Keep required contact sheets/loading records, remove intermediary stills.
 for p in folder.glob('model-*.png'):p.unlink()
 for p in folder.glob('peer-*.png'):p.unlink()
 for p in folder.glob('ring-*.png'):p.unlink()
