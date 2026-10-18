"""Build the measured red inventory; never infer an unrun main outcome."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
def plain(s): return re.sub(r'\x1b\[[0-9;]*m','',s)
def key(title):
 m=re.search(r'T-E\d+-[A-Za-z0-9.-]+',title)
 
 if m and m.group()=='T-E28-10-frame':
  tier=re.search(r'storm-street (high|low)',title)
  return m.group()+'-'+(tier.group(1) if tier else 'unknown')
 return m.group() if m else ('E24-PO35-side-entries' if 'tunnel entries telegraph' in title else title)
def log_tests(path,mark):
 if not path.exists(): return []
 return [re.sub(r'\s+\d+(?:\.\d+)?ms$','',m.group(1)).strip() for m in re.finditer(r'^\s*'+mark+r'\s+(.+)$',plain(path.read_text()),re.M)]
main={}; red={}
for name in ['main-isolated.json','main-newbie.json']:
 p=root/'evidence'/name
 if not p.exists():continue
 d=json.loads(p.read_text())
 for suite in d.get('testResults',[]):
  for t in suite.get('assertionResults',[]):
   if t.get('status') in ['passed','failed']:main[key(t.get('fullName',t.get('title','')))]=('Yes' if t['status']=='failed' else 'No',str(p.relative_to(root)))
for name in ['remote-main-side-entry','remote-main-functional-control','remote-main-campaign-control','remote-main-extra','remote-main-timing-extra']:
 p=root/'evidence'/(name+'.log')
 for mark,result in [('✓','No'),('×','Yes')]:
  for title in log_tests(p,mark):
   k=key(title)
   if k.startswith('T-E') or k=='E24-PO35-side-entries': main[k]=(result,str(p.relative_to(root)))

def specs(s):
 for child in s.get('suites',[]):yield from specs(child)
 yield from s.get('specs',[])
for rel in ['evidence/browser-main-controls-playwright.json','perf/main-weather/playwright.json']:
 p=root/rel
 if not p.exists():continue
 for spec in specs(json.loads(p.read_text())):
  statuses=[t.get('status') for t in spec.get('tests',[])]
  if 'unexpected' in statuses:main[key(spec['title'])]=('Yes',rel)
  elif 'expected' in statuses:main[key(spec['title'])]=('No',rel)

for name in ['remote-pair1','remote-pair2','verify-E24','verify-E26-retry','verify-E30','verify-E32','remote-candidate-isolated']:
 p=root/'evidence'/(name+'.log')
 for title in log_tests(p,'×'):
  k=key(title);row=red.setdefault(k,{'test':k,'title':title,'observedIn':[]})
  if str(p.relative_to(root)) not in row['observedIn']:row['observedIn'].append(str(p.relative_to(root)))
# Native and E30 functional browser results have separate per-command JSON files.
def specs(s):
 for child in s.get('suites',[]):yield from specs(child)
 yield from s.get('specs',[])
for rel in ['perf/final/playwright.json','evidence/E30-isolated-retry-playwright.json']:
 p=root/rel
 if not p.exists():continue
 for spec in specs(json.loads(p.read_text())):
  if any(t.get('status')=='unexpected' for t in spec.get('tests',[])):
   k=key(spec['title']);red[k]={'test':k,'title':spec['title'],'observedIn':[rel]}
for tier in ['high','low']:
 k=f'wave3-zoo-routines@{tier}-z1.5-webgl2'
 red[k]={'test':k,'title':'Wide zoo actor clipping: 2 > 0','observedIn':['evidence/matrix-final-webgl2.log']}
 main[k]=('Yes','evidence/main-zoo-catalog.log')
for k,row in red.items():
 result,evidence=main.get(k,('Unmeasured',''))
 row['redOnMain']=result;row['mainEvidence']=evidence
out=sorted(red.values(),key=lambda r:r['test']);(root/'red-tests.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'{len(out)} observed red test IDs; {sum(r["redOnMain"]=="Unmeasured" for r in out)} main controls pending')
for r in out:print(r['test']+': main '+r['redOnMain'])
