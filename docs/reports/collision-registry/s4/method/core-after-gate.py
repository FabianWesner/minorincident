from pathlib import Path
import time,subprocess,os,socket,json,signal
log=Path('/tmp/collision-s4-final-371-gate.log')
while not log.exists() or 'GATE-END' not in log.read_text():time.sleep(10)
time.sleep(10)
port=3480
while True:
 s=socket.socket()
 try:s.bind(('127.0.0.1',port));s.close();break
 except OSError:s.close();port+=1
 if port>=3500:raise SystemExit('No free owned core E18 port')
env={**os.environ,'E2E_PORT':str(port),'E2E_UNITS':'1'}
print('port',port,flush=True)
with open('/tmp/collision-s4-e18-core.log','w') as f:
 cmd=['sh','tools/e2e-lock.sh','npx','playwright','test','tests/e2e/e18-quality.spec.ts','tests/e2e/e18-mobile.spec.ts','tests/perf/e18-counters.spec.ts','tests/perf/e18-memory.spec.ts','tests/perf/e18-download.spec.ts','--project=chromium','--workers=1','--retries=0']
 p=subprocess.Popen(cmd,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True);start=time.time()
 while p.poll() is None:
  time.sleep(5)
  if time.time()-start>1800 and 'Running ' not in Path(f.name).read_text():
   os.killpg(p.pid,signal.SIGTERM);p.wait();raise SystemExit('Browser admission exceeded30min; core E18 unmeasured')
rc=p.returncode
out=Path('docs/reports/collision-registry/s4/evidence/e18-core');out.mkdir(exist_ok=True)
out.joinpath('results.json').write_bytes(Path('test-results/playwright/results.json').read_bytes());out.joinpath('run.log').write_bytes(Path('/tmp/collision-s4-e18-core.log').read_bytes())
out.joinpath('command.json').write_text(json.dumps({'source':'3714fe54e','command':cmd,'port':port,'exit':rc},indent=2)+'\n')
print('core exit',rc,flush=True)
raise SystemExit(rc)
