"""Physical bay entry proof and falsification controls; fixed simulation time only."""
import copy,json,math
from pathlib import Path
root=Path('docs/reports/sweep-a2');proof=json.load(open('test-results/sweep-a2/bay/receipt.json'))
def measure(r):
 a=r['samples'];first=next((s for s in a if s['fire']=='completed'),None);before=[s for s in a if not first or s['tick']<first['tick']];calls=sorted({s['say']['at'] for s in before if s.get('say') and s['say']['text']=='Get in!'})
 origins={e['id']:e['at'] for e in before[0]['living']};moves=[math.hypot(e['at']['x']-origins[e['id']]['x'],e['at']['z']-origins[e['id']]['z']) for s in before for e in s['living'] if e['id'] in origins]
 final=r['final'];door=final['door'];trigger=final['trigger'];dx=trigger['x']-door['x'];dz=trigger['z']-door['z'];length=math.hypot(dx,dz);nx=dx/length;nz=dz/length
 closed=[s for s in a if s['gate'] is False];corgi=[{'tick':s['tick'],'id':c['id'],'depth':(c['at']['x']-door['x'])*nx+(c['at']['z']-door['z'])*nz,'hidden':c['hidden']} for s in closed for c in s['corgi']]
 valid=bool(first) and not r['errors'] and len(r['commands'])>0 and first['tick']>r['physicalStart'] and len(calls)>=3 and all(b-a>=240 for a,b in zip(calls,calls[1:])) and len(before)>=480 and all(s['gate'] is True and len(s['living'])>0 and not s['storyLock'] for s in before) and max(moves,default=0)>1 and bool(closed) and final['gate'] is False and bool(corgi) and min(c['depth'] for c in corgi)>.6 and all(not c['hidden'] for c in final['corgi'])
 return {'tier':r['tier'],'calls':calls,'minimumLiveBeforeEntry':min(len(s['living']) for s in before),'maximumActualInfectedTravel':max(moves,default=0),'physicalCommands':len(r['commands']),'physicalStart':r['physicalStart'],'enteredAt':first['tick'] if first else None,'firstClosedAt':closed[0]['tick'] if closed else None,'minimumCorgiInsideDepthAtClosure':min((c['depth'] for c in corgi),default=None),'final':final,'pass':valid}
def qualify(p):return len(p['runs'])==2 and sorted(r['tier'] for r in p['runs'])==['high','low'] and all(measure(r)['pass'] for r in p['runs'])
controls=[]
def reject(n,p):controls.append({'test':n,'pass':not qualify(p)})
p=copy.deepcopy(proof);p['runs'].pop();reject('missing quality',p)
p=copy.deepcopy(proof);p['runs'][0]['commands']=[];reject('native-only entry substitution',p)
p=copy.deepcopy(proof)
for s in p['runs'][0]['samples']:s['say']=None
reject('missing repeated invitation',p)
p=copy.deepcopy(proof);p['runs'][0]['samples'][0]['gate']=False;reject('shutter closes before entry',p)
p=copy.deepcopy(proof);p['runs'][0]['samples'][0]['living']=[];reject('infected culled before entry',p)
p=copy.deepcopy(proof)
for s in p['runs'][0]['samples']:
 if s['gate'] is False:
  for c in s['corgi']:c['at']['x']=s['door']['x']+2
reject('corgi outside closed shutter',p)
p=copy.deepcopy(proof);p['runs'][0]['final']['gate']=True;reject('shutter never closes',p)
assert qualify(proof) and all(c['pass'] for c in controls)
result={k:proof[k] for k in ['sourceHash','observerHash','revision']};result.update({'runs':[measure(r) for r in proof['runs']],'controls':controls,'pass':True,'method':'Physical keyboard commands after8s idle approach. Gate, actual repeated invitation timestamps, continuously living moving infected, actual objective entry and corgi signed inward depth at every closed-gate sample. Incoming player damage suppression only; no mortality/difficulty or recorded Get-in voice claim. Fixed simulation ticks are not performance timing.'});(root/'L1-15-measurement.json').write_text(json.dumps(result,indent=2)+'\n');print('Both physical bay entries and7 rejection controls pass')
