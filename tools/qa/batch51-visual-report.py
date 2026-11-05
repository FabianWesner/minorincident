"""Keep compact receipts for the real-input review; image curation is separate."""
import hashlib
import json
from pathlib import Path
base=Path('test-results/batch51/visual')
rows=[]
for folder in sorted(base.iterdir()):
    if not folder.is_dir():continue
    row={'session':folder.name,'runs':[],'issues':[],'photos':[],'completion':[],'playableFramesOver200':[],'sourceReceipts':[]}
    for p in sorted(folder.glob('*.json')):
        raw=p.read_bytes();d=json.loads(raw)
        row['sourceReceipts'].append({'path':str(p),'sha256':hashlib.sha256(raw).hexdigest()})
        if p.name.startswith('runs-'):row['runs']+=d
        if p.name.startswith('issues-'):row['issues']+=d
        if p.name.endswith('-completion.json'):row['completion'].append({'file':p.name,'levels':[{**e,'result':{k:v for k,v in e['result'].items() if not isinstance(v,(list,dict)) or isinstance(v,list) and all(not isinstance(x,(dict,list)) for x in v)}}for e in d['levels']],'backend':d['backend'],'quality':d['quality'],'mission':{'phase':d['mission'].get('phase'),'completedObjectives':d['mission'].get('completedObjectives')}})
        if p.name.endswith('-frames.json'):row['playableFramesOver200'] += [f for f in d if f.get('playMs',0)>200]
    for p in sorted(folder.glob('*-threat.json')):
        d=json.loads(p.read_text())
        if 'samples' not in d:continue
        samples=d['samples']; summary=[]
        for level in sorted(set(x['level']for x in samples)):
            group=[x for x in samples if x['level']==level]
            driving=[x for x in group if x.get('step')=='approach']
            visible=[x for x in driving if x.get('visibleInfected')]
            points=[driving[0]['tick']] + [x['tick']for x in visible] + [driving[-1]['tick']] if driving else []
            summary.append({'level':level,'samples':len(group),'movingRunnerPoseSamples':sum(r.get('leanDegrees') is not None for x in group for r in x.get('runners',[])),'maxRunnerLeanDegrees':max((r['leanDegrees']for x in group for r in x.get('runners',[])if r.get('leanDegrees')is not None),default=None),'runnerClips':sorted(set(r.get('clip','unknown')for x in group for r in x.get('runners',[]))),'playerDamageCounterMax':max((x.get('damageTaken',0)for x in group),default=0),'attacksCounterMax':max((x.get('attacks',0)for x in group),default=0),
              'driving':{'samples':len(driving),'visibleSamples':len(visible),'firstVisibleSeconds':(visible[0]['tick']-driving[0]['tick'])/60 if visible else None,'maxNoVisibleSampleSeconds':max((b-a for a,b in zip(points,points[1:])),default=0)/60 if points else None,
              'startTick':driving[0]['tick']if driving else None,'endTick':driving[-1]['tick']if driving else None,'armorStart':driving[0].get('vehicleArmor')if driving else None,'armorEnd':driving[-1].get('vehicleArmor')if driving else None}})
        row['threatSummary']=summary
    for p in folder.glob('log-*.jsonl'):
        for line in p.read_text().splitlines():
            try:d=json.loads(line)
            except json.JSONDecodeError:continue
            if 'acceptancePhoto' in d:row['photos'].append(d['acceptancePhoto'])
    rows.append(row)
Path('docs/reports/batch51-qa/visual-runs.json').write_text(json.dumps(rows,indent=2)+'\n')
print([(r['session'],len(r['photos']),[(x['level'],x['finished'],x['deaths'])for x in r['runs']])for r in rows])
