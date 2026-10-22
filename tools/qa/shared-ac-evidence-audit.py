from pathlib import Path
import json,gzip,hashlib,re
root=Path('docs/reports/ac-close-shared');ev=root/'evidence';d=json.loads((ev/'final-source.json').read_text())
for path,digest in {**d['sha256'],**d['supplementalDiagnostics']}.items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest,path
for path,c in d['unchangedMeasurementContracts'].items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==c['sha256'],path
for p in ev.glob('*.json.gz'):json.loads(gzip.decompress(p.read_bytes()))
moves=json.loads(gzip.decompress((ev/'move-boundaries.json.gz').read_bytes()));assert len(moves)==14 and sum(len(m['captures']) for m in moves)==168
assert all(len(m['proof'])==11 and len(m['captures'])==12 and not m['consoleErrors'] for m in moves)
bars=json.loads(gzip.decompress((ev/'phone-bars-final.json.gz').read_bytes()));assert len(bars['proofs'])==7 and len(bars['images'])==58
assert len([p for p in root.rglob('*') if p.suffix.lower() in ['.png','.jpg','.jpeg','.webm','.mp4']])==12
for doc in [root/'README.md',Path('docs/reports/verify-sweep/ACs.md'),Path('docs/reports/verify-sweep/README.md')]:
 for target in re.findall(r'\]\(([^)]+)\)',doc.read_text()):
  if '://' not in target and not target.startswith('#'):assert (doc.parent/target.split('#')[0]).exists(),(str(doc),target)
s=json.loads(Path('specs/status.json').read_text());assert [s[e] for e in ['E07','E27','E28']]==['in-progress','done','in-progress']
for epic,stem in [('E07','verify-E07-final'),('E27','verify-E27-headwear-final'),('E28','verify-E28-headwear-final')]:
 c=json.loads((ev/(stem+'-checks.json')).read_text())['checks']
 assert len(c)==(6 if epic=='E07' else 5) and all(x['exitCode']==0 for x in c),(epic,c)
c=json.loads((ev/'verify-E07-object-failure-checks.json').read_text())['checks'];assert c[-1]['exitCode']==1 and all(x['exitCode']==0 for x in c[:-1])
print('PASS: source/diagnostic hashes; unchanged threshold hashes; all lossless JSON; 14 move journals/154 tick records/168 capture hashes; 7 phone proofs/58 hashes; 12 media; current report links; honest statuses; all three final verifiers green; preserved red exits. Git-base equivalence checked locally because remote snapshots exclude Git history.')
