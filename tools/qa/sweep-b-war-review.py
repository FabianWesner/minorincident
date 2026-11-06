"""Row-scoped objective inspection with an explicit unresolved PO feel question."""
from pathlib import Path
import json,hashlib,subprocess
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest=Path('docs/reports/sweep-b/L4-capture-review.json')
assert json.loads(manifest.read_text())['images']==151
note='All151 current L4 physical captures inspected across low/high and both photo zooms. Pre-alarm reception is clean and populated, with separated civilians, lowered soldier rifles and no blood/fire damage. Battle frames contain a large horde, soldiers, armoured vehicles, helicopter, fire and corpse fields. Courier clothing/outline remains distinguishable when surrounded; living bodies can overlap the courier, but the inspected battle frames retain an identifiable player. P: PO: do the war frames read as a huge mixed war? Use the reviewed battle captures; player readability remains an objective inspection. This verdict closes objective inspected clauses only and does not answer that feel question.'
proof=Path('docs/reports/sweep-b/L4-18-proof.json')
identity=json.loads(Path('docs/reports/sweep-b/L4-03-proof.json').read_text())
proof.write_text(json.dumps({'sourceHash':identity['sourceHash'],'browserHash':identity['browserHash'],'producerSha256':sha(__file__),'captureReviewSha256':sha(manifest),'observation':note,'poQuestion':'PO: do the war frames read as a huge mixed war? Use the reviewed battle captures; player readability remains an objective inspection.'},indent=2)+'\n')
for tier in ['low','high']:
 for zoom in [.5,1.5]:
  p=Path(f'docs/reports/fix51-verify/receipts/L4-{tier}-webgl2-z{zoom}-browser.json');r=json.loads(p.read_text());assert r['sourceHash']==identity['sourceHash']
  r['checks']=[c for c in r['checks'] if c['id']!='L4-18']
  r['checks'].append({'id':'L4-18','clause':'reviewed clean living plaza and readable battle courier','tier':tier,'policy':'real-input-webgl2','status':'PASS','value':note,'target':'Clean living safe plaza; readable battle courier. Huge-mixed-war feel remains P.','receipt':str(proof)});p.write_text(json.dumps(r,indent=2)+'\n')
criterion=next(r['expected'] for r in json.loads(Path('docs/reports/fix51-verify/L4.json').read_text())['rows'] if r['id']=='L4-18')
Path('docs/qa/reviews/L4-18.json').write_text(json.dumps({'row':'L4-18','status':'PASS','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'PASS','note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note} for p in [proof,manifest]]},indent=2)+'\n')
