from pathlib import Path
import subprocess,time,json,sys,hashlib
out=Path('/tmp/collision-s4-final-371-gate-evidence');out.mkdir(exist_ok=True)
paths=[Path('test-results/playwright/results.json'),Path('test-results/scene-catalog/index.json')]
seen={str(p):p.stat().st_mtime_ns if p.exists() else 0 for p in paths}
with open('/tmp/collision-s4-final-371-gate.log','w') as log:
 p=subprocess.Popen(['sh','/Users/wesner/Workspace/minorincident/epics-pipeline/gate-browser.sh',str(Path.cwd())],stdout=log,stderr=subprocess.STDOUT)
 n=0
 while True:
  for path in paths:
   if not path.exists() or path.stat().st_mtime_ns==seen[str(path)]:continue
   try:d=json.loads(path.read_text())
   except (json.JSONDecodeError,OSError):continue
   n+=1;target=out/f'{n}-{path.parent.name}.json';target.write_text(json.dumps(d,separators=(',',':')));seen[str(path)]=path.stat().st_mtime_ns
  if p.poll() is not None:break
  time.sleep(2)
print('gate exit',p.returncode,flush=True)
sys.exit(p.returncode)
