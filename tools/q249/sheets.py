"""Compose fixed-camera evidence; never alter the figure renders independently."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path('docs/reports/q249/rollout'); folder=root/'lineup'; out=root/'sheets';out.mkdir(exist_ok=True)
rows=[r for r in json.loads((root/'census.json').read_text())['rows'] if not r.get('child') and not r.get('error')]
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
for view in ['studio','game15','game1','low-game15','low-game1']:
    rr=rows if view=='studio' else [r for r in rows if not r.get('rootName') or r['rootName']=='survivor01_root']
    for start in range(0,len(rr),4):
        page=Image.new('RGB',(1000,1680),'#e4e4e4');d=ImageDraw.Draw(page)
        d.text((12,8),f'q249 {view} | BEFORE (left) / AFTER (right) | same metres/camera',font=font,fill='black')
        for i,r in enumerate(rr[start:start+4]):
            key=r['id']+('--'+r['rootName'] if view=='studio' and r.get('rootName') else '')
            y=40+i*410;d.text((10,y),key+' | heroine beside figure',font=font,fill='black')
            for n,phase in enumerate(['before','after']):
                low=view.startswith('low-');stem=f'{phase}{"-low" if low else ""}-{key}-{view.removeprefix("low-")}.jpg';p=folder/stem
                if not p.exists():d.text((n*500+12,y+50),'Capture unavailable: '+phase,font=font,fill='#a00');continue
                im=Image.open(p).convert('RGB');
                if view!='studio' and 'mega-alpha' not in key and 'survivor-group' not in key:im=im.crop((200,150,700,530))
                im.thumbnail((500,380));page.paste(im,(n*500+(500-im.width)//2,y+25))
        page.save(out/f'{view}-{start//4+1:02}.jpg',quality=94)
for start,views in enumerate([['po-bench','production-bench-0'],['production-bench-120','depot-handover']]):
    page=Image.new('RGB',(1600,1280),'#e4e4e4');d=ImageDraw.Draw(page)
    for i,view in enumerate(views):
        y=i*640;d.text((10,y+5),view+' | BEFORE / AFTER',font=font,fill='black')
        for n,phase in enumerate(['before','after']):
            im=Image.open(root/'l1'/f'{phase}-{view}.png').convert('RGB');im.thumbnail((800,600));page.paste(im,(n*800,y+30))
    page.save(out/f'l1-{start+1}.jpg',quality=95)
