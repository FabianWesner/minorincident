import pathlib,json,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-separation-cache-trials';out.mkdir(parents=True,exist_ok=True)
sp=root/'src/sim/ai/CharacterSeparation.ts';rp=root/'src/sim/world/SolidRegistry.ts';restore={sp:sp.read_text(),rp:rp.read_text()}
beforeRegistry=(root/'tools/perf/collision-s4-cache-before.txt').read_text();partial=(root/'tools/perf/collision-s4-cache-partial.txt').read_text();s=restore[sp]
s=s.replace('type Body = { entity: EntitySnapshot;','type Body = { entity: EntitySnapshot; point: EntitySnapshot[\'transform\'];')
s=s.replace('const p = active.entity.transform, r = active.radius;', 'const p = active.point, r = active.radius;')
s=s.replace('body = { entity: e, radius: r,','body = { entity: e, point: e.transform, radius: r,')
s=s.replace('      body.physical = actorRadius(e);','      body.point = e.transform; body.physical = actorRadius(e);')
s=s.replace('const body = active!, { entity: e } = body;', 'const body = active!, { entity: e, point: p } = body;')
s=s.replace('      const other = neighbor.entity;', '      const other = neighbor.entity, otherPoint = neighbor.point;')
s=s.replace('const dx = e.transform.x - other.transform.x, dz = e.transform.z - other.transform.z,', 'const dx = p.x - otherPoint.x, dz = p.z - otherPoint.z,')
s=s.replace('(e.infected ? world.infected!.infectedNav : nav).move(e.transform,', '(body.infected ? world.infected!.infectedNav : nav).move(p,')
s=s.replace('const { entity: e, radius: r } = body;', 'const { entity: e, radius: r, point: p } = body;')
s=s.replace('query.x = e.transform.x; query.z = e.transform.z;', 'query.x = p.x; query.z = p.z;')
s=s.replace("if (e.transform.x !== query.x || e.transform.z !== query.z) { world.spatial.set(e.id, e.transform.x, e.transform.z);", "if (p.x !== query.x || p.z !== query.z) { world.spatial.set(e.id, p.x, p.z);")
(out/'CharacterSeparation.ts').write_text(s);(out/'SolidRegistry.ts').write_text(partial)
rows=[]
try:
 for repeat in range(3):
  for name,registry,separation in [('baseline',beforeRegistry,restore[sp]),('separation',beforeRegistry,s),('combined',partial,s)]:
   rp.write_text(registry);sp.write_text(separation);prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 rp.write_text(partial);sp.write_text(s)
 r=subprocess.run(['npx','vitest','run','tests/sim/ai/mega-pursuit.test.ts','tests/sim/world/solid-admission.test.ts','tests/sim/world/solid-registry.test.ts','tests/unit/performance/spatial-contact-cache.test.ts','tests/unit/render/corgi-feet.test.ts','tests/unit/render/seethrough.test.ts','tests/unit/tooling/scenelab-paw.test.ts','tests/unit/tooling/mega-visible-share.test.ts','--maxWorkers=4','--reporter=default','--reporter=json',f'--outputFile={out}/guards.json'])
 if r.returncode:raise SystemExit(r.returncode)
finally:
 for p,source in restore.items():p.write_text(source)
