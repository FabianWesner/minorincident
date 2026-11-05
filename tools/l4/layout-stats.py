"""Prints placement counts and anchors of the built D-FAIR layout (authoring check): python3 tools/l4/layout-stats.py"""
import json
from collections import Counter
d = json.load(open('public/assets/layouts/D-FAIR.layout.json'))
print(Counter(p['assetId'] for p in d['placements']).most_common(40))
print(len(d['placements']), 'placements', len(d['colliders']), 'colliders', len([a for a in d['anchors'] if a.startswith('refuge')]), 'refuge doors')
print({k: [round(c, 1) for c in v['position']] for k, v in d['anchors'].items() if not k.startswith('refuge')})
