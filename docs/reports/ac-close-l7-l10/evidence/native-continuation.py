#!/usr/bin/env python3
"""Complete skipped native batches after a strict verifier exits; never erase failures."""
import gzip,json,os,pathlib,subprocess,sys,time
ROOT=pathlib.Path.cwd(); OUT=ROOT/'docs/reports/ac-close-l7-l10/evidence'
SERIAL='/tmp/ac-close-l7-l10-browser.serial'
def save(path,value):
    with gzip.open(path,'wt') as f: json.dump(value,f,indent=2)
if sys.argv[1]=='--batch':
    target,name,encoded=sys.argv[2:]; command=json.loads(encoded)
    # Preserve the preceding verifier's reporter until it has copied its own
    # receipt after releasing the serial lock. A stale reporter is never proof.
    reporter=ROOT/'test-results/playwright/results.json'
    env=dict(os.environ,MI_ACCEPTANCE_SERIAL_HELD='1',E2E_PORT='4091',SCENE_PORT='4092',E2E_UNITS='1',E2E_ADMISSION_TIMEOUT_SECONDS='3600',PERF_CONDITIONS_LOG=str(OUT/'late-native-conditions.jsonl'))
    start=time.time()
    with open(OUT/f'native-{target}-{name}.log','w') as log:
        result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env=env)
    fresh=reporter.is_file() and reporter.stat().st_mtime >= start
    receipt={'target':target,'batch':name,'command':command,'started':start,'finished':time.time(),'exitCode':result.returncode,'reporterPresent':fresh}
    if fresh:
        save(OUT/f'native-{target}-{name}-playwright.json.gz',json.loads(reporter.read_text()))
    save(OUT/f'native-{target}-{name}-receipt.json.gz',receipt)
    print(json.dumps(receipt),flush=True)
    sys.exit(0) # audit all batches; each original exit remains in its receipt

resume=sys.argv[1]=='--resume'
target,pid=(sys.argv[2],None) if resume else (sys.argv[1],int(sys.argv[2]))
while pid is not None:
    try:os.kill(pid,0)
    except ProcessLookupError:break
    time.sleep(5)
checkfile=ROOT/f'test-results/epics/{target}/checks.json'
checks=json.loads(checkfile.read_text()) if checkfile.is_file() else json.loads(gzip.open(OUT/f'native-{target}-verifier-checks.json.gz','rt').read())
save(OUT/f'native-{target}-verifier-checks.json.gz',checks)
# Preserve the functional receipt before continuation workers reuse the global reporter.
functional=ROOT/f'test-results/epics/{target}/playwright-functional.json'
if functional.is_file():save(OUT/f'native-{target}-functional.json.gz',json.loads(functional.read_text()))
pattern=f'^(?=.*(?:@(?:{target})(?:-AC\\d+)?(?=\\s|$)|@smoke(?=\\s|$)))(?=.*@perf)'
# Same files as tools/verify.ts; keep every original gate and any missing shard.
files=sorted(p for p in (ROOT/'tests/perf').glob('*.spec.ts') if f'@{target}' in p.read_text())
attempted=[c['command'] for c in checks['checks']]
# Resume without repeating completed native continuation files. Interrupted,
# timed-out or admission-only batches are never treated as completed proof.
for path in OUT.glob(f'native-{target}-*-receipt.json.gz'):
    receipt=json.loads(gzip.open(path,'rt').read())
    if receipt.get('exitCode') in [0,1] and receipt.get('reporterPresent'):
        attempted.append(receipt['command'])
for spec in files:
    path=str(spec.relative_to(ROOT))
    full=any(path in c and not any(a.startswith('--shard=') for a in c) for c in attempted)
    remaining=[] if full else [shard for shard in [1,2] if not any(path in c and f'--shard={shard}/2' in c for c in attempted)]
    # An untouched file fits one watchdog-bounded reservation; retain the
    # original missing shard when the verifier already attempted half a file.
    groups=[None] if remaining==[1,2] else remaining
    for shard in groups:
        command=['sh','tools/perf/quiet-run.sh','npx','playwright','test',path,'--grep',pattern]+([] if shard is None else [f'--shard={shard}/2'])+['--project=chromium','--workers=1']
        name=f'{spec.stem.removesuffix(".spec")}-'+('all' if shard is None else f's{shard}of2')
        subprocess.run(['/usr/bin/lockf','-k',SERIAL,sys.executable,__file__,'--batch',target,name,json.dumps(command)],check=True)
print(f'{target} native continuation terminal',flush=True)
