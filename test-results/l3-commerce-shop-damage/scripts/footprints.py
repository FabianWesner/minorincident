import json
from PIL import Image,ImageDraw,ImageChops
from pathlib import Path
sets=json.loads(Path('.cache/assets/commerce-footprints.json').read_text());out=[]
for base in ['bld.mainstreet-brick','bld.joes-diner','bld.maple-hardware']:
 rows=[a for a in sets if a['id'].startswith(base)]
 points=[p for a in rows for t in a['polygons'] for p in t];lo=[min(p[k] for p in points) for k in (0,1)];hi=[max(p[k] for p in points) for k in (0,1)]
 def mask(a):
  im=Image.new('1',(512,512));d=ImageDraw.Draw(im)
  for tri in a['polygons']:d.polygon([((p[0]-lo[0])/(hi[0]-lo[0])*500+6,(p[1]-lo[1])/(hi[1]-lo[1])*500+6) for p in tri],fill=1)
  return im
 baseline=mask(next(a for a in rows if a['id']==base and a['tier']==0))
 for a in rows:
  if a['id']==base:continue
  other=mask(a);inter=ImageChops.logical_and(baseline,other);union=ImageChops.logical_or(baseline,other)
  n=sum(inter.getdata());den=sum(union.getdata());out.append(dict(id=a['id'],tier=a['tier'],iou=n/den))
  rgb=Image.new('RGB',(512,512),'#292631');rgb.paste('#df7d49',mask=baseline);rgb.paste('#70bbaa',mask=other);rgb.paste('#dbc99e',mask=inter)
  directory=Path('test-results/l3-commerce-shop-damage')/a['id'];directory.mkdir(exist_ok=True);rgb.save(directory/('footprint-lod'+str(a['tier'])+'.png'))
print(json.dumps(out,indent=2));Path('test-results/l3-commerce-shop-damage/footprints.json').write_text(json.dumps(out,indent=2)+'\n')
