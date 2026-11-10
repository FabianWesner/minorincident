"""r33-l8route: flood fill on the REAL D-ZOO layout colliders + the runtime L8 doors (src/data/l8Bosses.ts l8Route/l8PlazaGates).
usage: python3 tools/qa/diag/r33-l8route-flood.py <worktree> [out.json]
For every stage (sealed, k arenas cleared) it prints which arenas / the yard the courier can reach on foot (0.25 m grid, courier radius 0.4 m).
Pass criterion: only the next arena (and the cells before it) is ever reachable."""
import json, math, re, sys
import numpy as np
from scipy import ndimage

WT = sys.argv[1]
L = json.load(open(f'{WT}/public/assets/layouts/D-ZOO.layout.json'))
src = open(f'{WT}/src/data/l8Bosses.ts').read()
X0, X1, Z0, Z1 = -120.0, 120.0, -90.0, 90.0
RES = .25; W, H = int((X1 - X0) / RES), int((Z1 - Z0) / RES); R = .4

def g(x, z): return int((x - X0) / RES), int((z - Z0) / RES)
def box_mask(m, x0, z0, x1, z1):
    a, b = g(min(x0, x1), min(z0, z1)); c, d = g(max(x0, x1), max(z0, z1))
    m[max(0, b):max(0, d + 1), max(0, a):max(0, c + 1)] = True

# static colliders from the layout (fence panels are fixed now, so they are walls)
base = np.zeros((H, W), bool)
for c in L['colliders']:
    mn, mx = c['aabb']['min'], c['aabb']['max']
    if mx[0] < X0 or mn[0] > X1 or mx[2] < Z0 or mn[2] > Z1: continue
    box_mask(base, mn[0], mn[2], mx[0], mx[2])
# runtime blockers independent of the route: yard walls, the evac bus and the APC
yard_walls = [(84, 51, .25, 5), (84, 77, .25, 13), (88, 46, 4, .25), (108, 46, 8, .25)]
for x, z, hx, hz in yard_walls + [(-16, 70, 4.68, 1.48), (96, 74, 4.2, 1.6)]: box_mask(base, x - hx, z - hz, x + hx, z + hz)
# the L8 runtime layer adds the nested primate-yard fence and the lion cover; only fixed fence matters for cells (monkey nested yard is inside the big yard)

def parse_box(txt):
    m = dict(re.findall(r'(x|z|halfX|halfZ): (-?[\d.]+)', txt)); return tuple(float(m[k]) for k in ('x', 'z', 'halfX', 'halfZ'))
stages = []
for m in re.finditer(r"\{ id: '(\w+)', zone: \{ x0: (-?\d+), z0: (-?\d+), x1: (-?\d+), z1: (-?\d+) \}, entry: (null|\{[^}]*\}), exit: (null|\{[^}]*\})", src):
    stages.append(dict(id=m[1], zone=tuple(map(float, m.groups()[1:5])), entry=None if m[6] == 'null' else parse_box(m[6]), exit=None if m[7] == 'null' else parse_box(m[7])))
plaza = {k: parse_box(v) for k, v in re.findall(r"(\w): (\{ x: [^}]*\})", src[src.index('l8PlazaGates'):src.index('l8PlazaCell')])}
centres = {m[1]: (float(m[2]), float(m[3])) for m in re.finditer(r"\{ id: '(\w+)', name: '[^']*', count: \d+, hp: \d+, centre: \{ x: (-?[\d.]+), z: (-?[\d.]+) \}", src)}
centres = {m[1]: (float(m[2]), float(m[3])) for m in re.finditer(r"\{ id: '(\w+)', name: '[^']*', count: \d+, hp: \d+, centre: \{ x: (-?[\d.]+), z: (-?[\d.]+) \}", src)}
order = [s['id'] for s in stages]
assert order == ['flamingo', 'lion', 'monkey', 'zebra', 'gorilla', 'elephant'], order

def reach(cleared, sealed, seed=(0, 0)):
    m = base.copy()
    if sealed:
        for b in plaza.values(): box_mask(m, b[0] - b[2], b[1] - b[3], b[0] + b[2], b[1] + b[3])
    for i, s in enumerate(stages):
        if s['id'] == 'elephant': continue
        entry_closed = i > 0 and i > cleared          # previous arena (i-1) not cleared  <=>  cleared < i
        exit_closed = i >= cleared or (s['id'] == 'flamingo' and not sealed and False)
        if s['id'] == 'flamingo': exit_closed = sealed and cleared < 1
        if s['entry'] and entry_closed: b = s['entry']; box_mask(m, b[0] - b[2], b[1] - b[3], b[0] + b[2], b[1] + b[3])
        if s['exit'] and exit_closed: b = s['exit']; box_mask(m, b[0] - b[2], b[1] - b[3], b[0] + b[2], b[1] + b[3])
    if cleared < 5:                                    # yard doors
        for b in [(84, 60, .25, 4), (96, 46, 4, .25)]: box_mask(m, b[0] - b[2], b[1] - b[3], b[0] + b[2], b[1] + b[3])
    m = ndimage.binary_dilation(m, iterations=int(math.ceil(R / RES)))
    lab, _ = ndimage.label(~m); i, j = g(*seed)
    return lab == lab[j, i], m

report = []
ok = True
prev = None
for cleared in range(0, 6):
    free, _ = reach(cleared, True)
    area = float(free.sum()) * RES * RES
    hit = [a for a in order if free[g(*centres[a])[1], g(*centres[a])[0]]]
    yard = bool(free[g(100, 70)[1], g(100, 70)[0]])
    allowed = order[:cleared + 1]
    bad = [a for a in hit if a not in allowed]
    new = float((free & ~prev).sum()) * RES * RES if prev is not None else area
    report.append(dict(cleared=order[:cleared], reachable_m2=round(area), new_m2=round(new), arenas_reachable=hit, yard_reachable=yard, violation=bad or (yard and cleared < 5)))
    if bad or (yard and cleared < 5): ok = False
    if order[min(cleared, 5)] not in hit and order[min(cleared, 5)] != 'elephant': ok = False; report[-1]['next_unreachable'] = True
    prev = free
# before the seal (calm + opening hold): the courier may walk plaza/pond/north-west path/boulevards but no later arena
free, _ = reach(0, False)
pre = [a for a in order if free[g(*centres[a])[1], g(*centres[a])[0]]]
report.append(dict(stage='pre-seal', arenas_reachable=pre, yard_reachable=bool(free[g(100, 70)[1], g(100, 70)[0]])))
print(json.dumps(report, indent=1))
print('PASS' if ok else 'FAIL')
if len(sys.argv) > 2: json.dump(report, open(sys.argv[2], 'w'), indent=1)
sys.exit(0 if ok else 1)
