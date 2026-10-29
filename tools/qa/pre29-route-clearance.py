"""Conservative new-collider clearance against every baseline L8/L10 road.

Usage: python3 tools/qa/pre29-route-clearance.py <baseline-root> <output.json>
"""
import json
import math
import sys
from pathlib import Path


def point_segment(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dz * dz
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2)) if length2 else 0
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)


def segment_box(a, b, lo, hi):
    # Slab intersection first; otherwise the closest points include a segment
    # endpoint or a rectangle corner.
    start, end = 0., 1.
    intersects = True
    for axis in range(2):
        delta = b[axis] - a[axis]
        if delta == 0:
            if not lo[axis] <= a[axis] <= hi[axis]:
                intersects = False
                break
        else:
            near, far = sorted(((lo[axis] - a[axis]) / delta, (hi[axis] - a[axis]) / delta))
            start, end = max(start, near), min(end, far)
            if start > end:
                intersects = False
                break
    if intersects:
        return 0.
    endpoints = [math.hypot(max(lo[0] - p[0], p[0] - hi[0], 0), max(lo[1] - p[1], p[1] - hi[1], 0)) for p in (a, b)]
    corners = [point_segment((x, z), a, b) for x in (lo[0], hi[0]) for z in (lo[1], hi[1])]
    return min(endpoints + corners)


rows = []
for district in ('D-ZOO', 'D-CURE'):
    relative = Path(f'public/assets/layouts/{district}.layout.json')
    baseline = json.loads((Path(sys.argv[1]) / relative).read_text())
    current = json.loads(relative.read_text())
    known = {json.dumps(c['aabb'], sort_keys=True) for c in baseline['colliders']}
    added = [c for c in current['colliders'] if json.dumps(c['aabb'], sort_keys=True) not in known]
    overlaps, closest = [], None
    for collider in added:
        bounds = collider['aabb']
        lo, hi = [bounds['min'][i] for i in (0, 2)], [bounds['max'][i] for i in (0, 2)]
        for edge in baseline['roads']['edges']:
            for a, b in zip(edge['points'], edge['points'][1:]):
                clearance = segment_box(a, b, lo, hi) - edge['laneWidth'] / 2
                item = dict(collider=collider['id'], road=edge['id'], clearanceM=clearance)
                if closest is None or clearance < closest['clearanceM']:
                    closest = item
                if clearance < .45:
                    overlaps.append(item)
    row = dict(district=district, baselineColliderCount=len(baseline['colliders']), currentColliderCount=len(current['colliders']),
               addedOrChangedColliderAABBs=len(added), roadsIdentical=baseline['roads'] == current['roads'],
               walkableIdentical=baseline['walkable'] == current['walkable'], anchorsIdentical=baseline['anchors'] == current['anchors'],
               courierRadiusM=.45, closest=closest, overlaps=overlaps)
    rows.append(row)
result = dict(method='Every added/changed collider AABB versus every original road segment, subtracting half lane width and requiring another 0.45 m for the courier. All tiers and physicsOnly boxes included conservatively.', rows=rows)
Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
assert all(r['roadsIdentical'] and r['walkableIdentical'] and r['anchorsIdentical'] and not r['overlaps'] for r in rows)
