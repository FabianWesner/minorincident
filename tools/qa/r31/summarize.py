"""r31-zombie-audit: one row per audited type from the Scene Lab metrics (clip frames per phase, foot slide, outcome).

python3 tools/qa/r31/summarize.py test-results/scenes [out.json]
Phases (see gen_specs.py): idle 0-119, chase/attack 120-419, hits 420-779 (MG 420, bat 510, kick 600), death 780-1080.
"""
import json, sys, pathlib, collections

root = pathlib.Path(sys.argv[1])
rows = {}
for d in sorted(root.glob('r31-*')):
    f = d / 'metrics.json'
    if not f.exists():
        continue
    m = json.load(open(f))
    a = m['metrics']['actors'].get('z')
    if not a:
        continue
    phases = {'idle': (0, 119), 'chase': (120, 419), 'hits': (420, 779), 'death': (780, 1080)}
    clips = {k: collections.Counter() for k in phases}
    for s in a.get('track', []):
        for k, (f0, f1) in phases.items():
            if f0 <= s['frame'] <= f1:
                clips[k][s.get('clip') or s.get('label') or '-'] += 1
    mo = a.get('motion', {})
    rows[d.name] = {
        'tier': m.get('actualTier'), 'backend': m.get('backend'),
        'model': next((s['appearance']['model'] for s in a.get('track', []) if s.get('appearance')), None),
        'health': a.get('health'), 'state': a.get('state'), 'firstDrawn': (a.get('firstDrawn') or {}).get('frame'),
        'slideMaxCm': mo.get('slideMaxCm'), 'slideP95Cm': mo.get('slideP95Cm'), 'torsoPitch': [mo.get('torsoPitchMinDeg'), mo.get('torsoPitchMaxDeg')],
        'clips': {k: dict(v.most_common()) for k, v in clips.items()},
        'specials': m['metrics'].get('specials'),
        'bodies': m['metrics'].get('bodies'), 'attackOverlap': m['metrics'].get('attackOverlap'),
    }
out = json.dumps(rows, indent=1)
if len(sys.argv) > 2:
    pathlib.Path(sys.argv[2]).write_text(out)
for k, r in rows.items():
    print(k, r['model'], 'hp', r['health'], r['state'], 'slide', r['slideMaxCm'], r['slideP95Cm'], 'bodies', json.dumps(r['bodies'])[:160], 'atk', json.dumps(r['attackOverlap'])[:160])
    for p, c in r['clips'].items():
        print('   ', p, c)
