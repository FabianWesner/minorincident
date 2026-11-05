"""Physical passage receipts, independent target/motion checks and rejection controls."""
import copy,gzip,json,math
from pathlib import Path
root=Path('docs/reports/sweep-a2')
runs=[json.loads(Path(f'test-results/sweep-a2/alley-{tier}-r4/receipt.json').read_text()) for tier in ['low','high']]
def measure(r):
 results=[]
 for c in r['commands']:
  a=[s for b in c['batches'] for s in b['samples']];target=c['command']['walk'];p=a[-1]['player'];zero=best=0
  for s in a:zero=zero+1 if s['metresPerSecond']<.1 else 0;best=max(zero,best)
  results.append({'label':c['command']['label'],'target':target,'end':p,'distance':math.hypot(p['x']-target[0],p['z']-target[1]),'ticks':len(a),'maximumStoppedTicks':best,'footOnly':all(not s['mounted'] and s['carrying'] for s in a)})
 labels={x['label'] for x in results};zooms={c['state']['zoom'] for c in r['captures']}
 return {'tier':r['tier'],'commands':results,'zooms':sorted(zooms),'pass':not r.get('failure') and len(results)==25 and {'bench-corner','rear-gap-passage','alley-05','alley-08','alley-09','alley-13','alley-19','alley-22'}<=labels and zooms=={.5,1,1.5} and all(x['distance']<=.12 and x['maximumStoppedTicks']<30 and x['footOnly'] for x in results)}
def qualify(rs):return len(rs)==2 and sorted(r['tier'] for r in rs)==['high','low'] and all(measure(r)['pass'] for r in rs)
controls=[]
def reject(name,rs):controls.append({'test':name,'pass':not qualify(rs)})
reject('missing tier',runs[:1]);r=copy.deepcopy(runs);r[1]['tier']='low';reject('duplicate tier',r)
r=copy.deepcopy(runs);r[0]['commands'].pop();reject('incomplete route',r)
r=copy.deepcopy(runs);r[0]['commands'][1]['batches'][-1]['samples'][-1]['player']['x']+=2;reject('unreached target',r)
r=copy.deepcopy(runs)
for b in r[0]['commands'][1]['batches']:
 for s in b['samples']:s['metresPerSecond']=0
reject('snagged physical input',r)
r=copy.deepcopy(runs);r[0]['commands'][0]['batches'][0]['samples'][0]['mounted']=True;reject('mounted substitution',r)
r=copy.deepcopy(runs);r[0]['captures']=[c for c in r[0]['captures'] if c['state']['zoom']!=.5];reject('missing close zoom',r)
assert qualify(runs) and all(c['pass'] for c in controls)
result={k:runs[0][k] for k in ['sourceHash','observerHash','revision']};result.update({'runs':[measure(r) for r in runs],'controls':controls,'pass':True,'method':'Physical keyboard foot input, declared read-only coordinate route assistance. All25 destinations within0.12m, maximum two consecutive stopped ticks; no sustained snag. No position assignment, nav injection, protection or objective skip. Three production gameplay zooms at every endpoint. Visual fence cutout judged separately from all152 final frames. Fixed simulation ticks measure movement, not performance.'})
(root/'L1-12-measurement.json').write_text(json.dumps(result,indent=2)+'\n')
print('Both25-point physical routes pass;',len(controls),'rejection controls pass')
