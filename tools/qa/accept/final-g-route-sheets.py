"""Prepare frozen-source physical route evidence; observations are written after viewing."""
from pathlib import Path
import sys,json,hashlib,gzip
from PIL import Image,ImageDraw
run=Path(sys.argv[1]);name=(run.parent.name+'-'+run.name) if run.name.startswith('batch') else run.name
out=Path('test-results/final-g/review')/name;out.mkdir(parents=True,exist_ok=True)
files=sorted((run/'captures').glob('*.jpg'),key=lambda p:p.stat().st_mtime_ns)
rows=[];states=[]
for offset in range(0,len(files),4):
 sheet=Image.new('RGB',(1280,772),'#172029');draw=ImageDraw.Draw(sheet);path=out/f'{offset//4+1:02}.jpg'
 for i,p in enumerate(files[offset:offset+4]):
  x=i%2*640;y=i//2*386;im=Image.open(p).convert('RGB');im.thumbnail((640,360));sheet.paste(im,(x,y+26));draw.text((x+4,y+5),p.stem,fill='white')
  rows.append({'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sheet':str(path),'cell':i+1,'seen':''})
  side=p.with_suffix('.json')
  if side.exists():states.append({'file':str(side),'data':json.loads(side.read_text())})
 sheet.save(path,quality=92)
archive=Path(f'docs/reports/final-g/{name}-physical-source.json.gz')
logs=[json.loads(l)for l in (run/'log-accept.jsonl').read_text().splitlines()]
ledger=run/'accept-acceptance-ledger.json'
archive.write_bytes(gzip.compress(json.dumps({'run':str(run),'captureStates':states,'logs':logs,'ledger':json.loads(ledger.read_text())if ledger.exists()else None},separators=(',',':')).encode(),mtime=0))
manifest={'run':str(run),'source':{'file':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},'captures':rows}
Path(f'docs/reports/final-g/{name}-captures.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(name,len(rows),'captures',len(list(out.glob('*.jpg'))),'sheets')
