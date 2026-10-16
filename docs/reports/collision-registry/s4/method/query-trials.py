import json,pathlib,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-query-trials';out.mkdir(parents=True,exist_ok=True)
names=['src/sim/spatial/SpatialHash.ts','src/sim/world/SolidRegistry.ts'];original={n:(root/n).read_text() for n in names}
old_loop='''        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(p.id) === false) return result; } else result.push(p.id); }
        }'''
assert old_loop in original[names[0]]
rows=[]
def variant(name):
 spatial=original[names[0]];registry=original[names[1]]
 squared=name in ['squared','both'];branch=name in ['branch','both']
 if branch:
  inner='''        if (visit) {
          for (let i = 0; i < items.length; i++) {
            const p = items[i], dx = p.x - x, dz = p.z - z, squared = dx * dx + dz * dz;
            if (squared <= radiusSquared && visit(p.id%s) === false) return result;
          }
        } else {
          for (let i = 0; i < items.length; i++) {
            const p = items[i], dx = p.x - x, dz = p.z - z;
            if (dx * dx + dz * dz <= radiusSquared) result.push(p.id);
          }
        }''' % (', squared' if squared else '')
  spatial=spatial.replace(old_loop,inner)
 elif squared:
  spatial=spatial.replace('if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(p.id) === false)', 'const squared = dx * dx + dz * dz;\n          if (squared <= radiusSquared) { if (visit) { if (visit(p.id, squared) === false)')
 if squared:
  spatial=spatial.replace('visit?: (id: number) => unknown','visit?: (id: number, squaredDistance: number) => unknown')
  registry=registry.replace('private readonly visitCommittedClear = (id: number): boolean => {','private readonly visitCommittedClear = (id: number, squaredDistance: number): boolean => {')
  start=registry.index('  private readonly visitCommittedClear = ');end=registry.index('  private readonly occupancyCells:',start)
  fragment=registry[start:end].replace('const dx = this.clearPoint.x - p.x, dz = this.clearPoint.z - p.z, reach =','const reach =').replace('if (dx * dx + dz * dz >= reach * reach)','if (squaredDistance >= reach * reach)')
  registry=registry[:start]+fragment+registry[end:]
 return {names[0]:spatial,names[1]:registry}
try:
 for repeat in range(2):
  for name in ['baseline','squared','branch','both']:
   for path,data in variant(name).items():(root/path).write_text(data)
   prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
finally:
 for path,data in original.items():(root/path).write_text(data)
