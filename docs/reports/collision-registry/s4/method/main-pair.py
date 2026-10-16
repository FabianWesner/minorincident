from pathlib import Path
import subprocess,json,os,statistics
out=Path('test-results/collision-s4-main-pair');out.mkdir(parents=True,exist_ok=True)
base=out/'main';base.mkdir(exist_ok=True)
subprocess.run(['tar','xf','tools/perf/collision-s4-main.tar','-C',str(base)],check=True)
(base/'tools/performance/sim.ts').write_text(Path('tools/performance/sim.ts').read_text())
(base/'tools/perf').mkdir(parents=True,exist_ok=True)
(base/'tools/perf/collision-s4-horde.ts').write_text(Path('tools/perf/collision-s4-horde.ts').read_text())
(base/'node_modules').symlink_to(Path('node_modules').resolve(),target_is_directory=True)
rows=[]
for trial in range(3):
 for name,cwd in [('main',base),('head',Path.cwd())]:
  file=(out/f'{trial}-{name}.json').resolve()
  subprocess.run(['node','--import','tsx','tools/perf/collision-s4-horde.ts',str(file)],cwd=cwd,check=True)
  rows.append(dict(trial=trial,source=name,results=json.loads(file.read_text())))
summary=[]
for n in [100,200]:
 med={name:statistics.median(next(x['simMsP95'] for x in r['results'] if x['minInfected']==n) for r in rows if r['source']==name) for name in ['main','head']}
 summary.append(dict(count=n,medians=med,changePercent=100*(med['head']/med['main']-1)))
(out/'summary.json').write_text(json.dumps(dict(protocol='120 warmup, 3600 measured ticks, seed 1, 3 alternating main/head trials, median p95 ratio',summary=summary,rows=rows),indent=2))
print(summary,flush=True)
