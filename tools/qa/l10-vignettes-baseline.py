"""Isolate a native completion failure by omitting only the new vignette layer.
Run in the remote runner's disposable workspace; production files are restored.
"""
import argparse
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--revision', required=True)
args = parser.parse_args()
if os.environ.get('MI_REMOTE') != '1':
    raise SystemExit('Use tools/remote/run.sh with Mac fallback disabled.')
path = Path('src/levels/decor.ts')
original = path.read_text()
line = 'const vignettes = cureVignettes([...placements, ...belt, ...stories, ...forecourts]);'
if original.count(line) != 1:
    raise SystemExit('Unexpected decor integration; refuse to change the comparison.')
try:
    path.write_text(original.replace(line, 'const vignettes: Placement[] = [];'))
    code = '''
import { mkdirSync, writeFileSync } from 'node:fs';
import { probeLevel, provenance } from './tools/qa/accept/probe.ts';
const receipt = await probeLevel('L10','low','complete',provenance(process.argv[1]));
const comparison = { omitted: 'cureVignettes only', sourceCommit: process.argv[1], receipt };
mkdirSync('docs/reports/eg-l10-vignettes/evidence',{recursive:true});
writeFileSync('docs/reports/eg-l10-vignettes/evidence/without-vignettes-low-complete.json',JSON.stringify(comparison,null,2)+'\\n');
console.log(JSON.stringify({ outcome:receipt.run?.outcome, blocker:receipt.run?.blocker, deaths:receipt.run?.deaths, charge:receipt.observation?.charge }));
'''
    subprocess.run(['node','--import','tsx/esm','--input-type=module','-e',code,args.revision],check=True)
finally:
    path.write_text(original)
