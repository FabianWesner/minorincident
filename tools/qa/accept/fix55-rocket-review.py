"""Tile all physical rocket captures without scaling; manual review follows."""
import json,sys,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(sys.argv[1]);r=json.loads(p.read_text());out=Path('docs/reports/fix55-c')/Path(r['out']).name;out.mkdir(parents=True,exist_ok=True)
media=Path('test-results/fix55-c')/Path(r['out']).name;media.mkdir(parents=True,exist_ok=True)
(out/'input.json').write_bytes(p.read_bytes());files=[{**c,'tier':row['tier'],'kind':row['kind']} for row in r['rows'] for c in row['captures']];captures=[];sheets=[]
for offset in range(0,len(files),4):
 group=files[offset:offset+4];im=Image.new('RGB',(2560,748*((len(group)+1)//2)),'#172029');draw=ImageDraw.Draw(im);target=media/f'sheet-{offset//4+1:02}.jpg'
 for i,c in enumerate(group):
  x,y=i%2*1280,i//2*748;f=Path(c['file']);assert hashlib.sha256(f.read_bytes()).hexdigest()==c['sha256'];pic=Image.open(f);assert pic.size==(1280,720);draw.text((x+8,y+7),f.name,fill='white');im.paste(pic,(x,y+28));captures.append({**c,'sheet':str(target),'cell':i+1,'seen':''})
 im.save(target,quality=90,subsampling=0);sheets.append({'file':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
review={k:r[k] for k in ['sourceHash','browserHash','toolSha256']};review.update({'input':str(out/'input.json'),'inputSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'captures':captures,'sheets':sheets});target=Path(sys.argv[2]);target.write_text(json.dumps(review,indent=2)+'\n');print(target,len(files),len(sheets))
