import pathlib,json,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-complete-cache-trials';out.mkdir(parents=True,exist_ok=True)
p=root/'src/sim/world/SolidRegistry.ts';current=p.read_text();before=(root/'tools/perf/collision-s4-cache-before.txt').read_text();rows=[]
try:
 for repeat in range(3):
  for name,source in [('baseline',before),('complete-cache',current)]:
   p.write_text(source);prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 p.write_text(current)
 r=subprocess.run(['npx','vitest','run','tests/sim/ai/mega-pursuit.test.ts','tests/sim/world/solid-admission.test.ts','tests/sim/world/solid-registry.test.ts','tests/unit/performance/spatial-contact-cache.test.ts','tests/unit/render/corgi-feet.test.ts','tests/unit/render/seethrough.test.ts','tests/unit/tooling/scenelab-paw.test.ts','tests/unit/tooling/mega-visible-share.test.ts','--maxWorkers=4','--reporter=default','--reporter=json',f'--outputFile={out}/guards.json'])
 if r.returncode:raise SystemExit(r.returncode)
 subprocess.run(['npx','tsx','tools/perf/zoo-s2-profile.ts',str(out/'profile')],check=True)
finally:p.write_text(current)
