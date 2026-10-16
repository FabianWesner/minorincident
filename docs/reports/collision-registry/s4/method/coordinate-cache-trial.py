import pathlib,json,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-coordinate-cache-trials';out.mkdir(parents=True,exist_ok=True)
p=root/'src/sim/ai/CharacterSeparation.ts';original=p.read_text();s=original
s=s.replace("point: EntitySnapshot['transform']; radius:", "point: EntitySnapshot['transform']; x: number; z: number; radius:")
s=s.replace('const p = active.point, r = active.radius;', 'const p = active, r = active.radius;')
s=s.replace('point: e.transform, radius: r,', 'point: e.transform, x: e.transform.x, z: e.transform.z, radius: r,')
s=s.replace('body.point = e.transform; body.physical = actorRadius(e);', 'body.point = e.transform; body.x = e.transform.x; body.z = e.transform.z; body.physical = actorRadius(e);')
s=s.replace('const other = neighbor.entity, otherPoint = neighbor.point;', 'const other = neighbor.entity;')
s=s.replace('const dx = p.x - otherPoint.x, dz = p.z - otherPoint.z,', 'const dx = body.x - neighbor.x, dz = body.z - neighbor.z,')
needle='''      (body.infected ? world.infected!.infectedNav : nav).move(p, (distance ? dx / distance : Math.cos(angle)) * overlap * scale, (distance ? dz / distance : Math.sin(angle)) * overlap * scale, body.physical, true);'''
assert needle in s;s=s.replace(needle,needle+'\n      body.x = p.x; body.z = p.z;')
(out/'CharacterSeparation.ts').write_text(s);rows=[]
try:
 for repeat in range(3):
  for name,source in [('baseline',original),('coordinates',s)]:
   p.write_text(source);prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 p.write_text(s)
 r=subprocess.run(['npx','vitest','run','tests/sim/world/solid-admission.test.ts','tests/sim/world/solid-registry.test.ts','tests/unit/performance/spatial-contact-cache.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={out}/guards.json'])
 if r.returncode:raise SystemExit(r.returncode)
finally:p.write_text(original)
