"""Build an exact unscaled driving review; manual seen notes must follow."""
import json,gzip,hashlib,sys
from pathlib import Path
from PIL import Image,ImageDraw
p=Path(sys.argv[1]);r=json.loads(p.read_text());d=Path(r['artifacts']['directory']);dest=Path(sys.argv[2] if len(sys.argv)>2 else 'docs/reports/fix55-c')/d.name;dest.mkdir(parents=True,exist_ok=True)
files=sorted((d/'captures').glob('*.jpg'));cs=[]
sheet=Image.new('RGB',(2560,748*((len(files)+1)//2)),'#172029');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
 x,y=i%2*1280,i//2*748;draw.text((x+8,y+7),f.name,fill='white');pic=Image.open(f);assert pic.size==(1280,720);sheet.paste(pic,(x,y+28));cs.append({'file':f.name,'original':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'cell':i+1,'seen':''})
media=Path('test-results/fix55-c')/d.name;media.mkdir(parents=True,exist_ok=True)
target=media/'sheet.jpg';sheet.save(target,quality=90,subsampling=0)
log=(d/'log-l9-route.jsonl').read_bytes();archive=dest/'log.jsonl.gz';archive.write_bytes(gzip.compress(log,mtime=0))
review={k:r[k] for k in ['sourceHash','browserHash','toolSha256']};review.update({'logArchive':str(archive),'logSha256':hashlib.sha256(log).hexdigest(),'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'sheet':{'file':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},'captures':cs})
out=Path(f"docs/reports/fix51-r10c/L9-{r['tier']}-{r['route']}-reviewed.json") if r['zoom']==1.5 else dest/'review.json';out.write_text(json.dumps(review,indent=2)+'\n');print(out,target)
