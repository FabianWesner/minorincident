import pathlib,subprocess,json
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-state-compare';out.mkdir(parents=True,exist_ok=True)
p=root/'src/sim/ai/CharacterSeparation.ts';restore=p.read_text()
before=(root/'tools/perf/collision-s4-coordinate-before.txt').read_text();after=(root/'tools/perf/collision-s4-coordinate-after.txt').read_text()
try:
 for name,source in [('before',before),('after',after)]:
  p.write_text(source);subprocess.run(['npx','tsx','tools/perf/collision-s4-state-trace.ts',str(out/(name+'.json'))],check=True)
 a=json.loads((out/'before.json').read_text());b=json.loads((out/'after.json').read_text());assert len(a)==len(b)==8
 summary=[]
 for left,right in zip(a,b):
  assert (left['count'],left['mixed'],left['seed'])==(right['count'],right['mixed'],right['seed'])
  mismatches=[i+1 for i,(x,y) in enumerate(zip(left['hashes'],right['hashes'])) if x!=y]
  row={k:right[k] for k in ['count','mixed','seed','minVisible','pendingMax','failures']};row.update(ticks=len(right['hashes']),mismatches=mismatches,eventsMatch=left['events']==right['events']);summary.append(row)
 (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary),flush=True)
 if any(row['mismatches'] or not row['eventsMatch'] for row in summary):raise SystemExit(1)
finally:p.write_text(restore)
