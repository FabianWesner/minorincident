"""Replay the eight zero-manual builds and compare every shipped body/pose byte."""
import hashlib,json,os,subprocess
from pathlib import Path
OUT=Path('docs/reports/l5-all-new')
IDS=json.loads((OUT/'census.json').read_text())['scope']
def snapshot():
 files=[]
 for ident in IDS:
  files += list(Path('public/assets/models/skinned').glob(ident+'.lod*.glb'))
  files += [Path('assets')/ident/'model.skin.glb']
 bakes=json.loads(Path('src/assets/civilianBakes.json').read_text())
 files += [Path('public'+path) for key,path in bakes.items() if key.split(':')[0] in IDS]
 return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set(files))}
before=snapshot()
for ident in IDS:
 source=json.loads((OUT/'builds'/ident/'build.json').read_text())['source']
 with (OUT/'gates'/f'rebuild-{ident}.log').open('w') as log:
  subprocess.run(['sh','tools/assets/skin-crowd-build.sh',source],env={**os.environ,'CROWD_REPORT':str(OUT/'builds')},stdout=log,stderr=subprocess.STDOUT,check=True)
after=snapshot()
changed=[p for p in sorted(set(before)|set(after)) if before.get(p)!=after.get(p)]
(OUT/'game-rebuild-proof.json').write_text(json.dumps({'pass':not changed,'identities':IDS,'manualSteps':[],'comparedFiles':len(after),'changed':changed,'sha256':after},indent=2)+'\n')
assert not changed,changed
print('Byte-identical replay:',len(after),'bodies and poses')
