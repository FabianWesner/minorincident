"""Independently qualify same-actor story traces, with broken-data controls."""
import copy,gzip,json,sys
from pathlib import Path
stage=sys.argv[1];run=Path(sys.argv[2]);root=Path('docs/reports/sweep-a2');row='L1-03' if stage=='pickup' else 'L1-04'
r=json.loads((run/'receipt.json').read_text())
def measure(q):
 a=q['samples'];ids={s['actor'] for s in a if s.get('actor')};clips={s['entity'].get('story',{}).get('clip') for s in a if s.get('entity') and s['entity'].get('story')}
 transfer=[s for s in a if s.get('entity') and s['entity'].get('story') and s['entity']['story']['clip'] in (['npc-give','npc-wave'] if stage=='pickup' else ['npc-glance','npc-sign'])]
 hidden=sum(bool(s['entity']['hidden']) for s in transfer)
 not_drawn=sum(not s['drawn'] for s in transfer)
 final=next((s for s in a if s['done'] and s['delivered'] and s.get('entity') and s['entity']['at']['z']<=-13.5),a[-1]) if stage!='pickup' else a[-1]
 complete=final['done'] and final['carrying'] and not any('depot' in k for k in final['doors']) if stage=='pickup' else final['done'] and final['delivered'] and final['entity']['at']['z']<=-13.5 and not final['carrying']
 required={'npc-give','npc-wave','npc-walk'} if stage=='pickup' else {'npc-walk','npc-glance','npc-sign','npc-carry'}
 return {'tier':q['tier'],'actorIds':sorted(ids),'ticks':len(a),'clips':sorted(clips),'transferTicks':len(transfer),'hiddenTransferTicks':hidden,'betweenRenderNotDrawnFlags':not_drawn,'final':final,'pass':not q['errors'] and len(ids)==1 and required<=clips and len(transfer)>20 and hidden==0 and bool(complete)}
def qualify(v):return len(v['runs'])==2 and sorted(q['tier'] for q in v['runs'])==['high','low'] and all(measure(q)['pass'] for q in v['runs'])
controls=[]
def reject(name,v):controls.append({'test':name,'pass':not qualify(v)})
v=copy.deepcopy(r);v['runs'].pop();reject('missing quality',v)
v=copy.deepcopy(r);v['runs'][1]['tier']='low';reject('duplicate quality',v)
v=copy.deepcopy(r);v['runs'][0]['samples']=[s for s in v['runs'][0]['samples'] if not s['done']];reject('incomplete story',v)
v=copy.deepcopy(r);next(s for s in v['runs'][0]['samples'] if s.get('entity') and s['entity'].get('story') and s['entity']['story']['clip'] in ['npc-give','npc-sign'])['entity']['hidden']=True;reject('hidden transfer',v)
v=copy.deepcopy(r);v['runs'][0]['samples'][0]['actor']=999999;reject('actor identity substitution',v)
v=copy.deepcopy(r);
for s in v['runs'][0]['samples']:s['carrying']=stage!='pickup'
reject('parcel ownership never transfers',v)
if stage=='pickup':
 v=copy.deepcopy(r);v['runs'][0]['samples'][-1]['doors']=['l1-depot-clerk'];reject('door never closes',v)
assert qualify(r) and all(c['pass'] for c in controls)
result={k:r[k] for k in ['sourceHash','observerHash','revision']};result.update({'stage':stage,'runs':[measure(q) for q in r['runs']],'controls':controls,'pass':True,'method':'Same nonzero actor identity, actual ownership handoff and full final latch; every-tick simulation nonhidden transfer; between-render drawn flags retained as diagnostics only and required clip progression. Manual images supply visual quality comparison.'})
(root/f'{row}-story-proof.json').write_text(json.dumps(result,indent=2)+'\n');print(row,len(controls),'story rejection controls pass')
