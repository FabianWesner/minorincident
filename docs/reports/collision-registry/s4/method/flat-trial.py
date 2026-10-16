import json,pathlib,subprocess
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-flat-trials';out.mkdir(parents=True,exist_ok=True)
path=root/'src/sim/spatial/SpatialHash.ts';original=path.read_text();flat=original
flat=flat.replace('type Cell = { items: Position[];', 'type Cell = { ids: number[]; x: number[]; z: number[];')
flat=flat.replace('if (previous && previous.cellX === cellX && previous.cellZ === cellZ) { previous.x = x; previous.z = z; return; }','''if (previous && previous.cellX === cellX && previous.cellZ === cellZ) {
      previous.x = x; previous.z = z;
      const cell = this.cells.get(cellX)!.get(cellZ)!;
      cell.x[previous.slot] = x; cell.z[previous.slot] = z; return;
    }''')
flat=flat.replace('cell = { items: [] }','cell = { ids: [], x: [], z: [] }')
flat=flat.replace('position.slot = cell.items.length; cell.items.push(position);','position.slot = cell.ids.length; cell.ids.push(id); cell.x.push(x); cell.z.push(z);')
flat=flat.replace('''    const items = this.cells.get(position.cellX)!.get(position.cellZ)!.items;
    // Retain Map insertion order: contact resolution depends on stable bucket order.
    items.splice(position.slot, 1);
    for (let i = position.slot; i < items.length; i++) items[i].slot = i;''','''    const cell = this.cells.get(position.cellX)!.get(position.cellZ)!;
    // Retain Map insertion order: contact resolution depends on stable bucket order.
    cell.ids.splice(position.slot, 1); cell.x.splice(position.slot, 1); cell.z.splice(position.slot, 1);
    for (let i = position.slot; i < cell.ids.length; i++) this.positions.get(cell.ids[i])!.slot = i;''')
flat=flat.replace('cell.items.length','cell.ids.length').replace('cell.items[i].id','cell.ids[i]')
flat=flat.replace('''        const items = cell.items;
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(p.id) === false) return result; } else result.push(p.id); }
        }''','''        const ids = cell.ids, xs = cell.x, zs = cell.z;
        for (let i = 0; i < ids.length; i++) {
          const dx = xs[i] - x, dz = zs[i] - z;
          if (dx * dx + dz * dz <= radiusSquared) { if (visit) { if (visit(ids[i]) === false) return result; } else result.push(ids[i]); }
        }''')
assert 'cell.items' not in flat
(out/'flat.ts').write_text(flat);rows=[]
try:
 for repeat in range(3):
  for name,source in [('baseline',original),('flat',flat)]:
   path.write_text(source);prefix=out/f'{repeat}-{name}'
   with open(str(prefix)+'.log','w') as log:r=subprocess.run(['npx','vitest','run','tests/sim/performance/zoo-s2.test.ts','--maxWorkers=4','--reporter=json',f'--outputFile={prefix}.json'],stdout=log,stderr=subprocess.STDOUT)
   row={'repeat':repeat,'variant':name,'exit':r.returncode}
   for count in [200,100]:row[str(count)]=json.loads((root/f'docs/reports/zoo-s2/perf-{count}.json').read_text())
   rows.append(row);(out/'trials.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
finally:path.write_text(original)
