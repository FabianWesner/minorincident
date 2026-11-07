import subprocess,json,time,datetime,hashlib
from pathlib import Path
root=Path('docs/reports/final-c');rows=[]
for level in ['L7','L8','L9']:
 command=['npm','run','qa:accept','--','--level',level,'--tier','both','--skip-browser'];log=root/(level+'-final-accept.log');start=datetime.datetime.now(datetime.timezone.utc).isoformat();at=time.monotonic()
 with log.open('w')as f:r=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT)
 rows.append({'level':level,'command':' '.join(command),'started':start,'elapsedSeconds':time.monotonic()-at,'exitCode':r.returncode,'log':str(log),'sha256':hashlib.sha256(log.read_bytes()).hexdigest()});(root/'final-commands.json').write_text(json.dumps(rows,indent=2)+'\n');print(level,r.returncode,round(rows[-1]['elapsedSeconds'],1),flush=True)

Path('test-results/final-c/native-first3-done.flag').touch()
