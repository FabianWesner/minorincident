import json,pathlib,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-proposal-trials';out.mkdir(parents=True,exist_ok=True)
sp=root/'src/sim/spatial/SpatialHash.ts';rp=root/'src/sim/world/SolidRegistry.ts';original={sp:sp.read_text(),rp:rp.read_text()};s=original[sp];r=original[rp]
s=s.replace('  reset(): void {','''  /** Same bucket/slot order as an unsorted circle query, for an already known contact. */
  before(a: number, b: number): boolean {
    const p = this.positions.get(a)!, q = this.positions.get(b)!;
    return p.cellX < q.cellX || p.cellX === q.cellX && (p.cellZ < q.cellZ || p.cellZ === q.cellZ && p.slot < q.slot);
  }
  reset(): void {''')
r=r.replace('  private hasPairExemptions = false;','''  private hasPairExemptions = false;
  private proposalBatch = false;
  private readonly proposalBlockers: number[] = [];
  private readonly proposalSweep: number[] = [];
  private readonly byProposalX = (a: number, b: number): number => this.bodyPoints[a]!.x - this.bodyPoints[b]!.x;''')
r=r.replace('    this.query.x = at.x; this.query.z = at.z;', '''    // The proposal batch is frozen until the first reservation pass finishes.
    if (this.proposalBatch && e && at === e.transform && radius === this.bodyRadii[e.id] && limit === tolerance) {
      const blocker = this.proposalBlockers[e.id];
      if (blocker) { this.bodyConflict = true; this.bodyConflictId = blocker; }
      return !blocker;
    }
    this.query.x = at.x; this.query.z = at.z;''')
method='''  /** Validate the frozen dynamic proposals once. Later repair queries retain the hash.
   * Mixed footprints otherwise repeat broad hash windows for each small body. */
  private prepareProposals(): void {
    this.proposalBatch = false;
    if (!Number.isFinite(this.maxActor) || this.maxActor <= survivor.radius * 2) return;
    const order = this.proposalSweep; order.length = 0;
    for (const e of this.bodies) {
      this.proposalBlockers[e.id] = 0;
      if (Number.isFinite(e.transform.x) && Number.isFinite(e.transform.z)) order.push(e.id);
    }
    order.sort(this.byProposalX);
    for (let i = 0; i < order.length; i++) {
      const id = order[i], a = this.bodyPoints[id]!, radius = this.bodyRadii[id];
      for (let j = i + 1; j < order.length; j++) {
        const otherId = order[j], b = this.bodyPoints[otherId]!, dx = b.x - a.x;
        if (dx > radius + this.maxActor) break;
        if (!layers(a, b)) continue;
        const dz = b.z - a.z, reach = radius + this.bodyRadii[otherId] - tolerance;
        if (dx * dx + dz * dz >= reach * reach || this.hasPairExemptions && pairExempt(this.live[id], this.live[otherId]!)) continue;
        const previous = this.proposalBlockers[id], otherPrevious = this.proposalBlockers[otherId];
        if (!previous || this.bodyIndex.before(otherId, previous)) this.proposalBlockers[id] = otherId;
        if (!otherPrevious || this.bodyIndex.before(id, otherPrevious)) this.proposalBlockers[otherId] = id;
      }
    }
    this.proposalBatch = true;
  }
'''
r=r.replace('  /** Last phase, after cleanup + .25.',method+'  /** Last phase, after cleanup + .25.')
r=r.replace('    for (const e of this.moved) {\n      const proof = this.contactProofs[e.id], blocker =', '    this.prepareProposals();\n    for (const e of this.moved) {\n      const proof = this.contactProofs[e.id], blocker =')
r=r.replace('    if (!this.unresolved.length) {','    this.proposalBatch = false;\n    if (!this.unresolved.length) {')
r=r.replace('  reset(): void { this.previousBodyIds.length', '  reset(): void { this.proposalBatch = false; this.proposalSweep.length = this.proposalBlockers.length = 0; this.previousBodyIds.length')
assert r.count('this.prepareProposals();')==1
(out/'SpatialHash.ts').write_text(s);(out/'SolidRegistry.ts').write_text(r)
rows=[]
try:
 for repeat in range(3):
  for name,files in [('baseline',original),('proposal-batch',{sp:s,rp:r})]:
   for p,data in files.items():p.write_text(data)
   prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:status=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':status.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 for p,data in {sp:s,rp:r}.items():p.write_text(data)
 subprocess.run(['npx','vitest','run','tests/sim/world/solid-admission.test.ts','tests/sim/world/solid-registry.test.ts','tests/unit/performance/spatial-contact-cache.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={out}/guards.json'])
finally:
 for p,data in original.items():p.write_text(data)
