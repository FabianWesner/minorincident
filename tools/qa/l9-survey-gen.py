#!/usr/bin/env python3
"""Generate a Scene Lab route-survey spec for D-CROSSING: a game camera stepped along a route.
usage: [SHOTS=1] l9-survey-gen.py <route|all> <step_m> <zoom> <out.json> [sheet_every]
One frame (plus 3 settle frames) per station; stations are every <step_m> metres along the authored route."""
import json, math, sys, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
routes = json.load(open(os.path.join(root, 'layouts/D-CROSSING/routes.json')))['routes']
which, step, zoom, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
sheet = int(sys.argv[5]) if len(sys.argv) > 5 else 1
base = json.load(open(os.path.join(root, 'specs/scenes/catalog/qa-l9-fork-dry.json')))
for k in ('vehicles', 'trace'): base.pop(k, None)
stations = []
for r in routes:
    if which not in ('all', r['id']): continue
    p = r['points']; carry = 0.0
    for a, b in zip(p, p[1:]):
        d = math.dist(a, b); s = carry
        while s <= d:
            stations.append([a[0] + (b[0]-a[0])*s/d, a[1] + (b[1]-a[1])*s/d]); s += step
        carry = s - d
stations.append(routes[0]['points'][-1])
per = 4
base['name'] = f'l9-survey-{which}-z{zoom}'
base['layout']['bbox'] = [[-600, -400], [600, 400]]
base['camera'] = {'mode': 'game', 'target': [round(stations[0][0], 1), round(stations[0][1], 1)], 'zoom': zoom}
base['script'] = [{'frame': i*per, 'camera': {'mode': 'game', 'target': [round(s[0], 1), round(s[1], 1)], 'zoom': zoom}} for i, s in enumerate(stations)]
base['frames'] = len(stations) * per
base['sheet'] = per * sheet
if os.environ.get('SHOTS'): base['shots'] = [i * per + per - 1 for i in range(len(stations))]
base['expect'] = {'consoleErrors': 0}
json.dump(base, open(out, 'w'), indent=1)
print(len(stations), 'stations')
