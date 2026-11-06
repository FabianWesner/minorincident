"""Publish one measured render/native counterexample or complete objective row."""
from pathlib import Path
import sys,json,gzip,hashlib,subprocess
row=sys.argv[1];level=row.split('-')[0]
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
load=lambda p:json.loads(gzip.decompress(Path(p).read_bytes()) if str(p).endswith('.gz') else Path(p).read_bytes())
status='FAIL';extra=[]
if row=='L4-05':
 path=Path('docs/reports/sweep-b/L4-cohorts.json.gz');raw=Path('docs/reports/sweep-b/L4-cohorts.json')
 if raw.exists():path.write_bytes(gzip.compress(raw.read_bytes(),mtime=0));raw.unlink()
 data=load(path);values=[{'tier':r['tier'],'smallest':r['smallest'],'largest':r['largest'],'firstSingleton':next(c for c in r['cohorts'] if len(c['actors'])==1),'nativeStateHash':r['finalHash'],'canonicalStateHash':r['canonicalHash']} for r in data['rows']]
 clause='actual admitted street cohort sizes'
 note='Both tiers contain actual one-body street cohorts, below unchanged2–5 target. Low actor229 at tick2840/origin23/edge0; high actor279 at tick2340/origin17/edge4. Every-tick newly appended emergedIds are grouped by the production same-tick/source transaction, not geometric clustering. Full admitted ID/position ledger retained; maximum5, minimum1. Both ordinary mortal complete final hashes equal current canonical receipts. The singleton counterexample closes FAIL; street-edge angular diversity, wall crossing and forbidden-interior clauses are not promoted to PASS.'
elif row in ['L4-14','L4-17']:
 path=Path('docs/reports/sweep-b/L4-render-ledger.json.gz');data=load(path);extra=['docs/reports/sweep-b/L4-render-capture-review.json']
 if row=='L4-14':
  status='PASS';clause='actual cellar-entry live damage and renderer scorch census'
  values=[{'tier':r['tier'],'tick':r['entry']['tick'],'descendAt':r['entry']['descendAt'],'actualTier':r['entry']['actualTier'],'renderTier':r['entry']['renderTier'],'fires':r['entry']['fires'],'shatteredWindows':r['entry']['glass'],'burningVehicleIds':r['entry']['burningVehicleIds'],'actualRendererScorch':r['entry']['vfx']['blasts']['scorch']}for r in data['rows']]
  assert all(v['fires']>=4 and v['shatteredWindows']>=10 and len(v['burningVehicleIds'])>=2 and v['actualRendererScorch']>=6 and v['tier']==v['actualTier']==v['renderTier'] for v in values)
  note='Both current low/high renderer worlds at actual cellar entry contain4 persistent fires,3 burned/burning vehicle identities,14 shattered-window events and21 live production Blasts.scorch pool instances (target≥6). Actual render and director tiers agree with each requested tier. Native ordinary route damage ledgers independently retain actual exploded/burned vehicle entities; collapse fire effects persist. The old s.scorch controller field is not the renderer count and is not used. Both new entry images were inspected; they frame the courtyard, so the remote damage census is supplied by the production state/pools and earlier151-frame full-route review.'
  extra+=['docs/reports/sweep-b/L4-native-ledger.json.gz','docs/reports/sweep-b/L4-capture-review.json']
 else:
  clause='actual renderer corpse pile lift counterexample'
  values=[]
  for r in data['rows']:
   s=max(r['samples'],key=lambda s:s['corpseLayout']['maxLiftM']);values.append({'tier':r['tier'],'tick':s['tick'],'audit':s['corpseLayout']})
  assert all(v['audit']['maxLiftM']>1.5 for v in values)
  note='Actual production CorpseLayout.audit reports corpse roots lifted1.76m low and2.86m high above their source feet, already exceeding the ~1m pile limit before adding body thickness. Worst rendered-second samples and full layout audit timeline retained. These are ground heap lifts, not airborne corpseBlast positions (the production layout excludes those flights). This closes FAIL through pile height; no claim that all limbs or continuous player/corpse ordering pass. The two entry frames do not frame the remote piles; the quantitative counterexample is the actual shared render layout.'
elif row in ['L5-02','L5-12']:
 path=Path('docs/reports/sweep-b/L5-render-ledger.json.gz');data=load(path);extra=['docs/reports/sweep-b/L5-render-capture-review.json']
 if row=='L5-02':
  status='PASS';clause='actual opening objective silence allied-fire and moving-vehicle clocks';values=[]
  native=load('docs/reports/sweep-b/L5-opening.json');extra+=['docs/reports/sweep-b/L5-opening.json','docs/reports/sweep-b/L5-capture-review.json']
  for r in data['rows']:
   ss=[s for s in r['samples'] if s['l5']];first=min(v['foundAt'] for s in ss for v in s['l5']['survivors'] if v['foundAt']);early=[s for s in ss if s['tick']<=3600]
   assert all(s['audioFlags']['state']=='running' and s['audioFlags']['unlocked'] and not s['audioFlags']['muted'] for s in early)
   before=[s for s in ss if s['tick']<first];assert not any(s['audioMusic']['streamed']['transitions'] for s in before);assert not any(s['allies'] for s in early)
   prev={};moving=[]
   for s in early:
    for v in s['vehicles']:
     a=prev.get(v['id']);b=v['at']
     if a and abs(a['x']-b['x'])+abs(a['z']-b['z'])>1e-6:moving.append((s['tick'],v['id']))
     prev[v['id']]=b
   assert not moving
   n=next(n for n in native['rows'] if n['tier']==r['tier']);events=n['events'];emerge=next(e['tick'] for e in events if e['type']=='l5.emerged');search=next(e['tick'] for e in events if e['type']=='l5.searching');assert search-emerge==600
   assert not any(e['type']=='ally.attack' and e['tick']<=3600 for e in events)
   values.append({'tier':r['tier'],'actualTier':ss[0]['actualTier'],'initialInfected':ss[0]['initialInfected'],'mortal':not ss[0]['god'],'emergedTick':emerge,'objectiveTick':search,'firstFoundTick':first,'firstObservedMusicRequestTick':next(s['tick'] for s in ss if s['audioMusic']['streamed']['transitions']),'first60AlliedFighters':0,'first60MovingVehicles':0,'first60AlliedShots':0,'nativeControlHashes':n['hashes']})
  note='Both tiers: Hours-later caption is visible in prior current physical opening captures; actual emergence99 to search699 is exactly10s without the search objective. Actual running/unmuted/unlocked audio snapshots have no music request before survivor1 (1921low/2126high); first observed calm-score requests2040/2220. First60s have zero allied fighters, zero allied shots and unchanged positions for every vehicle. Unarmed Mia can join after32/35s; E23-AC04 forbids allied fighters, not an early survivor rescue. Independent native80s observers preserve exact unobserved-control hashes. Initial100/150 census and protection=false are asserted; rejected earlier Scene Lab setups are not used.'
 else:
  clause='actual metro resident view below minimum20 visible occupants';values=[]
  for r in data['rows']:
   ss=[s for s in r['samples'] if s['l5'] and s['l5']['metroAt']]
   values.append({'tier':r['tier'],'stationCount':len(ss[0]['l5']['stationIds']),'samples':[{'tick':s['tick'],'phase':s['l5']['phase'],'submittedStationFigures':len(s['figures']),'drawnStationFigures':sum(f['drawn'] for f in s['figures'])}for s in ss],'maximumSubmitted':max(len(s['figures'])for s in ss)})
  assert all(v['maximumSubmitted']<20 for v in values)
  note='Both corrected100low/150high mortal renderer runs complete through actual shutter closure. During each intended3s resident-view sequence the renderer submits at most19 of24 station identities, so at most19 can be visible (minimum20). Reviewed every metro-second capture: camera stays at exterior stairs/canopy with courier, dog and a small follower group; no20–30-resident interior look appears, then L6 loads. The physical routes show the same exterior framing. This closes FAIL through resident visibility; no unconditional PASS for continuous crossing, body-overlap or end-camera clauses.'
elif row=='L6-12':
 path=Path('docs/reports/sweep-b/L6-northgate.json');data=load(path);values=data['rows'];clause='closed Northgate remains passable above misplaced blocker'
 assert all(v['gateAt'] and v['open']['crossed'] and v['closed']['crossed'] and v['closed']['movement']['x']>5.9 for v in values)
 extra=['docs/reports/sweep-b/L6-render-initial-review.json']
 note='Both tiers: actual production Northgate closure creates a slab spanning worldy0–2.5m while the supported exit body centre is4.62m. The production Rapier player capsule traverses the full requested6m across x258 both before and after actual gate closure. The native fixture retains every original29-person identity; production controller, not a test-spawned leaf, creates the gate. Reviewed browser frames draw its closed leaf and the Night. Still alive caption, confirming a visual/collision mismatch. Capsule computation bypasses cinematic input locking only. This counterexample closes FAIL; end-camera and full-route result clauses are not promoted to PASS.'
else:raise ValueError(row)
proof=Path(f'docs/reports/sweep-b/{row}-proof.json');proof.write_text(json.dumps({'row':row,'status':status,'sourceHash':data['sourceHash'],'producerSha256':sha(__file__),'ledger':str(path),'ledgerSha256':sha(path),'observation':note,'rows':values},indent=2)+'\n')
for value in values:
 tier=value['tier'];p=Path(f'docs/reports/fix51-verify/receipts/{level}-{tier}-webgl2-z1.5-browser.json');r=json.loads(p.read_text());assert r['sourceHash']==data['sourceHash']
 r['checks']=[c for c in r['checks'] if c['id']!=row];r['checks'].append({'id':row,'clause':clause,'tier':tier,'policy':'controlled-fixture','status':status,'value':value,'target':note,'receipt':str(proof)});p.write_text(json.dumps(r,indent=2)+'\n')
criterion=next(r['expected'] for r in load(f'docs/reports/fix51-verify/{level}.json')['rows'] if r['id']==row)
Path(f'docs/qa/reviews/{row}.json').write_text(json.dumps({'row':row,'status':status,'reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':status,'note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note}for p in [proof,path,*map(Path,extra)]]},indent=2)+'\n')
print(row,status)
