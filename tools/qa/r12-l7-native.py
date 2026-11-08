"""Serial native checks on the existing CPU runner; retain compact linked evidence only."""
import gzip, hashlib, json, os, subprocess, time
from pathlib import Path
out = Path('docs/reports/r12-l7'); out.mkdir(parents=True, exist_ok=True)
scratch = Path('test-results/r12-l7/native'); scratch.mkdir(parents=True, exist_ok=True)
payload = json.loads(gzip.decompress((out/'baseline-source.json.gz').read_bytes()))
original = {p: Path(p).read_bytes() for p in payload['files']}
os.environ['QA_THREAT_REVISION'] = payload['baseline']
for p, expected in payload['finalFiles'].items():
    assert hashlib.sha256(Path(p).read_bytes()).hexdigest() == expected, p
commands = []
def run(name, args):
    started = time.monotonic()
    with (scratch/(name+'.log')).open('w') as log:
        result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT)
    tail = (scratch/(name+'.log')).read_text()[-2500:]
    commands.append(dict(name=name, command=args, exitCode=result.returncode, seconds=round(time.monotonic()-started,2), tail=tail))
    (out/'commands.json').write_text(json.dumps(commands, indent=2)+'\n')
    print(name, result.returncode, commands[-1]['seconds'], flush=True)
def threat(path):
    r=json.loads((path/'audit.json').read_text())
    return dict(flags=r['flags'], levels=[dict(level=x['level'], flags=x['flags'], passiveFlags=x['passiveFlags'], nativeStateHash=x.get('nativeStateHash'), run=x['run'], passiveRun=x['passiveRun'], phases=[{k:p[k] for k in ['key','seconds','attacks','attacksPerMinute','groupAttacks','groupAttacksPerMinute','flags']} for p in (x.get('observation') or {}).get('phases',[])]) for x in r['levels']])
try:
    for p, entry in payload['files'].items(): Path(p).write_text(entry['before'])
    run('measure-before',['node','--import','tsx/esm','tools/qa/r12-l7-measure.ts','before'])
    run('mega-before',['node','--import','tsx/esm','tools/qa/r12-l7-mega.ts','before'])
    run('threat-before-L1-L5',['npm','run','qa:threat','--','--levels','L1,L2,L3,L4,L5','--maxWorkers','1','--out',str(scratch/'threat-before')])
finally:
    for p, b in original.items(): Path(p).write_bytes(b)
os.environ['QA_THREAT_REVISION'] = payload['finalRevision']
run('measure-after',['node','--import','tsx/esm','tools/qa/r12-l7-measure.ts','after'])
run('mega-after',['node','--import','tsx/esm','tools/qa/r12-l7-mega.ts','after'])
run('typecheck',['npm','run','typecheck'])
run('lint',['npm','run','lint'])
run('unit',['node','tools/qa/test-budget.mjs','--name','r12-l7-final-unit','--max-seconds','150','--','npm','test','--','--maxWorkers=1'])
accept={}
for level in ['L7','L10']:
    run('accept-'+level,['npm','run','qa:accept','--','--level',level,'--tier','both','--skip-browser'])
    report=json.loads(Path(f'docs/reports/fix51-verify/{level}.json').read_text())
    natives=[]
    for tier in ['low','high']:
        r=json.loads(Path(f'docs/reports/fix51-verify/receipts/{level}-{tier}-complete.json').read_text())
        natives.append({k:r[k] for k in ['level','tier','sourceHash','observerHash','run']})
        natives[-1]['charge']=r.get('observation',{}).get('charge')
        natives[-1]['final']=r.get('observation',{}).get('final')
    accept[level]=dict(report=report,natives=natives)
    (out/'acceptance.json.gz').write_bytes(gzip.compress(json.dumps(accept,separators=(',',':')).encode(),mtime=0))
run('threat-full',['npm','run','qa:threat','--','--maxWorkers','1','--out',str(scratch/'threat-after')])
before=threat(scratch/'threat-before'); after=threat(scratch/'threat-after')
comparisons=[]
for old in before['levels']:
    new=next(x for x in after['levels'] if x['level']==old['level'])
    comparisons.append(dict(level=old['level'], nativeHashIdentical=old['nativeStateHash']==new['nativeStateHash'], runIdentical=old['run']==new['run'], passiveRunIdentical=old['passiveRun']==new['passiveRun'], phasesIdentical=old['phases']==new['phases']))
(out/'threat.json').write_text(json.dumps(dict(before=before,after=after,L1_L5=comparisons),indent=2)+'\n')
(out/'source.json').write_text(json.dumps(dict(baseline=payload['baseline'],finalRevision=payload['finalRevision'],finalFiles=payload['finalFiles']),indent=2)+'\n')
raise SystemExit(int(any(c['exitCode'] for c in commands if c['name']!='threat-before-L1-L5')))
