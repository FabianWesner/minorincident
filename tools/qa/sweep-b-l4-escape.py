"""Publish actual admission counterexamples without promoting gap/taste clauses."""
from pathlib import Path
import gzip,hashlib,json,subprocess
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
ledger=Path('docs/reports/sweep-b/L4-escape.json.gz')
data=json.loads(gzip.decompress(ledger.read_bytes()))
def counts_in_window(admissions,wave):
    return {str(edge):sum(a['count'] for a in admissions if a['edge']==edge and wave['tick']<=a['tick']<wave['tick']+540) for edge in wave['edges']}
def qualifies(admissions,wave,n):
    return all(c>=n for c in counts_in_window(admissions,wave).values())
control={'tick':1000,'edges':[0,1,2],'count':9}
good=[{'tick':1001,'edge':edge,'count':3} for edge in control['edges']]
controls={'threePerEdgeAccepted':qualifies(good,control,3),'missingActorRejected':not qualifies([dict(a,count=2) if a['edge']==1 else a for a in good],control,3),'lateCohortRejected':not qualifies([dict(a,tick=1540) if a['edge']==1 else a for a in good],control,3),'pooledNineOnOneEdgeRejected':not qualifies([{'tick':1001,'edge':0,'count':9}],control,3)}
assert all(controls.values())
rows=[]
for r in data['rows']:
    wave=r['waves'][0];target=2 if r['tier']=='low' else 3
    measured=counts_in_window(r['admissions'],wave)
    assert not qualifies(r['admissions'],wave,target)
    assert all(w['until']-w['start']==2400 for w in r['windows'])
    samples=r['samples'];chase=[]
    for s in samples:
        for a in s['actors']:
            if (a.get('l1TargetId')==1 and a.get('mode')=='chase') or (a.get('targetId')==1 and a['state'] in ('chase','attack')):
                chase.append({'tick':s['tick'],'id':a['id'],'playerDistance':a['playerDistance'],'state':a['state'],'mode':a.get('mode')})
    rows.append({'tier':r['tier'],'nativeFinalHash':r['finalHash'],'canonicalHash':r['canonicalHash'],'completed':r['run']['completed'],'firstWave':wave,'nextWaveTick':r['waves'][1]['tick'],'perEdgeExpected':target,'actualPerEdgeBeforeNextWave':measured,'actualFirstWindowAdmissions':[a for a in r['admissions'] if wave['tick']<=a['tick']<wave['tick']+540],'allCollapseCohortCounts':[a['count'] for a in r['admissions']],'windows':r['windows'],'chaseExamples':chase[:12],'gapOccupancy':[{'tick':s['tick'],'gapOpen':s['tick']<s['gapUntil'],'aliveInCorridor':sum(a['routeDistance']<7 for a in s['actors']),'farInCorridor':sum(a['routeDistance']<7 and a['playerDistance']>7 for a in s['actors']),'clearingInCorridor':sum(a['routeDistance']<7 and a['clearingStreet'] for a in s['actors'])}for s in samples]})
note='Actual mortal native complete routes preserve both canonical final hashes (low1a99e716/high6f55579b). First collapse wave low12889→13429 admits zero of the scheduled two bodies per each of edges0/1/2; high13609→14149 admits only one per each edge (IDs677/685/686), below three per edge. This preserves the source per-edge interpretation and low half-budget, rather than comparing pooled nine with three. Every-tick pending/admitted-ID conservation proves real births; scheduled totals alone are not PASS. All observed high collapse cohorts contain only one or two bodies, and low six cohorts one each, under existing cap pressure. Both tiers open exactly2400-tick escape windows, renewed after respawn; sampled live pursuer identities remain targeted to courier. Gap occupancy/clearing samples retained without claiming every corridor pixel clear; prior native ledger establishes55/76 actual visible route encounters. The actual wave shortfall closes FAIL; other clauses are not blanket-qualified, and no counts/caps/timers are changed.'
proof=Path('docs/reports/sweep-b/L4-13-proof.json')
proof.write_text(json.dumps({'row':'L4-13','status':'FAIL','sourceHash':data['sourceHash'],'ledger':str(ledger),'ledgerSha256':sha(ledger),'producerSha256':sha(__file__),'observation':note,'controls':controls,'rows':rows},indent=2)+'\n')
criterion=next(r['expected']for r in json.loads(Path('docs/reports/fix51-verify/L4.json').read_text())['rows']if r['id']=='L4-13')
review={'row':'L4-13','status':'FAIL','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'FAIL','note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note}for p in [proof,ledger,Path('docs/reports/sweep-b/L4-native-ledger.json.gz')]]}
Path('docs/qa/reviews/L4-13.json').write_text(json.dumps(review,indent=2)+'\n')
print('L4-13 FAIL',[(r['tier'],r['actualPerEdgeBeforeNextWave']) for r in rows])
