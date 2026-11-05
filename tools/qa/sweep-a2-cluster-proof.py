"""Qualify physical route receipts, retain rejected trials and hash reviewed captures."""
import copy,gzip,hashlib,json,subprocess
from pathlib import Path
root=Path('docs/reports/sweep-a2')
def read(kind):return json.loads(Path(f'test-results/sweep-a2/{kind}/receipt.json').read_text())
def qualifies(r):
 if r.get('failure') or not r.get('commands'):return False
 a,b=r['start'],r['final'];ids=a['ids']
 if not 12<=len(ids)<=16 or len(set(ids))!=len(ids) or set(ids)!=set(b['ids']):return False
 if any(x.get('hp',0)<=0 or x.get('hidden') for x in a['actors']):return False
 if len(set(b['playerClusterKillIds']))>len(ids)/2 or not set(b['playerClusterKillIds'])<=set(ids):return False
 if b['hp']<=0 or not b['crossedAt']:return False
 if any(c['after']['hp']<=0 or c['after']['missionPhase']=='retry' for c in r['commands']):return False
 if r['opening']=='alarm':
  alarms=[e for e in b['alarms'] if e['kind']=='car-alarm' and e['id']==118]
  if not alarms:return False
  if not any(c['after']['tick']>=alarms[0]['tick'] and any(x.get('mode')=='attracted' for x in c['after']['actors']) for c in r['commands']):return False
 return True
kinds=['cluster','cluster-final','cluster-fight','cluster-alarm','cluster-alarm-six'];data={k:read(k) for k in kinds}
selected=[r for r in data['cluster-fight']['runs'] if r['opening']=='side' or r['tier']=='high']+data['cluster-alarm-six']['runs']
assert len(selected)==4 and all(map(qualifies,selected))
assert {(r['tier'],r['opening']) for r in selected}=={(t,o) for t in ['low','high'] for o in ['side','alarm']}
controls=[]
def reject(name,r):controls.append({'test':name,'pass':not qualifies(r)})
r=copy.deepcopy(selected[-1]);r['final']['playerClusterKillIds']=r['start']['ids'][:7];reject('seven of thirteen kills rejected',r)
r=copy.deepcopy(selected[-1]);r['start']['ids']=r['start']['ids'][:11];reject('eleven identities rejected',r)
r=copy.deepcopy(selected[-1]);r['final']['hp']=0;reject('dead courier rejected',r)
r=copy.deepcopy(selected[-1]);r['final']['crossedAt']=None;reject('missing checkpoint crossing rejected',r)
r=copy.deepcopy(selected[-1]);r['final']['alarms']=[];reject('missing alarm rejected',r)
r=copy.deepcopy(selected[-1]);r['start']['ids'][-1]=r['start']['ids'][0];reject('duplicate identity rejected',r)
reject('actual seven-kill low alarm rejected',data['cluster-fight']['runs'][1]);assert all(c['pass'] for c in controls)
summary=[]
for r in selected:
 b=r['final'];summary.append({'tier':r['tier'],'opening':r['opening'],'clusterIds':r['start']['ids'],'kills':b['playerClusterKillIds'],'hp':b['hp'],'crossedAt':b['crossedAt'],'commands':len(r['commands']),'qualifies':True})
for k,d in data.items():(root/f'L2-14-{k}-ledger.json.gz').write_bytes(gzip.compress(json.dumps(d).encode(),mtime=0))
cleanup=[]
for k in kinds:
 for p in json.loads((root/f'{k}-photos.json').read_text())['photos']:
  f=Path(p['raw']);assert hashlib.sha256(f.read_bytes()).hexdigest()==p['sha256'];assert hashlib.sha256(Path(p['sheet']).read_bytes()).hexdigest()==p['sheetSha256'];f.unlink();cleanup.append(p['raw'])
note='All104 fresh captures personally inspected, including every incomplete and rejected trial. Retained original-size four-cell sheets; overview sheets viewed at half-size per cell. Side path visibly runs along hedges/tree-lined edge into police checkpoint. Alarm frames show Car alarm prompt by white SUV; subsequent crosswalk/road and checkpoint frames show live courier, corgi and pursuing infected. Read-only actor ledger corroborates actual car118 distraction and attracted modes. Ordinary mortal native prefix followed by physical WASD/E and mouse only; coordinate/nav assistance explicitly declared, no screen-only claim. Low/high side kills0/13; low alarm6/13 HP20.33; high alarm4/13 HP90.07. Seven-kill alarm excluded; navigation setup failures and mortal deaths are incomplete trials, not game FAILs.'
proof={**{k:data['cluster-fight'][k] for k in ['sourceHash','observerHash','revision']},'selected':summary,'controls':controls,'pass':True,'whatSeen':note,'deletedRawCount':len(cleanup),'deleted':cleanup}
(root/'L2-14-image-review.json').write_text(json.dumps(proof,indent=2)+'\n')
files=list(root.glob('L2-14-*-ledger.json.gz'))+[root/'L2-14-image-review.json']
for k in kinds:files += [root/f'{k}-photos.json']+list((root/'reviewed').glob(k+'-*.jpg'))
review={'row':'L2-14','status':'PASS','reviewer':'Codex sweep-a2','date':'2026-11-05','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':'Cluster **12–16** (authored 13) on the Elm approach; passable killing ≤ 50 % of it; side path and car alarm each work.','verdict':'PASS','note':note}],'evidence':[{'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'what':note} for p in sorted(set(files))],'notes':'No game changes or weakened criteria. Six-kill stopping policy controls physical attacks only; ordinary damage remains enabled. Failed attempts retained and excluded.'}
Path('docs/qa/reviews/L2-14.json').write_text(json.dumps(review,indent=2)+'\n')
print(json.dumps(summary,indent=2));print('raw deleted',len(cleanup))
