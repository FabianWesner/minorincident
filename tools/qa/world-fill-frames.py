#!/usr/bin/env python3
"""world-fill (PO #34): how often the zoom-1 game camera frame holds roadside mass, from the layout alone.
usage: world-fill-frames.py <layout.json> <routes.json> <half-width> [route-id] [zoom=1]
Every 2 m along the route the frame is the ground window of the game camera (camera from +x+z: screen right (dx-dz)/sqrt2 within
+-7.5 m * zoom, depth (dx+dz)/sqrt2 within +-6 m * zoom). A station counts as filled when at least one placement footprint taller
than 0.5 m (no decals) intersects the window outside the lane (> half-width + 0.5 m from the centre line). Prints the filled share
per route line and the mean placements per frame."""
import json, math, sys
lay = json.load(open(sys.argv[1])); routes = json.load(open(sys.argv[2])); half = float(sys.argv[3])
rid = sys.argv[4] if len(sys.argv) > 4 else None; zoom = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
lines = [r['route'] for r in routes['regions']] if 'regions' in routes else [r['points'] for r in routes['routes'] if r['id'] == rid]
boxes = [(p['visualAabb']['min'][0], p['visualAabb']['min'][2], p['visualAabb']['max'][0], p['visualAabb']['max'][2]) for p in lay['placements'] if p['visualAabb']['max'][1] > .5]
W, D, S = 7.5 * zoom, 6 * zoom, math.sqrt(.5)
grid = {}
for i, b in enumerate(boxes):
    for gx in range(int(b[0] // 20), int(b[2] // 20) + 1):
        for gz in range(int(b[1] // 20), int(b[3] // 20) + 1): grid.setdefault((gx, gz), []).append(b)
def seen(x, z, b, nx, nz):
    # sample the footprint on a 0.5 m lattice: inside the window and off the lane
    for i in range(5):
        for j in range(5):
            px, pz = b[0] + (b[2] - b[0]) * i / 4, b[1] + (b[3] - b[1]) * j / 4
            dx, dz = px - x, pz - z
            if abs((dx - dz) * S) <= W and abs((dx + dz) * S) <= D and abs(dx * nx + dz * nz) > half + .5: return True
    return False
tot = []
for li, line in enumerate(lines):
    rows = []
    for a, b in zip(line, line[1:]):
        d = math.dist(a, b)
        if d < 1: continue
        nx, nz = -(b[1] - a[1]) / d, (b[0] - a[0]) / d
        s = 1
        while s < d:
            x, z = a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d
            near = {bb for gx in range(int((x - 12) // 20), int((x + 12) // 20) + 1) for gz in range(int((z - 12) // 20), int((z + 12) // 20) + 1) for bb in grid.get((gx, gz), [])}
            rows.append(sum(seen(x, z, bb, nx, nz) for bb in near))
            s += 2
    tot += rows
    print(f'line {li}: stations {len(rows)} filled {sum(r > 0 for r in rows) / max(1, len(rows)):.2f} mean {sum(rows) / max(1, len(rows)):.1f}')
print(f'all: stations {len(tot)} filled {sum(r > 0 for r in tot) / len(tot):.2f} filled>=2 {sum(r > 1 for r in tot) / len(tot):.2f} mean {sum(tot) / len(tot):.1f}')
