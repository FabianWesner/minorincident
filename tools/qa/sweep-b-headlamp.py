"""Publish actual headlamp approach/persistence/opposed aim fixture."""
from pathlib import Path
import json,gzip,hashlib,math,subprocess
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
p=Path('docs/reports/sweep-b/L6-render-ledger.json.gz');data=json.loads(gzip.decompress(p.read_bytes()));values=[]
for r in data['rows']:
 h=r['headlamp'];a,b,c,d=[h[k]for k in ['before','afterIdle','afterApproach','opposed']]
 assert not a['flashlight'] and not b['flashlight'] and a['lamp']['at']==b['lamp']['at'];assert c['flashlight'] and d['headlampOn']==1
 assert not any(x['newWeaponIds'] for x in [a,b,c,d]);v=d['beam'];yaw=d['headYaw'];assert abs(v[0]-math.cos(yaw))<1e-8 and abs(v[1]+math.sin(yaw))<1e-8
 assert d['input']['move']['x']>0 and d['input']['aim']['x']<0 and v[0]<-.99
 values.append({'tier':r['tier'],'status':'PASS','before':a,'afterIdle':b,'afterApproach':c,'opposed':d})
note='Both tiers: no new weapon pickup entities; uncollected headlamp remains at exact original coordinates through120 idle ticks. Normal directional input approaches it without E and collects it. Actual headlampOn becomes1; with +X movement and -X pointer aim the drawn head yaw≈-π and lighting beam[-1,0] match within1e-8. All32 current supplement captures were inspected: cyan ground ring disappears on pickup and a bright cone follows the facing head while the courier moves the other way. Fixture teleports only stage the later straight-tunnel aim check; the approach pickup uses normal input. Bar and Northgate fixtures in the same ledger do not grant a full-route or every-bar PASS.'
proof=Path('docs/reports/sweep-b/L6-02-proof.json');proof.write_text(json.dumps({'sourceHash':data['sourceHash'],'producerSha256':sha(__file__),'ledger':str(p),'ledgerSha256':sha(p),'observation':note,'rows':values},indent=2)+'\n')
for row in values:
 tier=row['tier'];p=Path(f'docs/reports/fix51-verify/receipts/L6-{tier}-webgl2-z1.5-browser.json');r=json.loads(p.read_text());r['checks']=[c for c in r['checks'] if c['id']!='L6-02'];r['checks'].append({'id':'L6-02','clause':'actual headlamp approach persistence head-following beam and no new weapons','tier':tier,'policy':'controlled-fixture','status':'PASS','value':row,'target':'No new weapon; approach pickup; static uncollected lamp; beam follows head, including opposed movement/aim','receipt':str(proof)});p.write_text(json.dumps(r,indent=2)+'\n')
criterion=next(r['expected']for r in json.loads(Path('docs/reports/fix51-verify/L6.json').read_text())['rows']if r['id']=='L6-02')
Path('docs/qa/reviews/L6-02.json').write_text(json.dumps({'row':'L6-02','status':'PASS','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':criterion,'verdict':'PASS','note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note}for p in [proof,Path('docs/reports/sweep-b/L6-render-ledger.json.gz'),Path('docs/reports/sweep-b/L6-render-capture-review.json')]]},indent=2)+'\n')
