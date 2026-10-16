from pathlib import Path
import subprocess,json,sys
out=Path('test-results/collision-s4-pose-trial');out.mkdir(parents=True,exist_ok=True)
p=Path('src/sim/world/SolidRegistry.ts');base=p.read_text();s=base
s=s.replace('  private readonly bodyRadii: number[] = [];', '  private readonly bodyRadii: number[] = [];\n  private readonly bodyPoints: (Transform | undefined)[] = [];\n  private hasPairExemptions = false;')
a=s.index('  private readonly occupancyCells:')
s=s[:a]+'''  private readonly visitCommittedClear = (id: number): boolean => {
    const p = this.bodyPoints[id];
    if (id === this.clearId || !p || this.hasPairExemptions && pairExempt(this.clearEntity, this.live[id]!) || !layers(this.clearPoint, p)) return true;
    const dx = this.clearPoint.x - p.x, dz = this.clearPoint.z - p.z, reach = this.clearRadius + this.bodyRadii[id] - this.clearLimit;
    if (dx * dx + dz * dz >= reach * reach) return true;
    this.bodyConflict = true; this.bodyConflictId = id; return false;
  };
'''+s[a:]
s=s.replace('false, this.visitClear,','false, this.committing ? this.visitCommittedClear : this.visitClear,')
s=s.replace('this.bodies.length = this.moved.length = 0;', 'this.bodies.length = this.moved.length = 0; this.hasPairExemptions = false;')
s=s.replace('this.bodyRadii[e.id] = radius;', 'this.bodyRadii[e.id] = radius; this.bodyPoints[e.id] = e.transform; this.hasPairExemptions ||= e.attachedTo !== undefined;')
s=s.replace('this.bodyRadii[id] = 0;', 'this.bodyRadii[id] = 0; this.bodyPoints[id] = undefined;')
s=s.replace('this.live[e.id] = undefined; this.deferred++', 'this.live[e.id] = undefined; this.bodyPoints[e.id] = undefined; this.deferred++')
s=s.replace('this.bodyRadii.length = 0;', 'this.bodyRadii.length = this.bodyPoints.length = 0; this.hasPairExemptions = false;')
if '--copy' in sys.argv:
 s=s.replace('if (proposed) Object.assign(proposed, e.transform);', 'if (proposed) { const p = e.transform; proposed.x = p.x; proposed.y = p.y; proposed.z = p.z; proposed.yaw = p.yaw; }')
 s=s.replace('Object.assign(e.transform, old); this.publish(e);', 'const p = e.transform; p.x = old.x; p.y = old.y; p.z = old.z; p.yaw = old.yaw; this.publish(e);')
 s=s.replace('Object.assign(p, proposed);', 'p.x = proposed.x; p.y = proposed.y; p.z = proposed.z; p.yaw = proposed.yaw;')
 s=s.replace('Object.assign(p, old);', 'p.x = old!.x; p.y = old!.y; p.z = old!.z; p.yaw = old!.yaw;')
 out=Path('test-results/collision-s4-pose-copy-trial');out.mkdir(parents=True,exist_ok=True)
variant=s
rows=[]
for trial in range(3):
 for name,code in [('base',base),('variant',variant)]:
  p.write_text(code)
  rc=subprocess.call(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','tests/sim/performance/horde.test.ts','--maxWorkers=1','--reporter=json','--outputFile='+str(out/f'{trial}-{name}.json')])
  proof={str(n):json.loads(Path(f'docs/reports/zoo-s2/perf-{n}.json').read_text()) for n in [100,200]}
  rows.append(dict(trial=trial,name=name,exit=rc,proof=proof));print(rows[-1],flush=True)
p.write_text(variant)
rc=subprocess.call(['npx','vitest','run','tests/sim/world/solid-registry.test.ts','tests/sim/world/solid-admission.test.ts','tests/unit/performance/spatial-contact-cache.test.ts','--maxWorkers=1','--reporter=json','--outputFile='+str(out/'functional.json')])
(out/'trials.json').write_text(json.dumps(rows,indent=2));(out/'SolidRegistry.ts').write_text(variant)
raise SystemExit(rc)
