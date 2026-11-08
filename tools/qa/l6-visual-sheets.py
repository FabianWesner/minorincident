"""Build auditable L6 review sheets; pixel measurements always use the original PNGs."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,math
import numpy as np
root=Path('test-results/l6-visual');out=root/'sheets';out.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
try:font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
except OSError:font=ImageFont.load_default()
index=[]
def sheet(name,entries,cols=2,width=640,height=360,crop=False):
    canvas=Image.new('RGB',(cols*width,math.ceil(len(entries)/cols)*(height+22)), '#111820')
    records=[]
    for i,(file,label,box) in enumerate(entries):
        image=Image.open(file).convert('RGB')
        if box:image=image.crop(box)
        if crop:
            image.thumbnail((width,height));tile=Image.new('RGB',(width,height),'#111820');tile.paste(image,((width-image.width)//2,0));image=tile
        else:image=image.resize((width,height))
        x=(i%cols)*width;y=(i//cols)*(height+22);canvas.paste(image,(x,y+22));ImageDraw.Draw(canvas).text((x+4,y+3),label,font=font,fill='#ffe4a0')
        records.append({'file':str(file),'sha256':sha(file),'label':label,'crop':box})
    file=out/f'{name}.jpg';canvas.save(file,quality=94)
    index.append({'file':str(file),'sha256':sha(file),'sources':records})
for backend in ['webgl2','webgpu']:
 for tier in ['low','high']:
  for zoom in [1,1.5]:
    key=f'{backend}-{tier}-z{zoom}';p=root/'verified'/f'{backend}-z{zoom}'/'captures';e=root/'clean-exit-final'/f'{backend}-z{zoom}'
    entries=[(p/f'{tier}-{role}.jpg',role,None) for role in ['shelter-seats','shelter-care','lamp-uncollected','lamp-approach','lamp-opposed']]
    entries += [(e/f'{tier}-{role}.png',role,None) for role in ['open','night-2','night-7']]
    sheet('overview-'+key,entries)
    gates=json.loads((root/'gates'/'receipt.json').read_text())['rows'];entries=[]
    for g in gates:
      if g['backend']!=backend or g['tier']!=tier:continue
      for phase in ['open','closed']:
       c=next(c for c in g[phase] if c['state']['camera']['zoom']==zoom)
       assert sha(c['file'])==c['sha256'];entries.append((Path(c['file']),f"gate{g['x']} {phase} {g['input']}",None))
    assert len(entries)==6;sheet('gates-'+key,entries)
    entries=[]
    for spot in ['shelter','tunnel']:
      p=root/'readability-final'/f'{backend}-{tier}-z{zoom}-{spot}'/'captures'
      entries.append((p/'native.png',spot+' native',None))
    sheet('readability-'+key,entries)
# Body/eye differential masks at native actor scale, including the warm-floor edge diagnostic.
for backend in ['webgl2','webgpu']:
 for tier in ['low','high']:
  entries=[]
  for zoom in [1,1.5]:
   for spot in ['shelter','tunnel']:
    p=root/'readability-final'/f'{backend}-{tier}-z{zoom}-{spot}'/'captures'
    black=np.asarray(Image.open(p/'actor-black.png').convert('RGB')).astype(int);body=np.asarray(Image.open(p/'actor-body.png').convert('RGB')).astype(int)
    yy,xx=np.where((body.sum(2)-black.sum(2))>10);box=(int(xx.min())-8,int(yy.min())-8,int(xx.max())+9,int(yy.max())+9)
    for role in ['native','actor-body','actor-eyes']:entries.append((p/f'{role}.png',f'z{zoom} {spot} {role}',box))
  sheet(f'masks-{backend}-{tier}',entries,cols=3,width=280,height=240,crop=True)
bar_path=root/'bars-final'/'receipt.json';bar=json.loads(bar_path.read_text());pixels=[]
if len(bar['rows'])==232:
 for backend in ['webgl2','webgpu']:
  for tier in ['low','high']:
   for zoom in [1,1.5]:
    entries=[];rows=[r for r in bar['rows']if r['backend']==backend and r['tier']==tier and r['zoom']==zoom];assert len(rows)==29
    for r in rows:
      id=r['ids'][0];b=next(b for b in r['state']['bars']['bars'] if b['id']==id);assert sha(r['file'])==r['sha256']
      rgb=np.asarray(Image.open(r['file']).convert('RGB')).astype(int);x=round(b['x']);y=round(b['y']);patch=rgb[max(0,y-3):y+4,max(0,x-11):x+12]
      count=int(((patch[:,:,1]>patch[:,:,0]+25)&(patch[:,:,1]>patch[:,:,2]-10)&(patch[:,:,1]>130)&(patch[:,:,2]>90)).sum())
      pixels.append({'backend':backend,'tier':tier,'zoom':zoom,'id':id,'file':r['file'],'sha256':r['sha256'],'bar':b,'cyanPixels':count})
      assert count>=8,f'{backend}/{tier}/z{zoom}/id{id}: actual pip pixels missing ({count})'
      entries.append((Path(r['file']),f'id{id} pip pixels={count}',(x-100,max(0,y-12),x+100,min(720,y+218))))
    sheet(f'bars-{backend}-{tier}-z{zoom}',entries,cols=6,width=200,height=230,crop=True)
else:print('Bar pass incomplete:',len(bar['rows']))
(out/'index.json').write_text(json.dumps({'sheets':index},indent=2)+'\n')
(root/'bar-pixels.json').write_text(json.dumps({'sourceHash':bar['sourceHash'],'producerSha256':sha(__file__),'rows':pixels},indent=2)+'\n')
print('Sheets',len(index),'bar pixel cases',len(pixels),'minimum',min((r['cyanPixels'] for r in pixels),default=None))
