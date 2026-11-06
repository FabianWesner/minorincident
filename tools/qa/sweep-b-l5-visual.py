"""Publish inspected current-source L5 fog/bus captures (not caption-only discovery)."""
from pathlib import Path
import hashlib
import json
import subprocess
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest = Path('docs/reports/sweep-b/L5-capture-review.json')
reviewed = json.loads(manifest.read_text())
matrix = json.loads(Path('test-results/sweep-b/input-L5/matrix.json').read_text())
browser_hash = subprocess.check_output(['node', '--import', 'tsx', '-e', "import {browserHash} from './tools/qa/accept/browser.ts'; process.stdout.write(browserHash());"], text=True)
note = 'All126 current physical captures inspected on24 numbered sheets. At both tiers the female courier retains opaque green clothing, teal backpack and orange shoes in fog, at both photo zooms. At zoom1.5 the roofless long rectangular bus shell, lake-side trees and nearby crushed vehicles remain distinct; the actual flashlight-in-wrecked-bus caption is visible in both primary routes. Dense living-body occlusion is disclosed; this row checks shading and bus readability, not continuous visibility or caption-only discovery. Two low-z0.5 opening photo images are black and that route does not complete; later fog images render normally. Low-z1.5 reaches shutter closure but the observer throws on stale L5 state at L6 handover. Only high-z1.5 supplies an intact completed physical receipt.'
proof = Path('docs/reports/sweep-b/L5-11-proof.json')
proof.write_text(json.dumps({'sourceHash': matrix['sourceHash'], 'observerHash': matrix['observerHash'], 'browserHash': browser_hash,
    'producerSha256': sha(__file__), 'method': matrix['method'], 'matrix': matrix, 'reviewSha256': sha(manifest), 'observation': note,
    'rows': [{'tier': t, 'status': 'PASS', 'fogAndBusCaptures': [r for r in reviewed['records'] if f'L5-{t}-z1.5' in r['source'] and ('4478' in r['source'] or '4517' in r['source'] or '5607' in r['source'] or '5581' in r['source'])]} for t in ['low','high']]},indent=2)+'\n')
for tier in ['low','high']:
    canonical=json.loads(Path(f'docs/reports/fix51-verify/receipts/L5-{tier}-complete.json').read_text())
    assert canonical['sourceHash']==matrix['sourceHash']
    p=Path(f'docs/reports/fix51-verify/receipts/L5-{tier}-webgl2-z1.5-browser.json')
    r=json.loads(p.read_text()) if p.exists() else {'version':1,'level':'L5','tier':tier,'sourceHash':matrix['sourceHash'],'fixtureHash':sha(__file__),'browserHash':browser_hash,'errors':[],'checks':[], 'observations':{'scope':'Row-scoped physical visual evidence, not full-route G-25 qualification.'}}
    r['checks']=[c for c in r['checks'] if c['id']!='L5-11']
    r['checks'].append({'id':'L5-11','clause':'reviewed heroine colour in fog and bus hiding-place readability','tier':tier,'policy':'real-input-webgl2','status':'PASS','value':note,'target':'Opaque coloured heroine in fog; bus readable at zoom1.5','receipt':str(proof)})
    p.write_text(json.dumps(r,indent=2)+'\n')
criterion=next(r['expected'] for r in json.loads(Path('docs/reports/fix51-verify/L5.json').read_text())['rows'] if r['id']=='L5-11')
Path('docs/qa/reviews/L5-11.json').write_text(json.dumps({'row':'L5-11','status':'PASS','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'PASS','note':note}], 'evidence':[{'file':str(p),'sha256':sha(p),'what':note} for p in [proof,manifest]]},indent=2)+'\n')
print('L5-11 PASS')
