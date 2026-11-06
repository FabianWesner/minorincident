"""Publish matched camera geometry and separate the PO atmosphere question."""
from pathlib import Path
import json,gzip,hashlib,subprocess
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
path=Path('docs/reports/sweep-b/pairs-ledger.json.gz');data=json.loads(gzip.decompress(path.read_bytes()));values=[]
for tier in ['low','high']:
 pairs=[]
 for spot in ['pair-plaza','pair-harbor-street','pair-metro-entrance','pair-kessler-lane']:
  pair=[r for r in data['rows']if r['tier']==tier and r['spot']==spot];assert len(pair)==2
  # The executed producer accidentally overwrote its level label with an
  # undefined snapshot field. The actual recorded lighting preset and file
  # suffix independently identify the two levels; no game state is invented.
  assert {r['lighting']['preset']for r in pair}=={'L4','L5'}
  assert all(r['file'].endswith(r['lighting']['preset']+'.jpg') and r['renderTier']==tier for r in pair)
  assert pair[0]['camera']['position']==pair[1]['camera']['position'] and pair[0]['camera']['target']==pair[1]['camera']['target']
  pairs.append({'spot':spot,'pose':pair[0]['camera'],'levels':[r['lighting']['preset']for r in pair]})
 render=json.loads(gzip.decompress(Path('docs/reports/sweep-b/L5-render-ledger.json.gz').read_bytes()));r=next(r for r in render['rows']if r['tier']==tier);ss=[s for s in r['samples']if s['l5']];initial=ss[0]['lighting']['intensity'];end=ss[-1]['lighting']['intensity'];assert end/initial<=.7
 values.append({'tier':tier,'pairs':pairs,'initialRenderedSunIntensity':initial,'endRenderedSunIntensity':end,'renderedReduction':1-end/initial,'endSimMultiplier':ss[-1]['l5']['gloom']})
note='All16 current matched-camera captures inspected: four authored L4/L5 camera pairs at both tiers have exactly equal positions/targets and1280x720 framing. Same plaza/convoy arrangement, Harbor cafe, Metro sign/frontage and Kessler fence/tree/block remain identifiable; L5 adds shattered facades, wrecks, bodies and fog. Heavy plaza fog is disclosed. Actual L5 renderer sun drops from0.816 to0.44965 (44.90%) by metro/end, exceeding30%; sim end multiplier0.5. P: PO: do matched L4/L5 views read as the same place, fallen? Sun intensity reduction remains a numeric clause. No taste verdict is claimed. Native named photo-preset lookup was unavailable, so the existing authored offsets were applied as explicit identical cinematic poses.'
proof=Path('docs/reports/sweep-b/L5-14-proof.json');proof.write_text(json.dumps({'sourceHash':data['sourceHash'],'producerSha256':sha(__file__),'ledgerSha256':sha(path),'observation':note,'rows':values},indent=2)+'\n')
for value in values:
 tier=value['tier'];p=Path(f'docs/reports/fix51-verify/receipts/L5-{tier}-webgl2-z1.5-browser.json');r=json.loads(p.read_text());r['checks']=[c for c in r['checks']if c['id']!='L5-14'];r['checks'].append({'id':'L5-14','clause':'reviewed four exact matched L4 L5 camera pairs','tier':tier,'policy':'controlled-fixture','status':'PASS','value':value,'target':'Same authored city geometry and matched camera pairs; sun reduction≥30%; atmosphere comparison remains P','receipt':str(proof)});p.write_text(json.dumps(r,indent=2)+'\n')
criterion=next(r['expected']for r in json.loads(Path('docs/reports/fix51-verify/L5.json').read_text())['rows']if r['id']=='L5-14')
Path('docs/qa/reviews/L5-14.json').write_text(json.dumps({'row':'L5-14','status':'PASS','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'PASS','note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note}for p in [proof,path,Path('docs/reports/sweep-b/pairs-capture-review.json'),Path('docs/reports/sweep-b/L5-render-ledger.json.gz')]]},indent=2)+'\n')
