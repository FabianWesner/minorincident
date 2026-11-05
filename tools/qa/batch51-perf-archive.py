"""Archive full timing inputs outside Git while retaining compact failed-attempt evidence."""
import hashlib,json,shutil
from pathlib import Path
root=Path('docs/reports/batch51-qa/perf');archive=Path('test-results/batch51/perf-raw');archive.mkdir(parents=True,exist_ok=True)
manifest=[];attempts=[]
for group in ['low','high','attempts']:
 source=root/group
 if not source.exists():continue
 assert not (archive/group).exists(),f'Archive already contains {group}; do not overwrite evidence'
 for path in sorted(source.rglob('*.json')):
  raw=path.read_bytes();manifest.append({'path':str(path.relative_to(root)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
  if group!='attempts' and 'attempts' not in path.parts:continue
  for r in json.loads(raw):
   f=r.get('performance',{});samples=r.get('samples',[]);level=r.get('level');elapsed=0;spikes=[]
   if level=='L1':
    for ms in f.get('frames',[]):
     elapsed+=ms
     if ms>=66:
      near=min(samples,key=lambda s:abs(s['wallSeconds']-elapsed/1000))
      spikes.append({'ms':ms,'atSeconds':elapsed/1000,'nearestObjective':near.get('objective'),'nearestPhase':near.get('phase'),'materialsWithin1s':[b for b in f.get('builds',[])if abs(b['at']-elapsed)<=1000]})
   attempts.append({'source':str(path.relative_to(root)),'level':level,'side':r['side'],'tier':r.get('tier', 'high' if 'high' in str(path) else 'low'),'failure':r.get('failure'),'nonGameplayFrames':f.get('nonGameplayFrames'),'durationMs':f.get('durationMs'),'rawMaximumMs':f.get('maxMs'),'initialObjective':samples[0].get('objective')if samples else None,'finalObjective':samples[-1].get('objective')if samples else None,'spikes':spikes,'disposition':'Rejected full 60 s window: result or next-level/loading boundary. L1 shutter prefix is retained separately as inherited transition evidence; L8 loading maxima are not gameplay regressions.'})
 shutil.move(str(source),str(archive/group))
(root/'raw-manifest.json').write_text(json.dumps({'archive':str(archive),'files':manifest},indent=2)+'\n')
(root/'attempts.json').write_text(json.dumps(attempts,indent=2)+'\n')
print('Archived',len(manifest),'raw receipts; retained',len(attempts),'attempt records')
