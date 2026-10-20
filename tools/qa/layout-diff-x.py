#!/usr/bin/env python3
"""world-fill: placements and colliders that differ between two layouts at x >= <x> (the calibrated L10 finale band).
usage: layout-diff-x.py <before.json> <after.json> <x>"""
import json, sys
a, b, x0 = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), float(sys.argv[3])
key = lambda p: (p['assetId'], round(p['position'][0], 2), round(p['position'][2], 2), round(p['yaw'], 3))
A = {key(p) for p in a['placements'] if p['position'][0] >= x0}; B = {key(p) for p in b['placements'] if p['position'][0] >= x0}
print('placements before', len(A), 'after', len(B), 'only before', len(A - B), 'only after', len(B - A))
for k in sorted(A - B)[:10]: print('  -', k)
for k in sorted(B - A)[:10]: print('  +', k)
box = lambda c: tuple(round(v, 2) for v in c['aabb']['min'] + c['aabb']['max'])
ca = {box(c) for c in a['colliders'] if c['aabb']['min'][0] >= x0 - 5}; cb = {box(c) for c in b['colliders'] if c['aabb']['min'][0] >= x0 - 5}
print('colliders before', len(ca), 'after', len(cb), 'only before', len(ca - cb), 'only after', len(cb - ca))
