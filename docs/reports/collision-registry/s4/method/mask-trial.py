import hashlib,json,pathlib,subprocess,tarfile
root=pathlib.Path.cwd(); out=root/'test-results/collision-s4-mask-trials';out.mkdir(parents=True,exist_ok=True)
names=['src/sim/world/SolidRegistry.ts','src/sim/ai/MegaPursuit.ts']
current={n:(root/n).read_bytes() for n in names}
with tarfile.open(root/'tools/perf/collision-s4-coarse-before.tar') as archive:
 before={n:archive.extractfile(n).read() for n in names}
rows=[]
try:
 for repeat in range(3):
  for variant,files in [('coarse-predicate',before),('existing-hidden-mask',current)]:
   for name,data in files.items():(root/name).write_bytes(data)
   prefix=out/f'{repeat}-{variant}'
   command=['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=1','--reporter=json',f'--outputFile={prefix}.json']
   with open(str(prefix)+'.log','w') as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':variant,'exit':result.returncode,'hashes':{n:hashlib.sha256(d).hexdigest() for n,d in files.items()}}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
finally:
 for name,data in current.items():(root/name).write_bytes(data)
subprocess.run(['npx','tsx','tools/perf/zoo-s2-profile.ts',str(out/'profile')],check=True)
