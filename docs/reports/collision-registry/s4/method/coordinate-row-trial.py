import pathlib,json,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-coordinate-row-trials';out.mkdir(parents=True,exist_ok=True)
p=root/'src/sim/ai/CharacterSeparation.ts';restore=p.read_text();before=(root/'tools/perf/collision-s4-coordinate-source.txt').read_text()
s=before.replace('  let active: typeof bodies[number] | undefined;', '  let active: typeof bodies[number] | undefined;\n  let activeReach: number[] = [];')
s=s.replace('const reach = reaches[body.category][neighbor.category];', 'const reach = activeReach[neighbor.category];')
s=s.replace('point: p } = body; active = body;', 'point: p } = body; active = body; activeReach = reaches[body.category];')
assert 'activeReach = reaches[body.category]' in s
(out/'CharacterSeparation.ts').write_text(s);rows=[]
try:
 for repeat in range(3):
  for name,source in [('coordinates',before),('coordinate-row',s)]:
   p.write_text(source);prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
finally:p.write_text(restore)
