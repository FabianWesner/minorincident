"""Labelled screenshot contact sheets; no pixel changes beyond uniform resizing."""
import argparse
import gzip
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser();p.add_argument('receipts',nargs='+');p.add_argument('--out',required=True);p.add_argument('--width',type=int,default=320);p.add_argument('--page',type=int,default=24);p.add_argument('--select');a=p.parse_args()
captures=[]
for path in a.receipts:
    data=json.loads(gzip.open(path,'rt').read() if path.endswith('.gz') else Path(path).read_text())
    for c in data['captures']:
        c={**c,'tier':data['tier'],'backend':data['backend'],'receipt':path}
        if a.select and not any(s in c['label'] for s in a.select.split(',')):continue
        captures.append(c)
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',10)
manifest=[]
for offset in range(0,len(captures),a.page):
    page=captures[offset:offset+a.page];w=a.width;h=round(w*9/16)+40;cols=4
    sheet=Image.new('RGB',(cols*w,((len(page)+cols-1)//cols)*h),'#10151e');draw=ImageDraw.Draw(sheet)
    for i,c in enumerate(page):
        x=i%cols*w;y=i//cols*h;im=Image.open(c['file']).convert('RGB');im.thumbnail((w,h-40));sheet.paste(im,(x,y+40))
        s=c['state'];position=s.get('position')or{};label=f"{offset+i:03} {c['tier']}/{c['backend']} z{c['requestedZoom']} t{s['tick']}"
        draw.text((x+4,y+2),label,font=font,fill='#ffe9ac');draw.text((x+4,y+15),c['label'][:47],font=font,fill='white')
        draw.text((x+4,y+27),f"({position.get('x',0):.1f},{position.get('z',0):.1f})",font=font,fill='#c6d3e3')
        manifest.append({**c,'sheet':f'review-{offset//a.page:02}.jpg','cell':i,'reviewIndex':offset+i})
    sheet.save(out/f'review-{offset//a.page:02}.jpg',quality=82,optimize=True)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(f'{len(captures)} captures, {(len(captures)+a.page-1)//a.page} pages in {out}')
