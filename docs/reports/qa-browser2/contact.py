"""Build one compact evidence sheet per level from explicit receipt selections."""
import argparse,gzip,hashlib,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('level');p.add_argument('--plan',default='docs/reports/qa-browser2/contact-plan.json');a=p.parse_args()
root=Path('docs/reports/qa-browser2');plan=json.loads(Path(a.plan).read_text())[a.level];cells=[]
for group in plan:
    path=root/group['receipt'];r=json.loads(gzip.open(path,'rt').read() if path.suffix=='.gz' else path.read_text())
    for label in group['labels']:
        matches=[c for c in r['captures'] if c['label']==label and c['requestedZoom'] in group.get('zooms',[1,1.5])]
        if not matches:raise RuntimeError(f'Missing {path.name}: {label}')
        for c in matches:cells.append({**c,'receipt':path.name,'revision':r.get('revision'),'tier':r['tier'],'backend':r['backend'],'alias':group.get('alias',{}).get(label,label)})
w=320;h=220;cols=4;sheet=Image.new('RGB',(w*cols,h*math.ceil(len(cells)/cols)),'#10151e');d=ImageDraw.Draw(sheet);font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',10)
for i,c in enumerate(cells):
    x=i%cols*w;y=i//cols*h;im=Image.open(c['file']).convert('RGB');im.thumbnail((w,180));sheet.paste(im,(x,y+40));s=c['state'];p=s.get('position')or{}
    for j,(text,color) in enumerate([(f"{i+1:02} {c['tier']}/{c['backend']} z{c['requestedZoom']}",'#ffe9ac'),(c['alias'][:45],'white'),(f"t{s.get('tick',0)} ({p.get('x',0):.1f},{p.get('z',0):.1f})",'#c6d3e3')]):d.text((x+4,y+2+j*12),text,font=font,fill=color)
    c['cell']=i+1;c['rawOriginal']=c.pop('file');c['rawDeleted']=False
out=root/f'{a.level}-contact.jpg'
for quality in range(82,30,-4):
    sheet.save(out,quality=quality,optimize=True)
    if out.stat().st_size<=380*1024:break
manifest={'level':a.level,'cells':cells,'sheet':out.name,'sheetSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'method':'Uniformly resized full screenshots with labels; no other pixel edits. Requested zoom and actual camera metadata are separate for scripted/inspection views.','reviewed':False}
(root/f'{a.level}-contact.json').write_text(json.dumps(manifest,indent=2));print(f'{a.level}: {len(cells)} cells, {out.stat().st_size} bytes')
