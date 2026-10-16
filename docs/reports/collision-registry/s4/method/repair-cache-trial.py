import json,pathlib,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-repair-cache-trials';out.mkdir(parents=True,exist_ok=True)
p=root/'src/sim/world/SolidRegistry.ts';original=p.read_text();start=original.index('  commit(): void {');end=original.index('  private record(',start)
section=original[start:end]
section=section.replace('blocker = this.live[proof?.blocker ?? 0]', 'blockerId = proof?.blocker ?? 0, blocker = this.bodyPoints[blockerId]')
section=section.replace('const blocker = this.live[this.bodyRejections[e.id] ?? 0];','const blockerId = this.bodyRejections[e.id] ?? 0, blocker = this.bodyPoints[blockerId];')
section=section.replace('!pairExempt(e, blocker)', '(!this.hasPairExemptions || !pairExempt(e, this.live[blockerId]!))')
section=section.replace('blocker.transform','blocker').replace('blocker.id','blockerId')
section=section.replace('''        const other = this.live[id];
        if (!other || id === e.id || this.rejected[id] || stable && !this.movedIds[id] || pairExempt(e, other) || !layers(old, other.transform)) continue;
        const dx = old.x - other.transform.x, dz = old.z - other.transform.z;
        if (dx * dx + dz * dz < (radius + this.bodyRadii[id] - tolerance) ** 2) reject(other);''','''        const other = this.bodyPoints[id];
        if (!other || id === e.id || this.rejected[id] || stable && !this.movedIds[id] || this.hasPairExemptions && pairExempt(e, this.live[id]!) || !layers(old, other)) continue;
        const dx = old.x - other.x, dz = old.z - other.z;
        if (dx * dx + dz * dz < (radius + this.bodyRadii[id] - tolerance) ** 2) reject(this.live[id]!);''')
section=section.replace('''            const other = this.live[id];
            if (id === e.id || !other || pairExempt(e, other) || !layers(p, other.transform)) continue;
            const dx = p.x - other.transform.x, dz = p.z - other.transform.z, squared = dx * dx + dz * dz, reach = radius + this.bodyRadii[id];''','''            const other = this.bodyPoints[id];
            if (id === e.id || !other || this.hasPairExemptions && pairExempt(e, this.live[id]!) || !layers(p, other)) continue;
            const dx = p.x - other.x, dz = p.z - other.z, squared = dx * dx + dz * dz, reach = radius + this.bodyRadii[id];''')
section=section.replace('const p = e.transform; old.x = p.x;', 'const p = this.bodyPoints[e.id]!; old.x = p.x;')
points=original[:start]+section+original[end:]
query=points.replace('this.bodyIndex.query({ x: old.x, z: old.z, r: radius + this.maxActor }, this.nearby,', 'this.query.x = old.x; this.query.z = old.z; this.query.r = radius + this.maxActor;\n      this.bodyIndex.query(this.query, this.nearby,')
query=query.replace('this.bodyIndex.query({ x: p.x, z: p.z, r: Math.max(2, radius + this.maxActor) }, this.nearby, false);','this.query.x = p.x; this.query.z = p.z; this.query.r = Math.max(2, radius + this.maxActor);\n            this.bodyIndex.query(this.query, this.nearby, false);')
query=query.replace('this.bodyIndex.query({ x: p.x, z: p.z, r: radius + this.maxActor }, this.nearby, false);','this.query.x = p.x; this.query.z = p.z; this.query.r = radius + this.maxActor;\n          this.bodyIndex.query(this.query, this.nearby, false);')
for name,s in [('points',points),('points-query',query)]: (out/(name+'.ts')).write_text(s)
rows=[]
try:
 for repeat in range(3):
  for name,s in [('baseline',original),('points',points),('points-query',query)]:
   p.write_text(s);prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
finally:p.write_text(original)
