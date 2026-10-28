"""Condense the final matched L5 runtime matrix without treating shared-host timing as a quiet perf gate."""
import hashlib,json
from pathlib import Path
ROOT=Path('test-results/l5-all-new');OUT=Path('docs/reports/l5-all-new')
CONFIGS=['high-webgl2','high-webgpu','low-webgl2','low-webgpu']
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
crowd=[];states=[];stories=[];warm=[]
for config in CONFIGS:
 pair={}
 for variant in ['old','new']:
  folder=ROOT/f'crowd-{variant}-{config}';d=read(folder/'receipt.json');m=d['metrics'];r=d['resources'];cadence=read(folder/'cadence.json')
  assert d['result']['pass'] and not d['errors'];assert len(m['actors'])==30
  assert cadence['cadence']['over200']==0 and not cadence['cadence']['builds']
  pair[variant]={'revision':d['revision'],'drawsP95':m['perf']['drawCalls']['p95'],'trianglesP95':m['perf']['triangles']['p95'],'decodedTextureBytes':r['decodedBytes'],'rgbaUpperBoundBytes':r['rgbaUpperBoundBytes'],'textureCount':r['textureCount'],'actors':len(m['actors']),'heldProps':r['heldProps'],'sourceReceiptSha256':sha(folder/'receipt.json')}
  warm.append({'config':config,'variant':variant,'hostLoad':cadence['hostLoad'],**{k:v for k,v in cadence['cadence'].items() if k!='perf'}})
 crowd.append({'config':config,**pair,'deltaDecodedBytes':pair['new']['decodedTextureBytes']-pair['old']['decodedTextureBytes']})
 folder=ROOT/f'states-new-{config}';proof=read(folder/'state-proof.json');assert sum(e['corpse'] for e in proof)==8;d=read(folder/'receipt.json');assert d['result']['pass'] and not d['errors'];held=d['resources']['heldProps'];assert len(held)==3 and all(p['prop']=='cane' for p in held);states.append({'config':config,'revision':d['revision'],'pass':True,'actors':len(d['metrics']['actors']),'proof':proof,'heldProps':held,'sourceReceiptSha256':sha(folder/'receipt.json')})
 folder=ROOT/f'story-new-{config}';rows=read(folder/'receipts.json');assert len(rows)==13 and all(r['pass'] for r in rows)
 stories.extend({'config':config,'file':r['file'],'scene':r['name'],'pass':r['pass'],'failed':r['failed']} for r in rows)
(OUT/'performance.json').write_text(json.dumps({'scope':'Matched 30-figure L5 D-FAIR plaza street, same renderer code, camera and actors; old assets pinned to c0dc2ff43. Scene Lab preloads the catalog. Decoded bytes count bound 2D texture payload/mips, excluding render targets/background; not isolated production memory or download size.','baselineAssets':'c0dc2ff43','timingStatus':'PERF PENDING: shared host. PO quiet-window gate remains low p95 <= main +1ms and worst five cold loads <= PROD *1.10. RAF samples are refresh-capped diagnostics.','crowd':crowd,'warmCadence':warm},indent=2)+'\n')
(OUT/'runtime-checks.json').write_text(json.dumps({'scriptedSceneChecks':len(stories),'scriptedScenes':stories,'bodyStateConfigurations':states,'warmFrames':sum(w['count'] for w in warm),'lateShaderBuilds':0,'framesOver200ms':0,'maxFrameMs':max(w['max'] for w in warm),'allCrowdActorsSubmitted':True},indent=2)+'\n')
print('Runtime receipts:',len(stories),'scripted checks;',sum(w['count'] for w in warm),'warm frames')
