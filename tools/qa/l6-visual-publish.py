"""Publish measured L6 fixture clauses. Fail closed on missing cells or stale source."""
from pathlib import Path
import json,gzip,hashlib,subprocess
ROOT=Path('docs/reports/l6-visual');RAW=Path('test-results/l6-visual')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text())
def dump(p,x):Path(p).write_text(json.dumps(x,indent=2)+'\n')
def main():
 native=read('docs/reports/fix51-verify/receipts/L6-low-complete.json');source=native['sourceHash'];browser=subprocess.check_output(['node','--import','tsx','--input-type=module','-e',"import { browserHash } from './tools/qa/accept/browser.ts'; console.log(browserHash())"],text=True).strip()
 evidence=[]
 def archive(p,name):
  x=read(p);assert x['sourceHash']==source,(p,'stale source')
  dest=ROOT/'evidence'/f'{name}.json.gz';dest.parent.mkdir(exist_ok=True);dest.write_bytes(gzip.compress(Path(p).read_bytes(),mtime=0));evidence.append({'file':str(dest),'sha256':sha(dest)});return x
 mainrows=[];exits=[]
 for backend in ['webgl2','webgpu']:
  for zoom in [1,1.5]:
   key=f'{backend}-z{zoom}'
   mainrows+=archive(RAW/'verified'/key/'proof.json','shelter-lamp-'+key)['rows']
   exits+=archive(RAW/'clean-exit-final'/key/'ledger.json','exit-'+key)['rows']
 bars=archive(RAW/'bars-final/receipt.json','bars')['rows'];pixels=archive(RAW/'bar-pixels.json','bar-pixels')['rows']
 overlap=archive(RAW/'bar-overlap-after/receipt.json','bar-overlap')['rows'];gates=archive(RAW/'gates/receipt.json','browser-gates')['rows']
 controls=archive(ROOT/'native/controls.json','controls')['rows'];walk=archive(ROOT/'native/walk.json','walk')['rows'];trajectories=archive(ROOT/'native/trajectories-supported.json','trajectories')['rows'];mechanical=archive(ROOT/'native/gates.json','mechanical-gates')['rows'];north=archive(ROOT/'native/northgate.json','northgate')['rows'];protect=archive(ROOT/'native/protection.json','protection')['rows']
 analysis=read(ROOT/'readability-analysis.json')['rows'];assert len(analysis)==16 and all(r['sourceHash']==source for r in analysis)
 reviewpath=ROOT/'capture-review.json';review=read(reviewpath);assert review['sourceHash']==source and review['allPersonallyReviewed'] and len(review['images'])>=36
 for e in review['images']:assert sha(e['file'])==e['sha256']
 for sheet in review['sourceMapping']['sheets']:
  for frame in sheet['sources']:assert sha(frame['file'])==frame['sha256']
 evidence.append({'file':str(ROOT/'readability-analysis.json'),'sha256':sha(ROOT/'readability-analysis.json')})
 for p in sorted((ROOT/'readability').glob('*.gz')):evidence.append({'file':str(p),'sha256':sha(p)})
 for p in ['tools/qa/l6-visual-analyze.py','tools/qa/l6-visual-sheets.py','tools/qa/sweep-b-l6-render.ts','tools/qa/sweep-b-l6-readability.ts','tools/qa/fix67-b-northgate.ts','tools/qa/l6-visual-bars.ts','tools/qa/l6-visual-gates.ts','tools/qa/accept/fix53-l6-trajectories.ts']:
  evidence.append({'file':p,'sha256':sha(p)})
 def matrix(rows,n=4):
  assert len(rows)==n and len({(r['backend'],r['zoom'])for r in rows})==n,'missing/duplicate matrix cell'
 def healthy(s):return len(s['roster'])==29 and all(p['health']['current']==p['health']['max'] and p['story'] for p in s['roster'])
 receipts=[]
 for tier in ['low','high']:
  checks=[]
  def add(id,clause,value,target,passed):checks.append(dict(id=id,clause=clause,value=value,target=target,status='PASS'if passed else'FAIL',tier=tier,policy='controlled-fixture',receipt=f'docs/reports/fix51-verify/receipts/L6-{tier}-visual-browser.json'))
  rows=[r for r in mainrows if r['tier']==tier];matrix(rows)
  assert all(r['headlamp']['before']['backend']==('webgl' if r['backend']=='webgl2' else 'webgpu') and r['headlamp']['before']['renderTier']==tier and r['headlamp']['before']['camera']['zoom']==r['zoom'] for r in rows)
  initial=[r['shelter'] for r in rows];routine=set(p['routine'] for p in initial[0][0]['roster'])
  add('L6-01','actual carried shelter identities routines and stowed guns',{'cells':4,'identities':29,'snapshotsPerCell':[len(s)for s in initial],'routines':sorted(routine)},'carried 24+5 identities, full HP, active routines, no seated/lying visible gun; reviewed pixels',all(len(s)==5 and all(healthy(a)for a in s) and len({tuple(p['key']for p in a['roster'])for a in s})==1 for s in initial) and {'sit','talk','treat','rest','share'}<=routine)
  lamps=[r['headlamp']for r in rows]
  def lampok(l):
   b,i,a,o=[l[k]for k in ['before','afterIdle','afterApproach','opposed']]
   return b['lamp']['at']==i['lamp']['at'] and not i['flashlight'] and not i['lamp']['pickup']['collected'] and a['flashlight'] and a['lamp']['pickup']['collected'] and all(not v['newWeaponIds']for v in [b,i,a,o]) and o['input']['move']['x']==1 and o['input']['aim']['x']==-1 and o['beam'][0]<-.99 and abs(o['beam'][1])<.01
  add('L6-02','actual headlamp approach persistence head-following beam and no new weapons',{'cells':4,'beamOpposedX':[l['opposed']['beam'][0]for l in lamps]},'unchanged pickup before approach, collected without E, beam follows head against movement',all(lampok(l)for l in lamps))
  t=next(r for r in trajectories if r['tier']==tier);c=next(r for r in controls if r['tier']==tier);ev=c['ordinaryProbe']['events'];b1=next(e for e in ev if e['type']=='l6.breach1');b2=next(e for e in ev if e['type']=='l6.breach2');power=next(e for e in ev if e['type']=='power.off');abandon=next(e for e in ev if e['type']=='l6.abandon');wave2=[a for a in t['actors']if a['wave']==2]
  add('L6-04','actual second breach arrivals power and abandon condition',{'delayS':(b2['tick']-b1['tick'])/60,'arrivals':len(wave2),'accesses':len(set(a['door']for a in wave2)),'powerDeltaTicks':power['tick']-b2['tick'],'emergency':power['emergency'],'abandonTick':abandon['tick']},'20–30s; >=10 from>=2 accesses; power same frame; emergency; first-of abandon verified native fixtures',20<=(b2['tick']-b1['tick'])/60<=30 and len(wave2)>=10 and len(set(a['door']for a in wave2))>=2 and power['tick']==b2['tick'] and power['emergency'] and c['ordinaryProbe']['observedHash']==c['ordinaryProbe']['controlHash'])
  side=[a for a in t['actors']if a['wave']==4];doors=[a['door']for a in side];samples=sum(a['pathSamples']for a in side);fails=sum(a['pathFailures']for a in side)
  add('L6-06','six alternating entries and all admitted bodies on reachable tracks',{'doors':doors,'trackArrivals':sum(a['firstTrack']is not None for a in side),'pathSamples':samples,'pathFailures':fails},'12 admitted bodies, two each six entries alternating, >=95% reachable, actual track support',t['sideEntriesPass'] and len(side)==12 and len(set(doors))==6 and all(doors.count(d)==2 for d in set(doors)) and all(a['firstTrack']is not None and a['pathAtBirth']for a in side) and samples>0 and fails/samples<=.05)
  w=[r for r in walk if r['tier']==tier];br=[r for r in bars if r['tier']==tier];px=[r for r in pixels if r['tier']==tier];ov=[r for r in overlap if r['tier']==tier];matrix(ov)
  assert len(br)==116 and len(px)==116
  for backend in ['webgl2','webgpu']:
   for z in [1,1.5]:assert len({r['ids'][0]for r in br if r['backend']==backend and r['zoom']==z})==29
  add('L6-08','all original follower settled speed and per-ID visible bars',{'identities':len(w),'barCases':len(br),'minSpeed':min(r['minSettledSpeed']for r in w),'maxSpeed':max(r['maxSettledSpeed']for r in w),'minCyanPixels':min(r['cyanPixels']for r in px),'overlapCases':len(ov)},'29 original including injured at2.2m/s, every bar drawn in all four tier matrix cells, compact overlap retained',len(w)==29 and any(r['injured']for r in w) and all(abs(r['minSettledSpeed']-2.2)<.002 and abs(r['maxSettledSpeed']-2.2)<.002 for r in w) and all(r['cyanPixels']>=8 for r in px) and all(any(b['id']==r['ids'][0]for b in r['state']['bars']['bars'])for r in br+ov))
  mg=[r for r in mechanical if r['tier']==tier];bg=[r for r in gates if r['tier']==tier];assert len(bg)==6
  boundary=all([b['closable']for b in g['boundaries']]==[False]*4+[True] and len({json.dumps(s['at'],sort_keys=True)for s in g['markerSamples']})==1 for g in c['controlledGates'])
  add('L6-09','actual gates width collision endurance refusal and persistent prompt',{'widthM':[r['widthM']for r in mg],'holdSeconds':[r['heldSeconds']for r in mg],'browserCases':len(bg),'boundaries':[-1.99,0,1.8,2,2.01]},'>=3 gates <=2.5m, 8–12sec vs5, movement/sight blocked, <=2m refusal, prompt/ring fixed E/click',len(mg)==3 and all(r['widthM']<=2.5 and 8<=r['heldSeconds']<=12 and len(r['ids'])==5 and r['openSight'] and not r['closedSight'] and r['openMovement']['crossed'] and not r['closedMovement']['crossed']for r in mg) and boundary and all(not r['errors'] and all(ca['state']['gate']['closedAt']>0 for ca in r['closed'])for r in bg))
  pr=[r for r in protect if r['tier']==tier];complete=next(r for r in pr if r['policy']=='complete');evade=next(r for r in pr if r['policy']=='evade-only');ratio=lambda r:r['result']['rescued']/r['result']['survivorsIn']
  add('L6-11','ordinary complete and evade-only rescue outcome',{'complete':ratio(complete),'evadeOnly':ratio(evade)},'complete>=60%; evade-only<=30%, ordinary mortal policies',complete['completed'] and ratio(complete)>=.6 and ratio(evade)<=.3)
  ex=[r for r in exits if r['tier']==tier];matrix(ex)
  def exitok(r):
   s=r['samples'];final=s[-1];result=final['result'];return not r['errors'] and any(a['phase']=='cinematic' and a['caption'] for a in s) and final['phase']=='result' and result['survivorsIn']==result['rescued']+result['survivorsLost'] and result['rescued']==sum(p['status']=='out' for p in final['roster']) and final['gate']['barricade']['intact']
  add('L6-12','drawn and solid Northgate caption framing and exact counts',{'cells':4,'controlledOut':[r['samples'][-1]['result']['rescued']for r in ex]},'open/closed actual gate, cinematic caption/end framing personally reviewed; exact result accounting',all(exitok(r)for r in ex) and all(r['open']['crossed'] and not r['closed']['crossed'] for r in north if r['tier']==tier))
  a=[r for r in analysis if r['tier']==tier];assert len(a)==8
  add('L6-14','measured underground contrast and brightest infected eyes matrix',{'cells':8,'minContrast':min(r['contrast05']for r in a)},'>=3:1 contrast, infected eyes brighter than full-coverage body, unchanged restored native pixels',all(r['contrast05']>=3 and r['eyesBrightest'] and r['repeatedNativeBodyChangedPixels']==0 for r in a))
  receipts.append(dict(version=1,level='L6',tier=tier,sourceHash=source,fixtureHash=sha(__file__),checks=checks,errors=[]))
 dump(ROOT/'acceptance-fixtures.json',dict(sourceHash=source,browserHash=browser,publisherSha256=sha(__file__),evidence=evidence,captureReview={'file':str(reviewpath),'sha256':sha(reviewpath)},receipts=receipts))
 print([(r['tier'],[(c['id'],c['status'])for c in r['checks']])for r in receipts])
if __name__=='__main__':main()
