import os,subprocess,pathlib,shutil,time
out=pathlib.Path('docs/reports/collision-registry/merge-batch6/evidence/e18-core');out.mkdir(parents=True,exist_ok=True)
env=os.environ.copy();env['E2E_PORT']='3495'
cmd=['sh','tools/e2e-lock.sh','npx','playwright','test','tests/perf/e18-counters.spec.ts','tests/perf/e18-memory.spec.ts','tests/perf/e18-download.spec.ts','tests/e2e/e18-quality.spec.ts','tests/e2e/levels/l4-plaza-movement.spec.ts','--grep',r'@E18|@E22 L4 war: mouse WASD stick webgl high zoom 0\.5$','--project=chromium','--workers=1']
started=time.time()
rc=subprocess.run(cmd,env=env).returncode
p=pathlib.Path('test-results/playwright/results.json')
if p.exists():shutil.copy2(p,out/'results.json')
for p in pathlib.Path('test-results/epics/E18').glob('*.json'):
 if p.stat().st_mtime>=started:shutil.copy2(p,out/p.name)
(out/'exit.txt').write_text(str(rc)+'\n')
raise SystemExit(rc)
