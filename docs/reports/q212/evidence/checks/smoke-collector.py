import os,pathlib,json,time,subprocess,shutil
out=pathlib.Path('test-results/q212'); report=pathlib.Path('test-results/playwright/results.json')
seen=report.stat().st_mtime_ns if report.exists() else None
captured={}
def capture():
 global seen
 if not report.exists() or report.stat().st_mtime_ns==seen:return
 seen=report.stat().st_mtime_ns
 try: data=json.loads(report.read_text())
 except json.JSONDecodeError:return
 count=data.get('stats',{}).get('expected',0);name=f'smoke-{count}-tests.json'
 shutil.copy2(report,out/name)
 # test-budget's Playwright --list preflight emits a zero-execution reporter snapshot.
 if count:captured[count]=data.get('stats',{})
env={**os.environ,'E2E_PORT':'4330','MI_BUILD_CACHE':'off'}
with (out/'smoke.log').open('w') as log:
 proc=subprocess.Popen(['npm','run','test:smoke'],env=env,stdout=log,stderr=subprocess.STDOUT)
 while proc.poll() is None:
  capture();time.sleep(.5)
 capture()
 code=proc.returncode
print(json.dumps({'exitCode':code,'reports':captured}))
(out/'smoke-run.json').write_text(json.dumps({'command':'E2E_PORT=4330 MI_BUILD_CACHE=off npm run test:smoke','exitCode':code,'reports':captured},indent=2)+'\n')
if code==0:
 assert set(captured)=={6,1},captured
 assert all(s.get('unexpected')==0 and s.get('skipped')==0 and s.get('flaky')==0 for s in captured.values()),captured
raise SystemExit(code)
