"""Build the measured red inventory; never infer an unrun main outcome."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
def plain(s): return re.sub(r'\x1b\[[0-9;]*m','',s)
def key(title):
 m=re.search(r'T-E\d+-[A-Za-z0-9.-]+',title)
 
 if m and m.group()=='T-E24-08':
  policy=re.search(r'continuous (complete|newbie)',title)
  return m.group()+'-'+(policy.group(1) if policy else 'unknown')
 if m and m.group()=='T-E28-10-frame':
  tier=re.search(r'storm-street (high|low)',title)
  return m.group()+'-'+(tier.group(1) if tier else 'unknown')
 return m.group() if m else ('E24-PO35-side-entries' if 'tunnel entries telegraph' in title else title)
def log_tests(path,mark):
 if not path.exists(): return []
 return [re.sub(r'\s+\d+(?:\.\d+)?ms$','',m.group(1)).strip() for m in re.finditer(r'^\s*'+mark+r'\s+(.+)$',plain(path.read_text()),re.M)]
main={}; red={}
for name in ['main-isolated.json','main-newbie.json','main-extra-vitest.json','main-timing-extra-vitest.json']:
 p=root/'evidence'/name
 if not p.exists():continue
 d=json.loads(p.read_text())
 for suite in d.get('testResults',[]):
  for t in suite.get('assertionResults',[]):
   if t.get('status') in ['passed','failed']:main[key(t.get('fullName',t.get('title','')))]=('Yes' if t['status']=='failed' else 'No',str(p.relative_to(root)))
for name in ['remote-main-side-entry','remote-main-functional-control','remote-main-campaign-control','remote-main-extra','remote-main-timing-extra','remote-main-l6-complete-control']:
 p=root/'evidence'/(name+'.log')
 for mark,result in [('✓','No'),('×','Yes')]:
  for title in log_tests(p,mark):
   k=key(title)
   if k.startswith('T-E') or k=='E24-PO35-side-entries': main[k]=(result,str(p.relative_to(root)))

def specs(s):
 for child in s.get('suites',[]):yield from specs(child)
 yield from s.get('specs',[])
def browser_key(spec,test): return spec['title']+' ['+test.get('projectName','unknown')+']'
for rel in ['evidence/browser-main-controls-playwright.json','perf/main-weather/playwright.json','evidence/main-E26-playwright.json','evidence/PO34-original-main-playwright.json']:
 p=root/rel
 if not p.exists():continue
 for spec in specs(json.loads(p.read_text())):
  for test in spec.get('tests',[]):
   if test.get('status') in ['unexpected','expected']:
    main[browser_key(spec,test)]=('Yes' if test['status']=='unexpected' else 'No',rel)

for name in ['remote-pair1','remote-pair2','verify-E24','verify-E26-retry','verify-E30','verify-E32','remote-candidate-isolated']:
 p=root/'evidence'/(name+'.log')
 for title in log_tests(p,'×'):
  k=key(title);row=red.setdefault(k,{'test':k,'title':title,'observedIn':[]})
  if str(p.relative_to(root)) not in row['observedIn']:row['observedIn'].append(str(p.relative_to(root)))
# Keep browser projects and parameterized titles separate, including resolved execution failures.
for rel in ['perf/final/playwright.json','evidence/E30-isolated-retry-playwright.json','evidence/E30-initial-playwright.json','evidence/E26-initial-playwright.json','evidence/ui-night-final-playwright.json','evidence/E24-remaining-playwright.json','evidence/full-gate-browser-interrupted-playwright.json']:
 p=root/rel
 if not p.exists():continue
 for spec in specs(json.loads(p.read_text())):
  for test in spec.get('tests',[]):
   if test.get('status') not in ['unexpected','flaky']:continue
   k=browser_key(spec,test);row=red.setdefault(k,{'test':k,'id':key(spec['title']),'title':spec['title'],'project':test.get('projectName'),'observedIn':[]})
   if rel not in row['observedIn']:row['observedIn'].append(rel)
   if rel=='evidence/E26-initial-playwright.json':row['hadPreviewCrashFailure']=True
passing={}
for rel in ['evidence/E30-isolated-retry-playwright.json','evidence/ui-staging-final-playwright.json','evidence/full-gate-smoke-playwright.json','evidence/PO34-final-playwright.json']:
 p=root/rel
 if not p.exists():continue
 for spec in specs(json.loads(p.read_text())):
  for test in spec.get('tests',[]):
   if test.get('status')=='expected':passing.setdefault(browser_key(spec,test),[]).append(rel)
for name in ['remote-pair2','verify-E24','remote-candidate-isolated']:
 rel='evidence/'+name+'.log'
 for title in log_tests(root/rel,'✓'):passing.setdefault(key(title),[]).append(rel)

for rel in ['evidence/pair1-vitest.json','evidence/pair2-vitest.json','evidence/candidate-isolated-vitest.json','evidence/E24-verify-vitest.json']:
 p=root/rel
 if not p.exists():continue
 for suite in json.loads(p.read_text()).get('testResults',[]):
  for test in suite.get('assertionResults',[]):
   title=test.get('fullName',test.get('title',''));k=key(title)
   if test.get('status')=='failed':
    row=red.setdefault(k,{'test':k,'title':title,'observedIn':[]})
    if rel not in row['observedIn']:row['observedIn'].append(rel)
    row['failureSummary']=plain(str(test.get('failureMessages',[''])[0]))[:240]
   elif test.get('status')=='passed' and rel!='evidence/pair1-vitest.json':passing.setdefault(k,[]).append(rel)

for tier in ['high','low']:
 k=f'wave3-zoo-routines@{tier}-z1.5-webgl2'
 red[k]={'test':k,'title':'Two hand/held-prop grip intersections: 2 > 0','observedIn':['evidence/matrix-final-webgl2.log']}
 main[k]=('Yes','evidence/main-zoo-catalog.log')
matrix_main={}
p=root/'matrix/main-zoo-webgpu/index.json'
if p.exists():
 for row in json.loads(p.read_text()).get('rows',[]):matrix_main[row['name']]=('No' if row['pass'] else 'Yes','matrix/main-zoo-webgpu/index.json')
for p in (root/'matrix/full-gate-failed').glob('*/metrics.json'):
 d=json.loads(p.read_text())
 if d['checks']['pass']:continue
 k=p.parent.name+'-webgpu';red[k]={'test':k,'title':'Full gate matrix: '+p.parent.name,'observedIn':[str(p.relative_to(root))]}
 if p.parent.name in matrix_main:main[k]=matrix_main[p.parent.name]
red['manual-phone-gate-HUD-overlap']={'test':'manual-phone-gate-HUD-overlap','title':'Gate prompt/roster/objective overlap in phone portrait','observedIn':['evidence/ui-final/l6-gate-390x844-f81-z1.png','sheets/phone-gate-overlap-main-control.jpg']}
main['manual-phone-gate-HUD-overlap']=('Yes','sheets/phone-gate-overlap-main-control.jpg')
# A failed isolated rerun is not erased by an earlier full-suite pass.
p=root/'evidence/candidate-isolated-vitest.json'
if p.exists():
 for suite in json.loads(p.read_text()).get('testResults',[]):
  for test in suite.get('assertionResults',[]):
   if test.get('status')=='failed':passing.pop(key(test.get('fullName',test.get('title',''))),None)
for k,row in red.items():
 if k=='T-E24-02':row['passingRerunEvidence']=['evidence/remote-pair2.log','evidence/verify-E24.log']
 if k in passing:row['passingRerunEvidence']=passing[k]
 result,evidence=main.get(k,('Unmeasured',''))
 row['redOnMain']=result;row['mainEvidence']=evidence
out=sorted(red.values(),key=lambda r:r['test']);(root/'red-tests.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'{len(out)} observed red test IDs; {sum(r["redOnMain"]=="Unmeasured" for r in out)} main controls pending')
for r in out:print(r['test']+': main '+r['redOnMain'])
