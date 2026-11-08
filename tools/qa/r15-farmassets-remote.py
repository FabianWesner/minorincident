"""Browser-free lane gate on the shared runner, with a reviewable snapshot and receipts."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tarfile
import time

if os.environ.get('MI_REMOTE') != '1':
    raise SystemExit('Run with tools/remote/run.sh')
report=Path('docs/reports/r15-farmassets')
report.mkdir(parents=True,exist_ok=True)
with tarfile.open('.r15-farmassets-input.tar.gz','r:gz') as archive:
    for entry in archive:
        if not entry.isfile():
            continue
        path=Path(entry.name)
        if '..' in path.parts or not any(entry.name.startswith(f'.cache/r15-farmassets/{name}/') for name in ['baseline','unfolded']):
            raise SystemExit('Invalid native input path')
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(archive.extractfile(entry).read())
receipt=dict(host=socket.gethostname(),checks=[])
sources=['tools/blender/build_l10_farm.py','tools/blender/sslib/farm_assets.py',
         'src/assets/manifest.json','src/levels/L10/farmLayout.ts','src/render/Corn.ts',
         'src/assets/DistrictAssets.ts','tools/assets/pack-l10-farm.ts']
receipt['sourceSha256']={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sources}
checks=[('pack',['node','--import','tsx/esm','tools/assets/pack-l10-farm.ts','--report',str(report)]),
        ('farm-assets-native',['node','--import','tsx/esm','tools/qa/r15-farmassets.ts']),
        ('E32-gate',['npm','run','verify','--','E32'])]
for name,command in checks:
    if name=='E32-gate':
        Path('.git/index').unlink(missing_ok=True)
        subprocess.run(['git','add','-f','--pathspec-from-file=.mi-manifest','--pathspec-file-nul'],check=True)
        subprocess.run(['git','-c','user.name=Remote validation','-c','user.email=runner@example.invalid',
                        '-c','core.hooksPath=/dev/null','commit','--allow-empty','-qm','r15 farm asset validation snapshot'],check=True)
        receipt['snapshot']=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
    started=time.monotonic()
    print(f'[farm-assets] {name} starting',flush=True)
    with (report/f'{name}.log').open('w') as log:
        result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
    text=(report/f'{name}.log').read_text()
    receipt['checks'].append(dict(name=name,command=command,exitCode=result.returncode,
        seconds=round(time.monotonic()-started,2),outputTail='\n'.join(text.splitlines()[-35:])))
    (report/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(f'[farm-assets] {name} exit={result.returncode}',flush=True)
if Path('test-results/epics/E32/checks.json').exists():
    shutil.copyfile('test-results/epics/E32/checks.json',report/'E32-checks.json')
raise SystemExit(0 if all(r['exitCode']==0 for r in receipt['checks']) else 1)
