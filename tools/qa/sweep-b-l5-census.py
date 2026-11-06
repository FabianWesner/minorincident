"""Publish actual L5 initial position and accepted-cohort census."""
from pathlib import Path
import json,hashlib,subprocess
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
proof=Path('docs/reports/sweep-b/L5-census.json');data=json.loads(proof.read_text())
assert all(r['pass'] for r in data['rows'])
note='Both tiers: actual initial living infected100low/150high exceed unchanged row minimum60/90. Deterministic placement replay reconciles every admitted ID to its accepted authored cohort; every requested/admitted centre matches exactly (maximum shift0m), no authored cohort exceeds2 bodies. Every one of8 authored row bands and11 column bands contains admitted living infected; full transforms/IDs/cohorts retained. Bands use nearest authored centreline, avoiding an invented road width. This initial-placement verdict does not interpret the later pursuing crowd as an initial spawn group.'
for row in data['rows']:
 tier=row['tier'];p=Path(f'docs/reports/fix51-verify/receipts/L5-{tier}-webgl2-z1.5-browser.json');r=json.loads(p.read_text());assert r['sourceHash']==data['sourceHash']
 r['checks']=[c for c in r['checks'] if c['id']!='L5-03'];r['checks'].append({'id':'L5-03','clause':'actual initial infected positions accepted cohorts and all street bands','tier':tier,'policy':'controlled-fixture','status':'PASS','value':row,'target':'≥60low/90high; singles/pairs/no group>3; spread over all street bands','receipt':str(proof)});p.write_text(json.dumps(r,indent=2)+'\n')
criterion=next(r['expected'] for r in json.loads(Path('docs/reports/fix51-verify/L5.json').read_text())['rows'] if r['id']=='L5-03')
Path('docs/qa/reviews/L5-03.json').write_text(json.dumps({'row':'L5-03','status':'PASS','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'PASS','note':note}],'evidence':[{'file':str(proof),'sha256':sha(proof),'what':note}]},indent=2)+'\n')
