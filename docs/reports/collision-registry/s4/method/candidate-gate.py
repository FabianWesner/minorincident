import pathlib,subprocess,json,hashlib,sys
root=pathlib.Path.cwd();p=root/'src/sim/ai/CharacterSeparation.ts';before=p.read_bytes();candidate=(root/'tools/perf/collision-s4-coordinate-after.txt').read_bytes()
project,output,*paths=sys.argv[1:];target=root/output;target.parent.mkdir(parents=True,exist_ok=True)
try:
 p.write_bytes(candidate)
 (target.with_suffix('.source.json')).write_text(json.dumps({'source':str(p),'sha256':hashlib.sha256(candidate).hexdigest(),'project':project,'paths':paths},indent=2)+'\n')
 r=subprocess.run(['npx','vitest','run',*paths,'--project='+project,'--maxWorkers=4','--reporter=default','--reporter=json','--outputFile='+str(target)])
 if project=='timing':
  for count in [200,100]:(target.parent/f'zoo-{count}.json').write_bytes((root/f'docs/reports/zoo-s2/perf-{count}.json').read_bytes())
finally:p.write_bytes(before)
raise SystemExit(r.returncode)
