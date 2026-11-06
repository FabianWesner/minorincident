"""Prepare eight-frame body crops at original pixel scale; explicit review follows."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, sys
receipt=Path(sys.argv[1]);data=json.loads(receipt.read_text());dest=Path('test-results/sweep-g/review')/receipt.stem;dest.mkdir(parents=True,exist_ok=True);rows=[]
for cell in data['cells']:
    sheet=Image.new('RGB',(1280,696),'#172029');draw=ImageDraw.Draw(sheet);name=cell['entry']['model']+'-'+cell['mode'];target=dest/(name+'.jpg')
    for i,c in enumerate(cell['captures']):
        p=Path(c['file']);assert hashlib.sha256(p.read_bytes()).hexdigest()==c['sha256'];im=Image.open(p);assert im.size==(800,600);x=i%4*320;y=i//4*348;sheet.paste(im.crop((240,140,560,460)),(x,y+28));draw.text((x+4,y+5),name+':'+str(c['frame']),fill='white');rows.append({**c,'sheet':str(target),'cell':i+1,'reviewed':False,'crop':[240,140,560,460],'originalPixels':[800,600]})
    sheet.save(target,quality=94,subsampling=0)
for r in rows:r['sheetSha256']=hashlib.sha256(Path(r['sheet']).read_bytes()).hexdigest()
Path('docs/reports/sweep-g/'+receipt.stem+'-captures.json').write_text(json.dumps(rows,indent=2)+'\n');print(len(rows),'frames',len(data['cells']),'strips',dest)
