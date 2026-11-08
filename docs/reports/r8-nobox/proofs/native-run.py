from pathlib import Path
import subprocess, os, json, hashlib, shutil
root=Path('test-results/r8-nobox/native'); root.mkdir(parents=True,exist_ok=True)
files={'src/sim/world/SolidRegistry.ts':'SolidRegistry.before.ts','src/sim/ai/CharacterSeparation.ts':'CharacterSeparation.before.ts'}
saved={p:Path(p).read_bytes() for p in files}
identity={p:{'before':hashlib.sha256((Path('.r8-nobox-inputs')/b).read_bytes()).hexdigest(),'after':hashlib.sha256(saved[p]).hexdigest()} for p,b in files.items()}
(root/'source-identity.json').write_text(json.dumps(identity,indent=2))
commands=[]
def run(label):
 cmd=['npm','run','qa:threat','--','--levels','L1,L2,L4,L5,L6,L7,L8','--maxWorkers','4','--out',str(root/label)]
 env=dict(os.environ,QA_THREAT_REVISION='ac0a9e26' if label=='before' else 'bde97d0b')
 with (root/(label+'.log')).open('w') as log:r=subprocess.run(cmd,env=env,stdout=log,stderr=subprocess.STDOUT)
 commands.append({'label':label,'command':cmd,'exit':r.returncode}); (root/'commands.json').write_text(json.dumps(commands,indent=2));print(label,'exit',r.returncode,flush=True)
try:
 for p,b in files.items():Path(p).write_bytes((Path('.r8-nobox-inputs')/b).read_bytes())
 run('before')
finally:
 for p,data in saved.items():Path(p).write_bytes(data)
run('after')
b=json.loads((root/'before/audit.json').read_text());a=json.loads((root/'after/audit.json').read_text())
comparison={'newFlags':sorted(set(a['flags'])-set(b['flags'])),'removedFlags':sorted(set(b['flags'])-set(a['flags'])),'levels':[]}
for after in a['levels']:
 before=next(l for l in b['levels'] if l['level']==after['level'])
 row={'level':after['level'],'beforeFlags':before['flags'],'afterFlags':after['flags'],'beforePassiveFlags':before['passiveFlags'],'afterPassiveFlags':after['passiveFlags'],'newFlags':sorted(set(after['flags']+after['passiveFlags'])-set(before['flags']+before['passiveFlags'])),'beforeHash':before['nativeStateHash'],'afterHash':after['nativeStateHash'],'completed':after['run']['completed']}
 if after['level']=='L4':row['sameNativeHash']=before['nativeStateHash']==after['nativeStateHash'];row['samePassiveRun']=before['passiveRun']==after['passiveRun'];row['sameHighHold']=before['highHold']==after['highHold']
 comparison['levels'].append(row)
(root/'comparison.json').write_text(json.dumps(comparison,indent=2)); shutil.copy2(__file__,root/'run.py')
print(json.dumps(comparison),flush=True)
raise SystemExit(int(bool(comparison['newFlags']) or any(l['newFlags'] for l in comparison['levels'])))
