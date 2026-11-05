"""Reject incomplete trapped-crowd and same-tick camera matrices."""
import copy,gzip,json
from pathlib import Path
root=Path('docs/reports/sweep-a2');native=json.loads(gzip.decompress((root/'L2-05-native.json.gz').read_bytes()));browser=json.load(open('test-results/sweep-a2/market-panic/receipt.json'))
def qualifies(n,b):
 return n['sourceHash']==b['sourceHash'] and len(n['runs'])==2 and sorted(r['tier'] for r in n['runs'])==['high','low'] and all(r['closedTicks']==240 and r['identities']==r['expected'] and r['minExposed']==r['expected'] and r['minInside']==r['expected'] and r['firstOutSeconds'] is not None and 0<=r['firstOutSeconds']<=1 for r in n['runs']) and len(b['rows'])==12 and all(len([r for r in b['rows'] if r['quality']==tier and r['backend']==backend])==3 for tier in ['low','high'] for backend in ['webgl','webgpu']) and all(len(r['actors'])==r['expected'] and all(not a['hidden'] and not a.get('pending') and a['drawn'] for a in r['actors']) and len(r['captures'])==3 and {c['inspectionScale'] for c in r['captures']}=={None,.5,1.5} and all(c['camera']['tick']==r['tick'] for c in r['captures']) for r in b['rows'])
controls=[]
def reject(name,n,b):controls.append({'test':name,'pass':not qualifies(n,b)})
n=copy.deepcopy(native);n['runs'].pop();reject('missing native quality',n,browser)
n=copy.deepcopy(native);n['runs'][0]['minExposed']-=1;reject('one hidden civilian',n,browser)
n=copy.deepcopy(native);n['runs'][0]['firstOutSeconds']=1.01;reject('late first exit',n,browser)
b=copy.deepcopy(browser);b['rows']=b['rows'][:6];reject('missing renderer',native,b)
b=copy.deepcopy(browser);b['rows'][0]['captures'].pop();reject('missing inspection view',native,b)
b=copy.deepcopy(browser);b['rows'][0]['captures'][0]['camera']['tick']+=1;reject('camera sample changes simulation tick',native,b)
b=copy.deepcopy(browser);b['sourceHash']='0'*64;reject('mixed source',native,b)
assert qualifies(native,browser) and all(c['pass'] for c in controls)
(root/'L2-05-current-proof.json').write_text(json.dumps({'sourceHash':native['sourceHash'],'observerHash':native['observerHash'],'revision':native['revision'],'nativeSummaries':[{k:v for k,v in r.items() if k!='frames'} for r in native['runs']],'matrix':[{'tier':r['quality'],'backend':r['backend'],'tick':r['tick'],'actors':len(r['actors']),'drawn':sum(a['drawn'] for a in r['actors']),'clips':sorted({a['clip'] for a in r['actors']}),'inspectionScales':[c['inspectionScale'] for c in r['captures']]} for r in browser['rows']],'controls':controls,'pass':True,'method':'Every native closed-door tick/whole-body first exit, plus12 same-tick renderer/quality camera cells. Default production framing and explicitly separate camera-only close/wide inspection; no unlocked gameplay zoom claim. Drawn flags sampled after screenshotReady, unlike between-render story diagnostics.'},indent=2)+'\n');print('Seven trapped-crowd rejection controls pass')
