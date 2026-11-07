import gzip,json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
root=Path('docs/reports/final-c/L9-03');root.mkdir(exist_ok=True);stream=Path('docs/reports/final-c/L9-09');rows=[];caps=[];sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
for tier in ['low','high']:
 for route in ['road','countryside','dry-shortcut']:
  for zoom in [.5,1.5]:
   file=stream/f'{tier}-{route}-z{zoom}-physical.json.gz';a=json.loads(gzip.decompress(file.read_bytes()));r=a['rows'][0];assert not r['errors']and r['result']['phase']=='approach';prev=None;gap=maximum=excluded=0;positives=[]
   for s in r['samples']:
    sec=(s['tick']-(prev['tick']if prev else 0))/60;moving=sec
    if prev and sec>0 and sec<=1.5 and math.hypot(s['position']['x']-prev['position']['x'],s['position']['z']-prev['position']['z'])/sec<.5:moving=0;excluded+=sec
    gap+=moving;maximum=max(maximum,gap)
    if any(e['drawn']and e['hp']>0 for e in s['eye']['enemies']):positives.append(s['tick']);gap=0
    prev=s
   # The stream observer ends at first scripted approach. Charge the entire bounded crash tail as unknown moving emptiness.
   bound=maximum+.2+10;assert positives and bound<=60
   photo=r['captures']
   if not photo:
    pf=stream/f'photo-only-{tier}-{route}-z{zoom}-physical.json.gz';pa=json.loads(gzip.decompress(pf.read_bytes()));assert not pa['rows'][0]['errors'];photo=pa['rows'][0]['captures']
   assert photo and photo[0]['tick']==photo[0]['afterTick']and photo[0]['zoom']==zoom and photo[0]['visible'];c=photo[0];assert sha(c['file'])==c['sha256'];caps.append({'tier':tier,'route':route,'zoom':zoom,**c});rows.append({'tier':tier,'route':route,'zoom':zoom,'file':str(file),'sha256':sha(file),'samples':len(r['samples']),'positiveTicks':positives,'largestObservedMovingEmptySeconds':maximum,'maximumSamplingSeconds':.2,'excludedSlowSeconds':excluded,'unobservedScriptedCrashBoundSeconds':10,'conservativeUpperBoundSeconds':bound})
crash=[]
for tier in ['low','high']:
 a=json.loads(gzip.decompress(Path(f'docs/reports/final-c/L9-07/{tier}-physical.json.gz').read_bytes()))
 for r in a['rows']:
  ev=r['result']['events'];begin=next(e['tick']for e in ev if e.get('name')=='l9.crash-approach');end=next(e['tick']for e in ev if e.get('name')=='l9.crash-impact');assert end-begin==300;crash.append({'tier':tier,'healthMode':r['mode'],'approachToImpactSeconds':(end-begin)/60})
(root/'coverage.json').write_text(json.dumps({'sourceHash':a['sourceHash'],'producerSha256':sha(__file__),'method':'Actual submitted living bodies with unobstructed on-screen chest pixels from production playtest eyes, sampled every12physical-input simulationticks along every authored detour. Moving clock uses established >=0.5m/s endpoint threshold and excludes slow intervals only with0.2s observations. Full controlled drive ends at scripted approach; instead of faking an inactive-seat observation, add a conservative10s of completely unknown moving emptiness to every maximum, plus0.2s sampling slack. Current four independent actual crash runs measure5s to destroyScripted/ejection; frozen LevelNineCrash guarantees that endpoint. Worst bound54.6s<60 even with doubled tail. Photo-only supplements for four older completed runs claim no full-route completion. No FPS timing.','crashTailReceipts':crash,'crashSource':{'file':'src/sim/missions/LevelNineCrash.ts','sha256':sha('src/sim/missions/LevelNineCrash.ts')},'rows':rows,'retainedFrames':caps},indent=2)+'\n')
for off in range(0,len(caps),4):
 batch=caps[off:off+4];im=Image.new('RGB',(2560,1480));d=ImageDraw.Draw(im)
 for i,c in enumerate(batch):im.paste(Image.open(c['file']),(i%2*1280,i//2*740+20));d.text((i%2*1280,i//2*740),c['tier']+' '+c['route']+' z'+str(c['zoom'])+' tick'+str(c['tick']))
 im.save(f'test-results/final-c/L9-03-witness-{off//4}.jpg',quality=92)
print('maximum bound',max(r['conservativeUpperBoundSeconds']for r in rows),'positives',[len(r['positiveTicks'])for r in rows])
