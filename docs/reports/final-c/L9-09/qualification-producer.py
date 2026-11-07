from pathlib import Path
import json,gzip,hashlib
root=Path('docs/reports/final-c/L9-09');seams=json.loads((root/'seams.json').read_bytes());sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();assert seams['piecewiseAffine'] and len(seams['assets'])==97 and len(seams['rows'])==172
assert all(sha(x['file'])==x['sha256']for x in [seams['layout']]+seams['assets']);assert all(x['samples']>0 and x['missing']==0 and x['maxMismatch']<=.02 for x in seams['rows']);rows=[]
for tier in ['low','high']:
 for route in ['road','countryside','dry-shortcut']:
  for zoom in [.5,1.5]:
   p=root/f'{tier}-{route}-z{zoom}-physical.json.gz';a=json.loads(gzip.decompress(p.read_bytes()));r=a['rows'][0];limit=9 if tier=='low' else 25;end=next(e['tick']for e in r['result']['events']if e.get('name')=='l9.crash-approach');frames=[f for f in r['result']['inputs']if f['tick']<end];assert len(frames)==end;j=0
   for i,f in enumerate(frames):
    while j+1<len(r['commands'])and r['commands'][j+1]['tick']<=f['tick']:j+=1
    k=r['commands'][j]['keys'];assert f['tick']==i and k and f['drive']['throttle']==int('KeyW'in k)-int('KeyS'in k)and f['drive']['steer']==int('KeyD'in k)-int('KeyA'in k)
   assert len(r['samples'])>400 and r['result']['phase']=='approach'and not r['errors']
   assert all(s['tick']==i*12 for i,s in enumerate(r['samples']))
   assert all(s['phase']=='driving'and s['active']>0 and not(s['storyLock']or{}).get('scripted')for s in r['samples'][:-1])
   assert all(s['terrain']['terrain']['resident']==len(s['terrain']['terrain']['chunks'])and s['terrain']['terrain']['resident']+s['terrain']['terrain']['loading']<=limit and s['terrain']['terrain']['limit']==limit and s['simChunks']['resident']<=limit for s in r['samples'])
   changes=len({tuple(sorted(s['terrain']['terrain']['chunks']))for s in r['samples']});unload=r['samples'][-1]['terrain']['terrain']['unloaded'];assert changes>=5 and unload>0
   rows.append({'tier':tier,'route':route,'zoom':zoom,'file':str(p),'sha256':sha(p),'inputTicks':len(frames),'sets':changes,'unloaded':unload,'peakDetailed':max(s['terrain']['terrain']['resident']+s['terrain']['terrain']['loading']for s in r['samples']),'peakSim':max(s['simChunks']['resident']for s in r['samples']),'continuousInput':True,'noScriptedLock':True})
result={'sourceHash':seams['sourceHash'],'observerHash':seams['observerHash'],'producerSha256':sha(__file__),'method':'Apply the existing l9-stream-receipts.ts numeric predicates unchanged to current immutable12real-input routes: per-tick held-key equality across each actual streaming change, no scripted driving lock, actual detailed+loading/sim slot caps. This is input acceptance, not an FPS/frame-time assertion. Exhaustive actual-GLB paired terrain boundary checks remain separate from unpaired permanent structural/horizon faces.','seams':seams['summary'],'rows':rows,'pass':True};(root/'stream-qualification.json').write_text(json.dumps(result,indent=2)+'\n');print([(r['tier'],r['route'],r['zoom'],r['sets'],r['peakDetailed'],r['inputTicks'])for r in rows])
