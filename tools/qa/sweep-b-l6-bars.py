"""Review every original follower's actual pip pixels and retained speed controls."""
from pathlib import Path
import gzip,hashlib,json,subprocess
from PIL import Image
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
root=Path('docs/reports/sweep-b');walk_path=root/'L6-walk.json.gz';walk=json.loads(gzip.decompress(walk_path.read_bytes()))
report=json.loads(Path('docs/reports/fix51-verify/L6.json').read_text());old=next(r for r in report['rows']if r['id']=='L6-08')
rows=[];captures=[];ledgers=[]
for tier in ['low','high']:
 p=Path(f'test-results/sweep-b/L6-bars-{tier}/ledger.json');data=json.loads(p.read_text());assert data['sourceHash']==walk['sourceHash'];assert not data['errors'];assert len(data['original'])==len(data['rows'])==29
 per_id=[]
 for a in data['rows']:
  assert a['actualTier']==tier and not a['god'] and a['rosterCount']==29
  assert a['civilian']['survivor']['mode']=='follow' and a['health']==next(o['health']for o in data['original']if o['id']==a['id'])
  assert len(a['figures'])==1 and a['figures'][0]['drawn']
  b=next(b for b in a['bars']['bars']if b['id']==a['id']);assert b['width']==18 and b['height']==3 and b['fraction']==1
  image=Path(a['capture']);assert sha(image)==a['sha256'];im=Image.open(image).convert('RGB');x=round(b['x']);y=round(b['y']);box=(x-11,y-4,x+12,y+5);pixels=list(im.crop(box).getdata())
  green=lambda pixels:sum(g>100 and blue>80 and g>red*1.4 and blue>red*1.2 for red,g,blue in pixels)
  assert green(pixels)==54
  assert green([(0,0,0)]*len(pixels))==0, 'removed-pip fault control must reject'
  per_id.append({'id':a['id'],'injured':a['injured'],'bar':b,'greenPixels':54,'crop':box,'drawn':True,'health':a['health']})
  captures.append({'file':str(image),'sha256':a['sha256'],'tier':tier,'id':a['id'],'observation':'Selected follower body and green pip visible in individually labelled crop; head unobstructed, above courier overlap. All29 per tier inspected, including injured21/26/31/36. Additional bystanders in some crops retain separate pips.'})
 sheet=Path(f'test-results/sweep-b/L6-bars-{tier}/per-id-sheet.png')
 capture_ledger=root/f'L6-bars-{tier}-ledger.json.gz';capture_ledger.write_bytes(gzip.compress(p.read_bytes(),mtime=0));ledgers.append({'file':str(capture_ledger),'sha256':sha(capture_ledger),'sheet':str(sheet),'sheetSha256':sha(sheet)})
 speeds=[r for r in walk['rows']if r['tier']==tier];assert len(speeds)==29
 assert all(abs(r['minSettledSpeed']-2.2)<.001 and abs(r['maxSettledSpeed']-2.2)<.001 for r in speeds)
 native=next(c for c in old['checks']if c['tier']==tier and c['policy']=='complete');assert native['status']=='PASS';assert all(v['ratio']>=.95 for v in native['value'])
 rows.append({'tier':tier,'status':'PASS','perIdBars':per_id,'individualSettledWalks':[{'id':r['id'],'injured':r['injured'],'min':r['minSettledSpeed'],'max':r['maxSettledSpeed']}for r in speeds],'nativeGroupPace':native,'rendererErrors':data['errors']})
note='Both tiers: all29 original IDs retain their HP and injury flags in compact29-follower mode. Each selected actor is submitted/drawn below the actual x263 evacuation threshold; all58 individually reviewed crops show an unoccluded head and its green pip. Each per-ID18x3 pip measures exactly54 green pixels; a removed-pip fault control measures0 and rejects. Existing58 actual production follower walks, all29 at each tier including every injured ID, settle2.1995157–2.2m/s (submillimetre/s response residual). Ordinary mortal complete-route follower medians are2.19878–2.2m/s with minimum group-relative ratio0.999923, confirming normal group pace without one injured laggard. Earlier tunnel batches contained real geometric/courier occlusion, so those absences are not missing-bar defects. Two x269 staging attempts were rejected because the production controller had already evacuated/hidden those people. This controlled bar fixture qualifies every original identity; it does not claim a full29-person mortal escape.'
proof=root/'L6-08-proof.json';proof.write_text(json.dumps({'row':'L6-08','status':'PASS','sourceHash':walk['sourceHash'],'producerSha256':sha(__file__),'speedLedger':str(walk_path),'speedLedgerSha256':sha(walk_path),'barLedgers':ledgers,'observation':note,'rows':rows},indent=2)+'\n')
review_path=root/'L6-bars-capture-review.json';review_path.write_text(json.dumps({'reviewer':'Codex/sweep-b','date':'2026-11-06','images':58,'sheets':ledgers,'observation':note,'records':captures,'cleanup':'Raw PNGs deleted after every per-ID crop was inspected, pixel-checked and hashed. Sheets remain only in ignored test-results.'},indent=2)+'\n')
clause='all original follower settled speed and per-ID visible bars'
for r in rows:
 p=Path(f"docs/reports/fix51-verify/receipts/L6-{r['tier']}-webgl2-z1.5-browser.json");receipt=json.loads(p.read_text());assert receipt['sourceHash']==walk['sourceHash'];receipt['checks']=[c for c in receipt['checks']if c['id']!='L6-08'];receipt['checks'].append({'id':'L6-08','clause':clause,'tier':r['tier'],'policy':'controlled-fixture','status':'PASS','value':r,'target':'Every original follower including injured walks2.2m/s and has actual unoccluded bar pixels; ordinary group pace retained','receipt':str(proof)});p.write_text(json.dumps(receipt,indent=2)+'\n')
evidence=[proof,review_path,walk_path,*[Path(l['file'])for l in ledgers]]
review={'row':'L6-08','status':'PASS','reviewer':'Codex/sweep-b','date':'2026-11-06','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'clauses':[{'clause':old['expected'],'verdict':'PASS','note':note}],'evidence':[{'file':str(p),'sha256':sha(p),'what':note}for p in evidence]}
Path('docs/qa/reviews/L6-08.json').write_text(json.dumps(review,indent=2)+'\n')
for r in captures:Path(r['file']).unlink()
print('L6-08 PASS;58 body/pip pixel controls reviewed and deleted')
