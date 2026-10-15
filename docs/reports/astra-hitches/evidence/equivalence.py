"""Compare every recorded gameplay field; wall-clock measurements remain separate."""
import hashlib, json, pathlib
root=pathlib.Path('test-results/astra-hitches')
out=pathlib.Path('docs/reports/astra-hitches/evidence'); rows=[]
for tier in ['high','low']:
 before=json.loads((root/'before'/f'{tier}.json').read_text())
 after=json.loads((root/'after'/f'{tier}.json').read_text())
 a,b=before['result'],after['result']
 changed=[key for key in sorted(a.keys()|b.keys()) if key not in a or key not in b or a[key]!=b[key]]
 digest=lambda value: hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 rows.append(dict(tier=tier,equal=not changed,changed=changed,beforeSha256=digest(a),afterSha256=digest(b),beforeProfiledWallSeconds=before['wallSeconds'],afterWallSeconds=after['wallSeconds'],under90Seconds=after['wallSeconds']<90,comparedFields=sorted(a)))
 for label,record in [('before',before),('after',after)]:
  (out/f'calibration-{label}-{tier}.json').write_text(json.dumps(record,indent=2)+'\n')
report=dict(note='Baseline includes V8 sampling overhead; optimized wall timings do not. Compare all recorded gameplay fields, with no tolerance or omissions.',rows=rows)
(out/'equivalence.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
assert all(row['equal'] and row['beforeSha256']==row['afterSha256'] and row['under90Seconds'] for row in rows)
