"""Create one bounded review sheet per level; retain cell provenance."""
import hashlib,json,re
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path('docs/reports/batch51-qa');raw=Path('test-results/batch51/visual')
media=Path('test-results/batch51/sheets');media.mkdir(parents=True,exist_ok=True)
root.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',11)
manifest=[]
if not any(raw.glob('*/captures/*.jpg')):raise SystemExit('Raw captures removed; collect a fresh run before rebuilding sheets.')
for number in range(1,11):
 level=f'L{number}';main=f'{level}-'+('low' if level in ['L3','L4'] else 'low-retry' if level=='L6' else 'high')
 if level=='L1' and (raw/'L1-low-followup/campaign-completion.json').exists():main='L1-low-followup'
 if level=='L4' and (raw/'L4-low-followup').exists():main='L4-low-followup'
 candidates=[]
 folders=list(raw.glob(f'{level}*'))+list(raw.glob(f'opening-{level}-*'))
 for folder in folders:
  for log in folder.glob('log-*.jsonl'):
   for line in log.read_text().splitlines():
    try:decoded=json.loads(line);p=decoded.get('acceptancePhoto')
    except json.JSONDecodeError:continue
    if p and p['level']==level:
     p={**p,'capturedAt':decoded.get('t',''),'source':str(folder / p['file']),'session':folder.name,'type':'real input'}
     if Path(p['source']).exists():candidates.append(p)
 # Include the special armory photo burst, taken at the same actual pause/pose.
 if level=='L3':
  for q in ['low','high']:
   folder=raw/('L3-low' if q=='low' else 'opening-L3-high')
   for z in [1.5,.5]:
    f=next(iter(folder.glob(f'captures/*armory-{q}-z{str(z).replace(".","-")}.jpg')),None)
    if f:candidates.insert(0,dict(source=str(f),session=folder.name,type='real input',quality=q,zoom=z,step='armory',tick=None))
 selected=[]
 def add(p):
  if p and p['source'] not in [x['source']for x in selected]:selected.append(p)
 for q in ['low','high']:
  for z in [1.5,.5]:
   cells=[p for p in candidates if p['quality']==q and p['zoom']==z and abs(p.get('actualZoom',z)-z)<.01]
   cells.sort(key=lambda p:(p['session']!=main,p.get('tick')or 0))
   add(cells[0]if cells else None)
 fixture={'L2':'vehicle-l2','L7':'bounds-l7','L8':'canopy-l8'}.get(level)
 if fixture:
  for q in ['low','high']:
   for z in [.5,1.5]:
    f=Path(f'test-results/visual-p1-1102/captures/{fixture}-after-webgpu-{q}-z{z}.png')
    if f.exists():add(dict(source=str(f),type='staged fixture',quality=q,zoom=z,actualZoom=z,step=fixture,tick=None))
 extras=[p for p in candidates if p['session']==main]
 if level=='L10':
  order={'hold':0,'mega':1,'release':2,'epilogue':3,'research':4,'residential-fringe':5}
  extras.sort(key=lambda p:str(p.get('capturedAt','')),reverse=True)
  extras.sort(key=lambda p:order.get(p['step'],6))
 # Cover distinct story phases, then include the latest photographed action.
 seen=set()
 for p in extras:
  if p['step'] not in seen and len(selected)<11:
   seen.add(p['step']);add(p)
 if extras and len(selected)<12:add(extras[-1])
 if level in ['L1','L4','L5','L7','L8']:
  peak=max((p for p in candidates if p['session']==main or level=='L1'),key=lambda p:p.get('enemies',0),default=None)
  if peak:
   for z in [1.5,.5]:add(next((p for p in candidates if p['session']==peak['session'] and p.get('tick')==peak.get('tick') and p['zoom']==z),None))
 if level=='L9':
  for folder in ['L9-countryside','L9-dry-shortcut','L9-road-low']:
   c=[p for p in candidates if p['session']==folder]
   if c:add(min(c,key=lambda p:abs(p.get('tick',0)-5682)) if folder=='L9-road-low' else max(c,key=lambda p:(p.get('enemies',0),p.get('tick',0))))
 if level=='L6':
  for z in [1.5,.5]:add(next((p for p in candidates if p['session']==main and p.get('tick')==6862 and p['zoom']==z),None))
 # Specific witnessed street counterexample must remain visible in the L3 sheet.
 if level=='L3':
  p=next((p for p in candidates if p.get('tick')==5257 and p['zoom']==1.5),None)
  if p:
   if len(selected)>=12:selected.pop()
   add(p)
 if not selected:continue
 selected=selected[:12];cols=3;tilew=640;tileh=386;header=38
 sheet=Image.new('RGB',(cols*tilew,header+((len(selected)+cols-1)//cols)*tileh),'#171e29');draw=ImageDraw.Draw(sheet)
 draw.text((12,10),f'{level} / batch 51 / fixed-tier real-input review + labelled fixtures',font=font,fill='white')
 for index,p in enumerate(selected):
  f=Path(p['source']);im=Image.open(f).convert('RGB');im.thumbnail((640,360));x=index%cols*tilew;y=header+index//cols*tileh;sheet.paste(im,(x,y))
  actual=p.get('actualZoom');zoom=f'z{p["zoom"]}'+(f' actual {actual:g}'if actual is not None and abs(actual-p['zoom'])>.01 else '')
  label=f'{index+1:02} {p["type"]} {p["quality"]} {zoom} {p.get("step")} t{p.get("tick")}'
  draw.text((x+5,y+362),label[:94],font=font,fill='white')
  manifest.append({**p,'level':level,'sheet':str(media/f'{level}.jpg'),'cell':index+1,'sourceSha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 sheet.save(media/f'{level}.jpg',quality=77,optimize=True)
(root/'sheets.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('sheets',len({r['level']for r in manifest}),'cells',len(manifest),'bytes',sum(p.stat().st_size for p in media.glob('L*.jpg')))
