import subprocess,json,time,datetime,hashlib
from pathlib import Path
root=Path('docs/reports/final-c');rows=json.loads((root/'final-commands.json').read_text());assert [r['level']for r in rows]==['L7','L8','L9']
command=['npm','run','qa:accept','--','--level','L10','--tier','both','--skip-browser'];log=root/'L10-final-accept.log';start=datetime.datetime.now(datetime.timezone.utc).isoformat();at=time.monotonic()
with log.open('w')as f:r=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT)
rows.append({'level':'L10','command':' '.join(command),'started':start,'elapsedSeconds':time.monotonic()-at,'exitCode':r.returncode,'log':str(log),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()});(root/'final-commands.json').write_text(json.dumps(rows,indent=2)+'\n');print('L10',r.returncode,round(rows[-1]['elapsedSeconds'],1),flush=True)
