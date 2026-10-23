"""L9 dress-l9: the crossing as a place, not a void. Executed by layout.py (shares its globals: l, source, surface, ...).

Everything here is reuse of the existing kits (prop.tree, bld.*, veh.*, kit.*) plus thin ground overlays that are owned by the
terrain chunk they fall in. Hard rules kept from L9-D1/D2: nothing on or near a route, detour, cross-country connection,
sight line, encounter anchor, the crash approach or the player start; tests/unit/levels/l9-district.test.ts is the oracle.
Detail overlays use only tokens that tools/l9/build-terrain.ts leaves out of the coarse horizon (near-field detail).
"""
import random

R = random.Random(931)
# look-l9b: blob outline jitter has its own stream, so the irregular rims never move a placement drawn from R.
RB = random.Random(932)
RV_CRACK = random.Random(936)   # l9-verge-dressing: crack shapes never move a draw from R
M = l.manifest
ROUTES = [(r['points'], r['width'] / 2) for r in source['routes']]
DETOURS = [r['detour'] for r in source['routes']]
CROSS = [[[0, -330], [0, 240]], [[-300, 240], [250, -30]], [[350, -330], [-250, -30]]]
SIGHT = [(v['from'], v['to']) for v in source['viewpoints']]
RISKS = [p for r in source['routes'] for p in r['risks']]
BX, BZ = 600, 400


def seg_d(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dz * dz
    t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)


def poly_d(p, pts):
    return min(seg_d(p, a, b) for a, b in zip(pts, pts[1:]))


def route_d(p):
    return min(poly_d(p, pts) - hw for pts, hw in ROUTES)


def lane_hit(b, a, c, expand):
    lo, hi = 0.0, 1.0
    for axis, (mn, mx) in enumerate(((b[0] - expand, b[2] + expand), (b[1] - expand, b[3] + expand))):
        d = c[axis] - a[axis]
        if d == 0:
            if a[axis] < mn or a[axis] > mx:
                return False
        else:
            t0, t1 = (mn - a[axis]) / d, (mx - a[axis]) / d
            if t0 > t1:
                t0, t1 = t1, t0
            lo, hi = max(lo, t0), min(hi, t1)
            if lo > hi:
                return False
    return True


def fp(asset, x, z, yaw, scale=(1, 1, 1)):
    d = M[asset]['dimensions']
    w, dp = d['x'] * scale[0], d['z'] * scale[2]
    sx = abs(math.cos(yaw)) * w + abs(math.sin(yaw)) * dp
    sz = abs(math.sin(yaw)) * w + abs(math.cos(yaw)) * dp
    return (x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2)


GRID = 12.0
placed = {}   # cell -> [(box, kind)]; kind: solid | soft | tree (box is the crown square)


def reg(box, kind):
    for cx in range(int(box[0] // GRID), int(box[2] // GRID) + 1):
        for cz in range(int(box[1] // GRID), int(box[3] // GRID) + 1):
            placed.setdefault((cx, cz), []).append((box, kind))


def neighbours(box, gap):
    seen = []
    for cx in range(int((box[0] - gap) // GRID), int((box[2] + gap) // GRID) + 1):
        for cz in range(int((box[1] - gap) // GRID), int((box[3] + gap) // GRID) + 1):
            for item in placed.get((cx, cz), []):
                if item not in seen:
                    seen.append(item)
    return seen


def box_gap(a, b):
    return max(a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3])


def kind_of(asset):
    m = M[asset]
    if asset.startswith('veh.'):
        return 'solid'
    if m.get('foliage') and not m['world']['solid']:
        return 'tree'
    return 'solid' if m['world']['solid'] else 'soft'


for _p in l.data['placements']:
    _b = _p['visualAabb']
    reg((_b['min'][0], _b['min'][2], _b['max'][0], _b['max'][2]), kind_of(_p['assetId']) if _p['assetId'] != 'prop.tree' else 'tree')
for _c in l.data['colliders']:
    _b = _c['aabb']
    reg((_b['min'][0], _b['min'][2], _b['max'][0], _b['max'][2]), 'solid')

stats = {}


def ok(asset, x, z, yaw=0.0, scale=(1, 1, 1), zone=False, pack=.62):
    """Every rule that keeps the authored routes, detours, sight lines and encounters playable."""
    kind = kind_of(asset)
    b = fp(asset, x, z, yaw, scale)
    r = max(b[2] - b[0], b[3] - b[1]) / 2
    if b[0] < -BX + 3 or b[2] > BX - 3 or b[1] < -BZ + 3 or b[3] > BZ - 3:
        return False
    if not zone and ((430 < x < 565 and abs(z) < 48) or (x < -512 and abs(z) < 22)):
        return False
    c = (x, z)
    # Lane clearance. The layout validator expands the footprint by the lane half width per axis (Liang-Barsky), so use the same test
    # with a hull/view margin on top. Every placement can carry a trunk/base collider (staticCollision), so detours and the
    # cross-country connections also keep the placement CENTRE clear of the 3 m hull samples.
    margin = {'solid': .9, 'tree': .25, 'soft': .2}[kind] if not zone else .1
    for pts, hw in ROUTES:
        for a0, a1 in zip(pts, pts[1:]):
            if lane_hit(b, a0, a1, hw + margin):
                return False
    for pts in DETOURS:
        if poly_d(c, pts) < 4.8 or (kind == 'solid' and poly_d(c, pts) - r < 5.5):
            return False
    for pts in CROSS:
        if poly_d(c, pts) < (3.8 if kind != 'solid' else 6.5 + r):
            return False
    for a, bb in SIGHT:
        if seg_d(c, a, bb) - r < 11:
            return False
    for q in RISKS:
        if math.hypot(x - q[0], z - q[1]) - r < (20 if kind == 'solid' else 12):
            return False
    for (ob, ok_kind) in neighbours(b, 6):
        if kind == 'tree' and ok_kind == 'tree':
            ocx, ocz, orr = (ob[0] + ob[2]) / 2, (ob[1] + ob[3]) / 2, (ob[2] - ob[0]) / 2
            if math.hypot(x - ocx, z - ocz) < pack * (r + orr):
                return False
        elif kind == 'tree':
            core = (x - r * .45, z - r * .45, x + r * .45, z + r * .45)
            if ok_kind != 'tree' and box_gap(core, ob) < .4 and ok_kind == 'solid':
                return False
        elif ok_kind == 'tree':
            core = (ob[0] + (ob[2] - ob[0]) * .27, ob[1] + (ob[3] - ob[1]) * .27, ob[2] - (ob[2] - ob[0]) * .27, ob[3] - (ob[3] - ob[1]) * .27)
            if kind == 'solid' and box_gap(b, core) < .5:
                return False
        else:
            if box_gap(b, ob) < (.9 if 'solid' in (kind, ok_kind) else .3):
                return False
    return True


def put(asset, x, z, yaw=None, scale=(1, 1, 1), label=None, zone=False, pack=.62, decay=None):
    yaw = R.uniform(0, 2 * math.pi) if yaw is None else yaw
    if not ok(asset, x, z, yaw, scale, zone, pack):
        stats['rejected'] = stats.get('rejected', 0) + 1
        return False
    if label:
        pid = l.place(asset, [x, 0, z], yaw, scale=scale)
        p = l.data['placements'][-1]
        l.data['buildings'].append(dict(id=pid, assetId=asset, aabb=p['visualAabb'], label=label))
        if asset in ['bld.shed', 'bld.garage-detached', 'bld.gas-station', 'bld.power-substation', 'bld.supermarket']:
            lo, hi = p['visualAabb']['min'], p['visualAabb']['max']
            l.data['walkable']['excluded'].append([[lo[0], lo[2]], [hi[0], lo[2]], [hi[0], hi[2]], [lo[0], hi[2]], [lo[0], lo[2]]])
    else:
        l.place(asset, [x, 0, z], yaw, scale=scale)
    if decay:
        l.data['placements'][-1]['decay'] = decay
    b = fp(asset, x, z, yaw, scale)
    reg(b, kind_of(asset))
    stats[asset] = stats.get(asset, 0) + 1
    return True


# ---- value noise: groves, clearings and field types -----------------------------------------------------------
_lat = {}


def _v(ix, iz, salt):
    key = (ix, iz, salt)
    if key not in _lat:
        _lat[key] = random.Random(hash((ix, iz, salt)) & 0xffffffff).random()
    return _lat[key]


def noise(x, z, cell, salt=0):
    fx, fz = x / cell, z / cell
    ix, iz = math.floor(fx), math.floor(fz)
    tx, tz = fx - ix, fz - iz
    tx, tz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
    a = _v(ix, iz, salt) * (1 - tx) + _v(ix + 1, iz, salt) * tx
    b = _v(ix, iz + 1, salt) * (1 - tx) + _v(ix + 1, iz + 1, salt) * tx
    return a * (1 - tz) + b * tz


def in_dry(x, z, margin=0):
    return -460 - margin <= x <= 470 + margin and -170 - margin <= z <= 110 + margin


# ---- ground overlays ----------------------------------------------------------------------------------------
# Heights (m): grass -.006, dry ground -.004, patch/field base -.0025, stripes 0, shoulders .001, edge lines .0085.
FIELD_BASE, FIELD_STRIPE, SHOULDER = -.0025, .0004, .001

# Terrain chunk glbs may hold 800 triangles (tools/l9/build-terrain.ts); the base road geometry uses up to ~250 of a chunk, so
# detail overlays get a per-chunk budget by category and are simply dropped once a chunk is full.
CHUNK_CAP = {'road': 330, 'field': 200}
chunk_est = {}


# look-l9b (orchestrator 10-20): flat ground discs/slabs (dust pans, scrub mats, pasture patches, road patches, road dust,
# verge tufts, dry-zone field bases) read as placeholder polygons at the game camera and cannot get soft edges as flat
# polygons: they are not emitted. Their callers still run (every R draw is kept), so the placement stream is unchanged.
FLAT_DISCS = False


def ov(name, poly, token, height, cut=False, cat='road', flat=False):
    if flat and not FLAT_DISCS:
        return True
    xs, zs = [p[0] for p in poly], [p[1] for p in poly]
    cells = [(cx, cz) for cx in range(int((min(xs) + 600) // 100), int((max(xs) + 600) // 100) + 1)
             for cz in range(int((min(zs) + 400) // 100), int((max(zs) + 400) // 100) + 1) if 0 <= cx < 12 and 0 <= cz < 8]
    n = max(1, len(poly) - 2) + (1 if len(cells) > 1 else 0)
    if any(chunk_est.get((cat, c), 0) + n > CHUNK_CAP[cat] for c in cells):
        stats['dropped-' + cat] = stats.get('dropped-' + cat, 0) + 1
        return False
    for c in cells:
        chunk_est[(cat, c)] = chunk_est.get((cat, c), 0) + n
    surface(name, poly, token, height, cut=cut)
    return True


def rot_rect(cx, cz, hx, hz, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [[cx + c * x - s * z, cz + s * x + c * z] for x, z in ((-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz))]


def clear_poly(poly, margin):
    """Distance of every boundary sample to every authored trace stays above the margin."""
    pts = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        for k in range(6):
            pts.append((a[0] + (b[0] - a[0]) * k / 6, a[1] + (b[1] - a[1]) * k / 6))
    pts.append((sum(p[0] for p in poly) / 4, sum(p[1] for p in poly) / 4))
    for p in pts:
        if abs(p[0]) > BX - 4 or abs(p[1]) > BZ - 4:
            return False
        if route_d(p) < margin:
            return False
        if any(poly_d(p, d) < margin for d in DETOURS):
            return False
        if 400 < p[0] < 570 and abs(p[1]) < 60:
            return False
        if p[0] < -500 and abs(p[1]) < 40:
            return False
    return True


fields = []   # (cx, cz, radius, kind, angle, hx, hz)


def lay_field(kind, cx, cz, hx, hz, ang):
    poly = rot_rect(cx, cz, hx, hz, ang)
    rad = math.hypot(hx, hz)
    if not clear_poly(poly, 9):
        return False
    for f in fields:
        if math.hypot(cx - f[0], cz - f[1]) < (rad + f[2]) * .78:
            return False
    # Row direction follows the long side; row pitch is uneven enough to read as crops at game zoom.
    base, stripe = {'wheat': ('khaki', 'capTan'), 'plow': ('leatherShadow', 'trouserLight'), 'pasture': ('apronOlive', 'oliveLight'),
                    'scrub': ('olive', 'oliveLight'), 'dust': ('khakiSeam', 'khaki')}[kind]
    if kind == 'dust':
        stripe = None
    if not ov('field-' + kind, poly, base, FIELD_BASE, cut=False, cat='field', flat=kind in ('dust', 'scrub')):
        return False
    if stripe and kind != 'pasture':
        pitch = 3.0 if kind == 'wheat' else 2.4
        width = .55 if kind == 'wheat' else .8
        n = int(2 * hz / pitch)
        for i in range(n):
            lz = -hz + pitch * (i + .5) + R.uniform(-.1, .1)
            c, s = math.cos(ang), math.sin(ang)
            x0, x1 = -hx + 1.0, hx - 1.0
            rpoly = [[cx + c * x0 - s * (lz - width / 2), cz + s * x0 + c * (lz - width / 2)], [cx + c * x1 - s * (lz - width / 2), cz + s * x1 + c * (lz - width / 2)],
                     [cx + c * x1 - s * (lz + width / 2), cz + s * x1 + c * (lz + width / 2)], [cx + c * x0 - s * (lz + width / 2), cz + s * x0 + c * (lz + width / 2)]]
            ov('crop-row', rpoly, stripe, FIELD_STRIPE, cut=False, cat='field', flat=kind == 'scrub')
    elif kind == 'pasture':
        # Mowed bands and a couple of lighter patches break the pasture up without a stripe grid.
        for i in range(R.randint(2, 4)):
            bx, bz = R.uniform(-hx * .6, hx * .6), R.uniform(-hz * .6, hz * .6)
            c, s = math.cos(ang), math.sin(ang)
            ov('pasture-patch', blob(cx + c * bx - s * bz, cz + s * bx + c * bz, R.uniform(6, 14), R.uniform(4, 10), R.uniform(0, 3), 9, 14), stripe, FIELD_STRIPE, cut=False, cat='field', flat=True)
    fields.append((cx, cz, rad, kind, ang, hx, hz))
    return True


def blob(cx, cz, rx, rz, ang, n=10, fine=None, plain=False):
    """Slightly irregular ellipse (counter-clockwise like the strips). `n` draws of R as always (the placement stream must not
    move); `fine` vertices are drawn, with a look-l9b rim wobble from RB (two low harmonics plus jitter, at most +20 %), so
    the patches read as worn ground, not polygons. Star-shaped around the centre, which the surface tessellation handles.
    `plain=True` returns (the pre-look-l9b outline, the wobbled one): clearance tests use the first so acceptance never changes."""
    base = [R.uniform(-.05, .05) for _ in range(n)]
    m = fine or n
    a1, a2, p1, p2 = RB.uniform(.05, .1), RB.uniform(.03, .06), RB.uniform(0, 6.283), RB.uniform(0, 6.283)
    jitter = [RB.uniform(-.04, .04) for _ in range(m)]

    def ring(count, k_of):
        pts = []
        for i in range(count):
            t = 2 * math.pi * i / count
            k = k_of(i, t)
            x, z = rx * math.cos(t) * k, rz * math.sin(t) * k
            pts.append([cx + x * math.cos(ang) - z * math.sin(ang), cz + x * math.sin(ang) + z * math.cos(ang)])
        return pts
    pts = ring(m, lambda i, t: 1 + base[i * n // m] + a1 * math.sin(2 * t + p1) + a2 * math.sin(3 * t + p2) + jitter[i])
    return (ring(n, lambda i, t: 1 + base[i]), pts) if plain else pts


def strip_poly(a, b, width, ext=0):
    d = math.dist(a, b)
    ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
    a2 = [a[0] - ux * ext, a[1] - uz * ext]
    b2 = [b[0] + ux * ext, b[1] + uz * ext]
    nx, nz = -uz * width / 2, ux * width / 2
    return [[a2[0] + nx, a2[1] + nz], [a2[0] - nx, a2[1] - nz], [b2[0] - nx, b2[1] - nz], [b2[0] + nx, b2[1] + nz]]


# 1) fields: random sequential packing of rotated rectangles, hundreds of metres from the lanes outwards.
for kind, count, size in [('wheat', 42, (26, 60)), ('plow', 36, (24, 56)), ('pasture', 40, (22, 58))]:
    tries = 0
    made = 0
    while made < count and tries < 4000:
        tries += 1
        cx, cz = R.uniform(-BX + 20, BX - 20), R.uniform(-BZ + 20, BZ - 20)
        if in_dry(cx, cz, 14):
            continue
        hx, hz = R.uniform(*size), R.uniform(size[0] * .6, size[1] * .7)
        ang = R.choice([0, math.pi / 2, R.uniform(-.35, .35), R.uniform(-.35, .35) + math.pi / 2])
        if lay_field(kind, cx, cz, hx, hz, ang):
            made += 1
    stats['field-' + kind] = made

# 2) dry zone: pale dust pans, olive scrub mats and dark soil scars between the wrecks.
for kind, count, rr in [('dust', 70, (7, 26)), ('scrub', 90, (4, 14))]:
    made = 0
    for _ in range(count * 6):
        if made >= count:
            break
        cx, cz = R.uniform(-455, 465), R.uniform(-165, 105)
        rx, rz = R.uniform(*rr), R.uniform(*rr) * .7
        plain, poly = blob(cx, cz, rx, rz, R.uniform(0, math.pi), 11, 16, plain=True)
        if not in_dry(cx, cz, -4) or not clear_poly(plain, 7.5):
            continue
        if kind == 'dust':
            # look-l9b: smaller pans (the 26 m discs read as placeholder polygons); shrunk after the clearance test so the
            # acceptance, and with it the R stream, stays exactly as before.
            poly = [[cx + (x - cx) * .72, cz + (z - cz) * .72] for x, z in poly]
        # patches may sit under props but never under the encounter lanes
        base, stripe = ('leather', None) if kind == 'dust' else ('leather', None)   # look-l9b: scrub mats as dark patches (oliveSeam still read as pale discs)
        ov('dry-' + kind, poly, base, FIELD_BASE if kind == 'dust' else FIELD_BASE + .0007, cut=False, cat='field', flat=True)
        made += 1
    stats['dry-' + kind] = made

# 3) road shoulders (dirt) and edge lines along the asphalt route, trimmed where the gravel branches meet the asphalt.
road_pts = source['routes'][0]['points']
for i, (a, b) in enumerate(zip(road_pts, road_pts[1:])):
    d = math.dist(a, b)
    ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
    nx, nz = -uz, ux
    t0 = 16 if i in (1, 4) else 0   # segment starts at a fork / merge node
    t1 = d - (16 if i in (0, 3) else 0)   # segment ends at a fork / merge node
    if i == 4: t0, t1 = 16, d
    if i == 0: t0, t1 = 0, d - 16
    if t1 - t0 < 4:
        continue
    for side in (-1, 1):
        sa = [a[0] + ux * t0 + nx * side * 7.0, a[1] + uz * t0 + nz * side * 7.0]
        sb = [a[0] + ux * t1 + nx * side * 7.0, a[1] + uz * t1 + nz * side * 7.0]
        ov('shoulder', strip_poly(sa, sb, 2.6, 0), 'leather', SHOULDER, cut=False, cat='road')
        ea = [a[0] + ux * t0 + nx * side * 5.55, a[1] + uz * t0 + nz * side * 5.55]
        eb = [a[0] + ux * t1 + nx * side * 5.55, a[1] + uz * t1 + nz * side * 5.55]
        ov('edge-line', strip_poly(ea, eb, .14, 0), 'pantsLight', .0085, cut=False, cat='road')   # look-l9b: worn grey paint, not self-lit white

# 4) road continuation past both playable ends (inside the chunk grid here, beyond it as plain base quads below).
for sx in (-1, 1):
    a, b = [sx * 550, 0], [sx * 600, 0]
    surface('road-extension', strip_poly(a, b, 12, 0), 'asphalt', .002)
    for k in range(0, 50, 20):
        surface('road-mark', strip_poly([sx * (554 + k), 0], [sx * (558 + k), 0], .16, 0), 'silver', .008)

# ---- vegetation -----------------------------------------------------------------------------------------------


def tree(x, z, big=1.0):
    s = R.uniform(.72, 1.18) * big
    return put('prop.tree', x, z, scale=(s, s * R.uniform(.88, 1.22), s))


def candidate_density(x, z):
    """Trees thin out away from the routes and inside the dry ground; groves follow a value-noise mask."""
    d = min(route_d((x, z)), 400)
    base = 1.0 if d < 40 else max(.22, 1.0 - (d - 40) / 140)
    mask = noise(x, z, 70, 1) * .65 + noise(x, z, 24, 2) * .35
    p = base * max(0, (mask - .38) * 2.6)
    if in_dry(x, z):
        p *= .07
    return min(1, p)


# ---- roadside belt: what the game camera actually sees --------------------------------------------------------------
# The game camera frames ~15 m x 14 m at zoom 1 (22 m at 1.5, 7.5 m at 0.5): the lane itself, a thin verge, and whatever stands
# within ~12 m of the lane edge. So the dressing is dense there: avenues, hedgerows, bush clumps, gaps with fences and rubble,
# plus decals ON the roads (patches, cracks, skid marks, dust drifts) so the ribbon is not a flat plane.
counts = {'avenue': 0, 'hedge': 0, 'bush': 0, 'fence': 0, 'rubble': 0, 'sign': 0, 'ditch': 0, 'dust': 0, 'patch': 0, 'crack': 0, 'skid': 0, 'tuft': 0}


def frame_at(a, b, t):
    d = math.dist(a, b)
    ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
    return a[0] + ux * t, a[1] + uz * t, ux, uz, -uz, ux


MODES = ['avenue', 'avenue', 'hedge', 'hedge', 'bush', 'bush', 'fence', 'open', 'rubble']


def edge_framing(pts, hw, gravel):
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        for side in (-1, 1):
            t = R.uniform(0, 6)
            mode, left = R.choice(MODES), R.uniform(24, 70)
            while t < d:
                x, z, ux, uz, nx, nz = frame_at(a, b, t)
                yaw = -math.atan2(uz, ux)
                step = 6.0
                if mode == 'avenue':
                    o = hw + R.uniform(3.4, 5.2)
                    if tree(x + nx * side * o, z + nz * side * o, R.uniform(.85, 1.05)):
                        counts['avenue'] += 1
                    step = R.uniform(7.5, 12)
                elif mode == 'hedge':
                    o = hw + 1.9
                    if put('prop.hedge', x + nx * side * o, z + nz * side * o, yaw, (1.0, R.uniform(.9, 1.3), R.uniform(.9, 1.2))):
                        counts['hedge'] += 1
                    step = 2.7
                elif mode == 'bush':
                    o = hw + R.uniform(2.0, 6.5)
                    for _ in range(R.randint(1, 3)):
                        if put(R.choice(['prop.garden-bush', 'prop.garden-bush-small']), x + nx * side * o + R.uniform(-2, 2), z + nz * side * o + R.uniform(-2, 2)):
                            counts['bush'] += 1
                    step = R.uniform(4, 8)
                elif mode == 'fence':
                    o = hw + 2.3
                    if put('prop.crowd-fence', x + nx * side * o, z + nz * side * o, yaw):  # look-l9: runs along the lane (was +pi/2: panels stuck out across the verge like teeth)
                        counts['fence'] += 1
                    step = R.uniform(2.6, 3.4) if R.random() < .75 else 5.5
                elif mode == 'rubble':
                    o = hw + R.uniform(2.0, 5.0)
                    if put(R.choice(['prop.crates', 'prop.pallet', 'prop.trash-bags', 'prop.sandbag-pallet', 'prop.dumpster', 'prop.wheelbarrow', 'prop.traffic-cone']), x + nx * side * o, z + nz * side * o):
                        counts['rubble'] += 1
                    step = R.uniform(3, 7)
                t += step
                left -= step
                if left <= 0:
                    mode, left = R.choice(MODES), R.uniform(24, 70)


def road_decals(pts, hw, gravel, h0):
    """Flat near-field decals on and beside the lane: they break the ribbon up without touching collision or sim surfaces."""
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        t = R.uniform(2, 8)
        while t < d - 2:
            x, z, ux, uz, nx, nz = frame_at(a, b, t)
            ang = math.atan2(uz, ux)
            r = R.random()
            lat = R.uniform(-hw + .8, hw - .8)
            cx, cz = x + nx * lat, z + nz * lat
            if r < .22 and not gravel:
                # resurfaced patch: a different-toned slab
                w, h = R.uniform(1.4, 3.2), R.uniform(2.0, 5.5)
                ov('road-patch', rot_rect(cx, cz, h / 2, w / 2, ang + R.uniform(-.08, .08)), 'pantsCargo', h0, cut=False, cat='road', flat=True)
                counts['patch'] += 1
            elif r < .5:
                # tar crack: a short jagged branching fissure (the old 2.5-8 m straight hairlines read as scratches across the lane)
                L = R.uniform(2.5, 8) * .42   # same single draw as before: the R stream is unchanged
                ca = ang + R.choice([R.uniform(-.25, .25), R.uniform(1.1, 2.0)])
                px, pz = cx - math.cos(ca) * L / 2, cz - math.sin(ca) * L / 2
                w0, steps = R.uniform(.04, .08) * 1.1, 3
                for k in range(steps):
                    na = ca + RV_CRACK.uniform(-.7, .7)
                    qx, qz = px + math.cos(na) * L / steps, pz + math.sin(na) * L / steps
                    ov('road-crack', strip_poly([px, pz], [qx, qz], w0 * (1.25 - k * .25), 0), 'uiDark', h0 + .0004, cut=False, cat='road')
                    if k == 1 and RV_CRACK.random() < .5:
                        ba = na + RV_CRACK.choice([-1, 1]) * RV_CRACK.uniform(.6, 1.1)
                        ov('road-crack', strip_poly([qx, qz], [qx + math.cos(ba) * .7, qz + math.sin(ba) * .7], .05, 0), 'uiDark', h0 + .0004, cat='road')
                    px, pz = qx, qz
                counts['crack'] += 1
            elif r < .62:
                # dust / grit drifting in from the verge, a soft long ellipse across a lane edge
                side = R.choice([-1, 1])
                ex, ez = x + nx * side * (hw - R.uniform(.2, 2.2)), z + nz * side * (hw - R.uniform(.2, 2.2))
                ov('road-dust', blob(ex, ez, R.uniform(2.5, 7), R.uniform(.8, 2.0), ang + R.uniform(-.2, .2), 9, 12), 'khakiSeam', h0, cut=False, cat='road', flat=True)
                counts['dust'] += 1
            elif r < .70 and not gravel:
                # a pair of dark skid / tyre marks
                L = R.uniform(3, 7) * .6
                for off in (-.9, .9):
                    ox, oz = cx + nx * off, cz + nz * off
                    ov('skid', strip_poly([ox - ux * L / 2, oz - uz * L / 2], [ox + ux * L / 2 + nx * R.uniform(-.8, .8), oz + uz * L / 2 + nz * R.uniform(-.8, .8)], .15, 0), 'uiDark', h0 + .0002, cut=False, cat='road')
                counts['skid'] += 1
            t += R.uniform(3.5, 9)
        # verge: grass tufts / dark soil / dust beside the lane (ground-level detail inside the frame at zoom 1.5)
        t = R.uniform(1, 5)
        while t < d - 1:
            x, z, ux, uz, nx, nz = frame_at(a, b, t)
            for side in (-1, 1):
                o = hw + R.uniform(.4, 6)
                token = R.choice(['oliveLight', 'oliveLight', 'khakiSeam', 'capTan', 'trouserLight'])
                ov('verge-tuft', blob(x + nx * side * o, z + nz * side * o, R.uniform(.7, 2.6), R.uniform(.5, 1.6), math.atan2(uz, ux) + R.uniform(-.3, .3), 8), token, R.choice([.0014, .0018]), cut=False, cat='road', flat=True)
                counts['tuft'] += 1
            t += R.uniform(3.6, 6.2)


for (pts, hw), gravel, h0 in zip(ROUTES, (False, True, True), (.0033, .0055, .0075)):
    edge_framing(pts, hw, gravel)
    road_decals(pts, hw, gravel, h0)
    # drainage ditch: a darker soil band beside the verge on both sides, interrupted
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        if d < 40:
            continue
        for side in (-1, 1):
            t = R.uniform(10, 25)
            while t < d - 22:
                length = min(R.uniform(14, 34), d - 14 - t)
                if length < 6:
                    break
                x, z, ux, uz, nx, nz = frame_at(a, b, t)
                o = hw + 5.2 + R.uniform(-.3, .8)
                pa = [x + nx * side * o, z + nz * side * o]
                pb = [pa[0] + ux * length, pa[1] + uz * length]
                if all(math.hypot(q[0] - n[0], q[1] - n[1]) > 24 for q in (pa, pb) for n in ((-450, 0), (450, 0))):
                    ov('ditch', strip_poly(pa, pb, R.uniform(1.1, 2.0), 0), 'leatherShadow', .0012, cut=False, cat='road')
                    counts['ditch'] += 1
                t += length + R.uniform(10, 40)


# road signs: one per ~110 m, alternating sides, on the verge
def signs(pts, hw):
    run = 0.0
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        t = 30
        while t < d:
            x, z, ux, uz, nx, nz = frame_at(a, b, t)
            side = 1 if int((run + t) // 110) % 2 else -1
            if put('prop.street-sign', x + nx * side * (hw + 1.0), z + nz * side * (hw + 1.0), -math.atan2(uz, ux) + (math.pi / 2 if side > 0 else -math.pi / 2)):
                counts['sign'] += 1
            t += 110 * R.uniform(.85, 1.15)
        run += d


for pts, hw in ROUTES:
    signs(pts, hw)
stats.update(counts)

n_trees = 0
for _ in range(60000):
    x, z = R.uniform(-BX + 8, BX - 8), R.uniform(-BZ + 8, BZ - 8)
    if R.random() > candidate_density(x, z):
        continue
    if tree(x, z):
        n_trees += 1
    if n_trees >= 800:
        break
stats['trees-scattered'] = n_trees

# field boundary tree rows and hedgerows (gapped: never a continuous solid wall).
rows = 0
for (cx, cz, rad, kind, ang, hx, hz) in fields:
    for side in R.sample([0, 1, 2, 3], R.randint(1, 2)):
        c, s = math.cos(ang), math.sin(ang)
        if side < 2:
            ends = [(-hx, (-1 if side == 0 else 1) * hz), (hx, (-1 if side == 0 else 1) * hz)]
        else:
            ends = [((-1 if side == 2 else 1) * hx, -hz), ((-1 if side == 2 else 1) * hx, hz)]
        p0 = [cx + c * ends[0][0] - s * ends[0][1], cz + s * ends[0][0] + c * ends[0][1]]
        p1 = [cx + c * ends[1][0] - s * ends[1][1], cz + s * ends[1][0] + c * ends[1][1]]
        L = math.dist(p0, p1)
        t = R.uniform(0, 6)
        while t < L:
            if R.random() < .72:
                x, z = p0[0] + (p1[0] - p0[0]) * t / L, p0[1] + (p1[1] - p0[1]) * t / L
                if R.random() < .75:
                    rows += tree(x + R.uniform(-1.2, 1.2), z + R.uniform(-1.2, 1.2), .95)
                elif not in_dry(x, z) and put('prop.hedge', x, z, math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * -1 + 0, (1.4, 1, 1)):
                    rows += 1
            t += R.uniform(5.5, 9)
stats['field-rows'] = rows

# perimeter belts hide the map edge: ragged double rows on the west and east ends (start and city), a single row north and south.
belt = 0
for axis, sign, depth, step in [(0, -1, 18, 8), (0, 1, 18, 8), (1, -1, 12, 12), (1, 1, 12, 12)]:
    span = 396 if axis == 0 else 596
    t = -span
    while t < span:
        off = R.uniform(2, depth)
        if axis == 0:
            belt += tree(sign * (598 - off), t, 1.08)
        else:
            belt += tree(t, sign * (396 - off), 1.08)
        t += R.uniform(step * .6, step * 1.3)
stats['belt'] = belt

# ---- farmsteads and countryside stock --------------------------------------------------------------------------


def farm(cx, cz, yaw0=0.0, big=True):
    """House, sheds, a workshop, a parked pickup and bushes: reuse of the countryside stock, facing the nearest route."""
    got = 0
    got += put(R.choice(['bld.house-b', 'bld.house-c', 'bld.house-d', 'bld.house-e', 'bld.house-a']), cx, cz, yaw0, label='Countryside')
    for dx, dz in [(R.uniform(11, 16), R.uniform(-6, 6)), (R.uniform(-17, -11), R.uniform(-5, 5)), (R.uniform(-5, 5), R.uniform(12, 18))]:
        got += put(R.choice(['bld.shed', 'bld.shed', 'bld.garage-detached']), cx + dx, cz + dz, R.choice([0, math.pi / 2]), label='Farm outbuilding')
    if big:
        put('veh.pickup-white', cx + R.uniform(-8, 8), cz + R.uniform(-13, -9), R.uniform(0, 6.28))
        for _ in range(4):
            put('prop.garden-bush', cx + R.uniform(-14, 14), cz + R.uniform(-12, 12))
        for _ in range(5):
            put(R.choice(['prop.crates', 'prop.pallet', 'prop.wheelbarrow', 'prop.trash-bags']), cx + R.uniform(-13, 13), cz + R.uniform(-13, 13))
    return got


farms = 0
farm_list = []
for _ in range(900):
    if farms >= 11:
        break
    x, z = R.uniform(-560, 540), R.uniform(-380, 380)
    if in_dry(x, z, 20) or route_d((x, z)) < 22 or route_d((x, z)) > 140:
        continue
    if x > 420 or any(math.hypot(x - f[0], z - f[1]) < 90 for f in farm_list):
        continue
    if farm(x, z, R.choice([0, math.pi / 2, math.pi, -math.pi / 2])):
        farm_list.append((x, z))
        farms += 1
stats['farms'] = farms

# dirt farm tracks: from each farmstead to its nearest route lane edge (visual only, 3.2 m).
for fx, fz in farm_list:
    best = None
    for pts, hw in ROUTES:
        for a, b in zip(pts, pts[1:]):
            d = seg_d((fx, fz), a, b)
            if best is None or d < best[0]:
                dx, dz = b[0] - a[0], b[1] - a[1]
                t = max(0, min(1, ((fx - a[0]) * dx + (fz - a[1]) * dz) / (dx * dx + dz * dz)))
                best = (d, [a[0] + t * dx, a[1] + t * dz], hw)
    d, foot, hw = best
    if d < 8:
        continue
    ux, uz = (foot[0] - fx) / d, (foot[1] - fz) / d
    tip = [foot[0] - ux * (hw + .5), foot[1] - uz * (hw + .5)]
    ov('farm-track', strip_poly([fx, fz], tip, 3.4, 0), 'capTan', .0012, cut=False, cat='road')

# ---- road furniture -----------------------------------------------------------------------------------------------
# utility poles along the asphalt (north side) and the dry shortcut (north side), wrecks and signs on the verges.
poles = 0
for pts, hw, off, step in [(source['routes'][0]['points'], 6, 9.5, 46), (source['routes'][2]['points'], 4.5, 8.5, 52), (source['routes'][1]['points'], 4.5, 8.0, 58)]:
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
        nx, nz = -uz, ux
        yaw = math.atan2(uz, ux)
        t = 14
        while t < d - 10:
            x, z = a[0] + ux * t + nx * off, a[1] + uz * t + nz * off
            if put('prop.utility-pole', x, z, -yaw + math.pi / 2):
                poles += 1
            t += step + R.uniform(-4, 4)
stats['poles'] = poles

verge_wrecks = [('veh.sedan-red', 'wrecked'), ('veh.school-bus', 'wrecked'), ('veh.ambulance', 'wrecked'), ('veh.military-truck', 'wrecked'),
                ('veh.pickup-red', 'wrecked'), ('veh.evac-bus', 'wrecked'), ('veh.sedan-red', 'burned'), ('veh.wreck', None), ('veh.wreck', None), ('veh.pickup-red', 'burned')]
w = 0
for pts, hw in ROUTES:
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
        nx, nz = -uz, ux
        for _ in range(int(d / 70)):
            t = R.uniform(10, d - 10)
            side = R.choice([-1, 1])
            off = hw + R.uniform(7.2, 11)
            asset, dec = R.choice(verge_wrecks)
            x, z = a[0] + ux * t + nx * side * off, a[1] + uz * t + nz * side * off
            if put(asset, x, z, math.atan2(uz, ux) * -1 + R.uniform(-.7, .7), decay=dec):
                w += 1
stats['verge-wrecks'] = w

# abandoned roadside services on the asphalt loop and an overrun checkpoint near the fork.
put('bld.joes-diner', 128, -351.5, math.pi / 2, label='Roadside diner', zone=False)
put('bld.supermarket', -170, -356, math.pi / 2, label='Roadside shop')
for x, z in [(-150, -352), (-170, -343), (-190, -352)]:
    put('prop.gas-pump', x, z, 0)
for x, z in [(112, -344), (113, -358)]:
    put('prop.street-lamp', x, z, 0)
put('prop.light-tower', -118, -88, 0.6)
put('prop.light-tower', 262, -78, -.5)
put('kit.army-checkpoint', -330, 31, 0)
for x, z in [(-500, -48), (-516, -75), (-492, -70)]:
    put('prop.tent', x, z)
for x, z in [(-535, 15), (-520, 40)]:
    put('prop.jersey-barrier', x, z, math.pi / 2)
for x, z, yaw in [(-516, 9.6, .4), (-492, -9.2, -.3)]:
    put('veh.sedan-red', x, z, yaw, decay='wrecked', zone=True)

# power/dry-ground detail: scrub bushes, crates, barrels near the wrecks, concrete barriers.
scrub = 0
for _ in range(4000):
    if scrub >= 130:
        break
    x, z = R.uniform(-455, 465), R.uniform(-165, 105)
    if abs(z + 30) < 18:
        continue
    if put(R.choice(['prop.garden-bush', 'prop.garden-bush-small', 'prop.garden-bush-small']), x, z):
        scrub += 1
stats['scrub'] = scrub
for cx, cz in [(-380, -85), (-60, 55), (180, 40), (330, -120), (-200, 60)]:
    for _ in range(6):
        put(R.choice(['prop.crates', 'prop.pallet', 'prop.jersey-barrier', 'prop.sandbag-pallet']), cx + R.uniform(-10, 10), cz + R.uniform(-10, 10))

# ---- the next city, a skyline along the east edge ----------------------------------------------------------------
city = [('bld.apartment-block-b', 12.6), ('bld.town-hall', 16), ('bld.church', 11), ('bld.hospital', 22.8), ('bld.apartment-block-a', 12), ('bld.storefront-row', 16.5),
        ('bld.mainstreet-brick', 9.7), ('bld.apartment-block-b', 12.6), ('bld.supermarket', 9)]
count = 0
for _ in range(900):
    if count >= 34:
        break
    x, z = R.uniform(566, 592), R.uniform(-190, 190)
    if abs(z) < 16:
        continue
    asset = R.choice([c[0] for c in city])
    if put(asset, x, z, R.choice([0, math.pi / 2, math.pi, -math.pi / 2]), label='City edge'):
        count += 1
stats['city'] = count
for z in (-150, -100, -50, 50, 100, 150):
    put('prop.street-lamp', 553, z, 0)

# ---- beyond the playable edge: plain ground so no void shows, and the road runs on ---------------------------------------


def raw_quad(name, poly, token, height):
    """Ground outside the chunk grid: plain base geometry (kept by the coarse horizon, 2 triangles)."""
    verts = [(p[0], -p[1], height) for p in poly]
    area = sum(verts[i][0] * verts[(i + 1) % 4][1] - verts[(i + 1) % 4][0] * verts[i][1] for i in range(4))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)] if area > 0 else [(3, 2, 1, 0)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material(token))
    l.layers[0].append(obj)


SKIRT = 320
for rect in [[[-BX - SKIRT, -BZ - SKIRT], [BX + SKIRT, -BZ - SKIRT], [BX + SKIRT, -BZ], [-BX - SKIRT, -BZ]],
             [[-BX - SKIRT, BZ], [BX + SKIRT, BZ], [BX + SKIRT, BZ + SKIRT], [-BX - SKIRT, BZ + SKIRT]],
             [[-BX - SKIRT, -BZ], [-BX, -BZ], [-BX, BZ], [-BX - SKIRT, BZ]],
             [[BX, -BZ], [BX + SKIRT, -BZ], [BX + SKIRT, BZ], [BX, BZ]]]:
    raw_quad('apron', rect, 'grass', -.006)
for sx in (-1, 1):
    raw_quad('road-beyond', [[sx * 600, -6], [sx * 900, -6], [sx * 900, 6], [sx * 600, 6]], 'asphalt', .002)
# ---- E31 art addendum (look-l9): who still has power, and two radio masts -----------------------------------------
# Own RNG: the dressing above keeps its exact random sequence. Farms run generators (lit windows and porch lamps), the diner
# sign still burns, the army floods and the lamps at the city edge stay on; the abandoned highway stop stays dark.
NIGHT = random.Random(9319)
l.data['lightGroups'].append(dict(id='crossing-lit', offAt=6))
inst = {o.name: o for o in l.empties if o.name.startswith('inst:')}


def light_up(index):
    p = l.data['placements'][index]
    p['lightGroup'] = 'crossing-lit'
    o = inst.get('inst:' + p['assetId'] + ':' + str(index + 1))
    if o is not None:
        o['lightGroup'] = 'crossing-lit'


for index, p in enumerate(l.data['placements']):
    a = p['assetId']
    chance = 0
    if a.startswith('bld.house-'):
        chance = .75
    elif a == 'bld.shed':
        chance = .35
    elif a in ('bld.joes-diner', 'prop.light-tower', 'kit.army-checkpoint'):
        chance = 1
    elif a == 'prop.street-lamp':
        chance = 1 if p['position'][0] > 500 or abs(p['position'][0] - 112.5) < 3 else 0
    elif a in ('bld.apartment-block-a', 'bld.apartment-block-b', 'bld.storefront-row', 'bld.mainstreet-brick'):
        chance = .3   # a few windows in the next city, between its fires
    if chance and NIGHT.random() < chance:
        light_up(index)

# Radio masts (stretched utility poles, a red aviation blinker in src/render/NightAccents.ts). Placed north (-z) of a lane so
# the low moon (L9-crossing, azimuth 3.0) throws their ~45 m shadow south across it.
masts = 0
for site in [[(-100, -64), (-96, -70), (-106, -66)], [(62, -360), (66, -364), (56, -362)], [(-62, 210), (-70, 206), (-56, 206)]]:
    masts += any(put('prop.utility-pole', x, z, .6, (1.25, 3.1, 1.25)) for x, z in site)
stats['masts'] = masts

# ---- world-fill (PO #34, stunning blocker): the near verge the game camera actually frames ----------------------------------
# "L9 drive -550->353 over a black plain": the edge framing above leaves long 'open' stretches and loses many pieces to the
# risk/sight-line rules, so most zoom-1 frames (the 12 m lane plus ~3 m of verge each side) show bare ground. This pass walks
# every lane in plots of 9-17 m with 3-5 m gaps and fills the first 1.5-9 m beyond the lane edge with hedgerows, field fences,
# tree clumps, bushes, poles, wrecks and the odd farm shed, through the same ok() rules (lanes, detours, cross-country links,
# sight lines, risks, the start and crash zones). Own RNG and explicit yaw/scale, so no earlier draw from R moves.
RF = random.Random(934)
fill = {'n': 0}


def fput(asset, x, z, yaw, scale=(1, 1, 1), decay=None, zone=False):
    if zone and route_d((x, z)) < 1.6 + max(fp(asset, x, z, yaw, scale)[2] - x, fp(asset, x, z, yaw, scale)[3] - z):
        return False
    if put(asset, x, z, yaw, scale, decay=decay, zone=zone):
        l.data['placements'][-1]['worldFill'] = True
        if M[asset]['dimensions']['y'] * scale[1] < LOW: low_boxes.add(fp(asset, x, z, yaw, scale))
        fill['n'] += 1
        return True
    return False


# Boxes lower than LOW (hedges, fences, bushes, bins, crates): a crown (bottom above ~2 m) may overhang them.
LOW = 1.6
low_boxes = {(q['visualAabb']['min'][0], q['visualAabb']['min'][2], q['visualAabb']['max'][0], q['visualAabb']['max'][2]) for q in l.data['placements'] if q['visualAabb']['max'][1] < LOW}


def fill_tree(x, z, s, zone=False):
    # Whole-crown clearance from every taller solid (Scene Lab static clipping: crown x pole/lamp/roof/car), stricter than ok().
    crown = fp('prop.tree', x, z, 0, (s, s, s))
    if any(k == 'solid' and ob not in low_boxes and box_gap(crown, ob) < .3 for ob, k in neighbours(crown, 1)):
        return False
    return fput('prop.tree', x, z, RF.uniform(0, math.tau), (s, s * RF.uniform(.9, 1.2), s), zone=zone)


def fill_plot(kind, a, ux, uz, nx, nz, s0, s1, hw, side, zone=False):
    yaw = -math.atan2(uz, ux)
    P = lambda s, o: (a[0] + ux * s + nx * side * (hw + o), a[1] + uz * s + nz * side * (hw + o))
    mid = (s0 + s1) / 2
    if kind == 'hedgerow':
        s = s0
        while s + 2.5 <= s1:
            fput('prop.hedge', *P(s + 1.25, 1.7), yaw, (1.0, RF.uniform(.9, 1.3), RF.uniform(.9, 1.2)), zone=zone)
            s += 2.55
        fill_tree(*P(mid + RF.uniform(-3, 3), RF.uniform(4.8, 6.5)), RF.uniform(.75, 1.0), zone)
    elif kind == 'fence':
        s = s0
        while s + 2.64 <= s1:
            if RF.random() < .8: fput(RF.choice(['prop.picket-fence', 'prop.privacy-fence']), *P(s + 1.32, 1.9), yaw + math.pi / 2, zone=zone)
            s += 2.64
        fput(RF.choice(['prop.garden-bush', 'prop.garden-bush-small']), *P(s1 - 1, 3.2), RF.uniform(0, math.tau), zone=zone)
        fill_tree(*P(mid, RF.uniform(5.5, 7.5)), RF.uniform(.8, 1.05), zone)
    elif kind == 'grove':
        for k in range(RF.randint(2, 3)):
            fill_tree(*P(s0 + RF.uniform(1, s1 - s0 - 1), RF.uniform(4.2, 8.5)), RF.uniform(.7, 1.05), zone)
        for k in range(RF.randint(1, 3)):
            fput(RF.choice(['prop.garden-bush', 'prop.garden-bush-small']), *P(s0 + RF.uniform(0, s1 - s0), RF.uniform(1.4, 3.2)), RF.uniform(0, math.tau), zone=zone)
    elif kind == 'wreck':
        asset, dec = RF.choice(verge_wrecks[:7] + [('veh.sedan-white', 'burned'), ('veh.suv-dark', 'wrecked')])
        fput(asset, *P(mid, RF.uniform(2.6, 3.6)), yaw + RF.uniform(-.35, .35) + (math.pi if RF.random() < .5 else 0), decay=dec, zone=zone)
        fput(RF.choice(['prop.crates', 'prop.trash-bags', 'prop.pallet', 'prop.traffic-cone']), *P(s0 + 1, 1.6), RF.uniform(0, math.tau), zone=zone)
        fput('prop.utility-pole', *P(s1 - 1.5, 1.6), yaw + math.pi / 2, zone=zone)
    elif kind == 'farm':
        # A farm gate: parked pickup in the drive, hedge and mailbox. (No sheds: their interiors became closed nav pockets.)
        fput(RF.choice(['veh.pickup-red', 'veh.pickup-white', 'veh.suv-green']), *P(mid, RF.uniform(3.0, 4.0)), yaw + (math.pi if RF.random() < .5 else 0) + RF.uniform(-.2, .2), zone=zone)
        fput(RF.choice(['prop.garden-bush', 'prop.hedge']), *P(s0 + 1.5, 1.8), yaw, zone=zone)
        fput(RF.choice(['prop.mailbox-blue', 'prop.trash-bin', 'prop.wheelbarrow']), *P(s1 - 1.2, 1.6), yaw, zone=zone)


FILL_KINDS = [('hedgerow', 3), ('grove', 4), ('fence', 2), ('wreck', 1), ('farm', 1)]
for (pts, hw), gravel in zip(ROUTES, (False, True, True)):
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
        nx, nz = -uz, ux
        for side in (-1, 1):
            s = RF.uniform(2, 6)
            while s < d - 6:
                L = RF.uniform(9, 17)
                kind = RF.choices([k for k, _ in FILL_KINDS], [w for _, w in FILL_KINDS])[0]
                fill_plot(kind, a, ux, uz, nx, nz, s, min(d - 3, s + L), hw, side)
                s += L + RF.uniform(3, 5)
# Avenue pass: crowns overhanging the lane edge put mass into every zoom-1 frame (the frame shows ~7 m of road length per verge).
for (pts, hw), gravel in zip(ROUTES, (False, True, True)):
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
        nx, nz = -uz, ux
        for side in (-1, 1):
            s = RF.uniform(2, 7)
            while s < d - 3:
                sc = RF.uniform(.8, 1.0)
                o = hw + 4.1 + RF.uniform(0, .6)   # core clear of the hedgerows at hw+1.7 (ok() tree/solid rule), crown edge ~hw+1
                if RF.random() < .8: fill_tree(a[0] + ux * s + nx * side * o, a[1] + uz * s + nz * side * o, sc)
                s += RF.uniform(8, 12)
# The drive-out (L9 start, the APC sets off from the zoo road): ok() keeps x < -512 / |z| < 22 empty for the start, so this
# stretch gets its own pass (zone rules: lane edge + 1.6 m) with hedgerows and groves only, nothing a hull could catch.
for side in (-1, 1):
    s = 3
    while s < 84:
        L = RF.uniform(10, 15)
        fill_plot(RF.choice(['hedgerow', 'grove', 'grove', 'fence']), [-598, 0], 1, 0, 0, 1, s, s + L, 6, side, zone=True)
        s += L + RF.uniform(3, 4.5)
stats['world-fill'] = fill['n']

# ---- verge-dressing (l9-verge-dressing, PO 10-23): props 2.5-6 m beyond the lane edge, the strip the night drive camera frames ------------
# "while driving, the camera only sees about 17 x 10 m at zoom 1 ... the lane plus 3-6 m of verge": abandoned and burnt cars pushed
# aside, rubble, broken fences, roadblock leftovers, dead lamps. Reuse of existing assets only. Own RNG (no earlier draw moves).
# Rule: every footprint sample stays >= 2.5 m from the lane edge (so its collider never reaches the lane), the crash approach and
# crawl (x > 430, the ok() exclusion) stays clear. The start drive-out (x < -512) gets the same pass with zone rules.
RV = random.Random(935)
vstat = {'n': 0, 'wreck': 0, 'rubble': 0, 'fence': 0, 'block': 0, 'lamp': 0, 'bush': 0}
VERGE_MIN = 2.5
usable = lambda a: a in M and 'world' in M[a] and 'dimensions' in M[a]
WRECKS = [('veh.sedan-red', 'burned'), ('veh.sedan-white', 'burned'), ('veh.pickup-red', 'burned'), ('veh.sedan-blue', 'wrecked'),
          ('veh.sedan-green', 'wrecked'), ('veh.suv-dark', 'burned'), ('veh.suv-dark', 'wrecked'), ('veh.wreck', None), ('veh.wreck', None),
          ('veh.police-sedan', 'wrecked'), ('veh.police-sedan', 'burned'), ('veh.ambulance', 'wrecked'), ('veh.school-bus', 'burned'),
          ('veh.military-truck', 'wrecked'), ('veh.fire-engine', 'burned')]
RUBBLE = ['prop.crates', 'prop.pallet', 'prop.trash-bags', 'prop.plank-stack', 'prop.sofa', 'prop.broken-chair', 'prop.dumpster',
          'prop.shopping-cart', 'prop.recycling-bin', 'prop.carpet', 'prop.wheelbarrow']


def vput1(asset, x, z, yaw, decay=None):
    """put() plus the verge rule: footprint centre and corners keep VERGE_MIN from every lane edge (any route) and stay on the map."""
    if not usable(asset):
        return False
    b = fp(asset, x, z, yaw)
    pts = [(x, z), (b[0], b[1]), (b[2], b[1]), (b[2], b[3]), (b[0], b[3])]
    vstat['try'] = vstat.get('try', 0) + 1
    if any(route_d(q) < VERGE_MIN for q in pts):
        vstat['rej-lane'] = vstat.get('rej-lane', 0) + 1
        return False
    # A prop never stands under a tree crown core (Scene Lab static clipping: placement x tree geometry).
    for ob, k in neighbours(b, 1):
        if k == 'tree':
            ix, iz = (ob[2] - ob[0]) * .3, (ob[3] - ob[1]) * .3
            if box_gap(b, (ob[0] + ix, ob[1] + iz, ob[2] - ix, ob[3] - iz)) < .15:
                vstat['rej-tree'] = vstat.get('rej-tree', 0) + 1
                return False
    zone = x < -512 and abs(z) < 22
    if not put(asset, x, z, yaw, decay=decay, zone=zone):
        vstat['rej-ok'] = vstat.get('rej-ok', 0) + 1
        return False
    l.data['placements'][-1]['verge'] = True
    vstat['n'] += 1
    return True


def vput(asset, P, t, o, yaw, decay=None):
    """Tries the nominal spot, then pushes outward (up to +1.8 m, never past 7.5 m) and slides along the lane, until the lane and neighbour rules pass."""
    for dt in (0, 1.6, -1.6):
        for do in (0, .6, 1.2, 1.8):
            if o + do <= 7.5 and vput1(asset, *P(t + dt, o + do), yaw, decay):
                return True
    return False


WRECKS = [w for w in WRECKS if usable(w[0]) and (w[1] is None or w[1] in M[w[0]].get('decayVariants', []))]
RUBBLE = [a for a in RUBBLE if usable(a)]
print('verge assets', [w[0] for w in WRECKS], RUBBLE)


def vignette(kind, a, ux, uz, nx, nz, s, hw, side):
    yaw = -math.atan2(uz, ux)
    P = lambda t, o: (a[0] + ux * t + nx * side * (hw + o), a[1] + uz * t + nz * side * (hw + o))
    if kind == 'wreck':
        asset, dec = RV.choice(WRECKS)
        d = M[asset]['dimensions']
        o = VERGE_MIN + .4 + max(d['x'], d['z']) * RV.uniform(.2, .45) + RV.uniform(0, 1.5)
        # pushed to the side: mostly nose-in toward the verge, a little skew
        if vput(asset, P, s, o, yaw + RV.choice([0, math.pi, math.pi / 2, -math.pi / 2]) + RV.uniform(-.5, .5), dec):
            vstat['wreck'] += 1
            for _ in range(RV.randint(0, 2)):
                if vput(RV.choice(RUBBLE), P, s + RV.uniform(-3, 3), RV.uniform(3.2, 6), RV.uniform(0, math.tau)):
                    vstat['rubble'] += 1
    elif kind == 'rubble':
        for _ in range(RV.randint(2, 4)):
            if vput(RV.choice(RUBBLE), P, s + RV.uniform(-2.5, 2.5), RV.uniform(2.9, 5.5), RV.uniform(0, math.tau)):
                vstat['rubble'] += 1
    elif kind == 'fence':
        # broken run: panels along the lane with gaps, each skewed
        t = s - 4
        for _ in range(RV.randint(2, 4)):
            if RV.random() < .8 and vput(RV.choice(['prop.crowd-fence', 'prop.crowd-fence', 'prop.picket-fence', 'prop.privacy-fence']),
                                         P, t, RV.uniform(3.0, 4.2), yaw + (math.pi / 2 if RV.random() < .3 else 0) + RV.uniform(-.55, .55)):
                vstat['fence'] += 1
            t += RV.uniform(2.5, 4)
    elif kind == 'block':
        # leftover roadblock: jersey barriers and sandbags knocked sideways, a cone or a gate
        for k in range(RV.randint(1, 3)):
            asset = RV.choice(['prop.jersey-barrier', 'prop.jersey-barrier', 'prop.sandbag-pallet', 'prop.barricade', 'prop.checkpoint-gate', 'prop.traffic-cone'])
            if vput(asset, P, s + (k - 1) * RV.uniform(2.6, 3.6), RV.uniform(2.9, 4.6), yaw + RV.uniform(-.7, .7)):
                vstat['block'] += 1
    elif kind == 'lamp':
        if vput(RV.choice(['prop.street-lamp', 'prop.street-lamp', 'prop.street-sign', 'prop.utility-pole']), P, s, RV.uniform(2.9, 4.0), yaw + math.pi / 2 + RV.uniform(-.2, .2)):
            vstat['lamp'] += 1
        for _ in range(RV.randint(0, 2)):
            if vput(RV.choice(['prop.traffic-cone', 'prop.trash-bags', 'prop.crates']), P, s + RV.uniform(-2.5, 2.5), RV.uniform(3.0, 5.0), RV.uniform(0, math.tau)):
                vstat['rubble'] += 1
    else:   # dead scrub
        for _ in range(RV.randint(1, 3)):
            if vput(RV.choice(['prop.garden-bush', 'prop.garden-bush-small', 'prop.garden-bush-small']), P, s + RV.uniform(-2.5, 2.5), RV.uniform(3.0, 5.8), RV.uniform(0, math.tau)):
                vstat['bush'] += 1


VERGE_KINDS = [('wreck', 5), ('rubble', 4), ('fence', 2), ('block', 2), ('lamp', 2), ('bush', 2)]
for (pts, hw), gravel in zip(ROUTES, (False, True, True)):
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        ux, uz = (b[0] - a[0]) / d, (b[1] - a[1]) / d
        nx, nz = -uz, ux
        for side in (-1, 1):
            s = RV.uniform(3, 7)
            while s < d - 4:
                vignette(RV.choices([k for k, _ in VERGE_KINDS], [w for _, w in VERGE_KINDS])[0], a, ux, uz, nx, nz, s, hw, side)
                s += RV.uniform(7, 12)
stats.update({'verge-' + k: v for k, v in vstat.items()})
open('/private/tmp/claude-501/vstat.json', 'w').write(json.dumps(vstat))

# ---- look-l9 clean-up: open fork/merge gores and crown-in-solid overlaps --------------------------------------------
# T-E31-20: the APC rounding the (-450, 0) fork wedged on a utility pole + bush in the gore between the road and the dry
# shortcut. Drivers cut these corners, so the sectors between the diverging lanes stay free of anything with a collider,
# and trees whose crown cuts into another solid (Scene Lab static clipping: tree x pole, tree x lamp, tree in a garage) go.
GORE_R = 46


def in_gore(x, z):
    for nx, sx in ((-450, 1), (450, -1)):
        dx = (x - nx) * sx
        if dx > 0 and math.hypot(dx, z) < GORE_R and -80 < math.degrees(math.atan2(z, dx)) < 65:
            return True
    return False


def gone(i):
    p = l.data['placements'][i]
    name = 'inst:' + p['assetId'] + ':' + str(i + 1)
    for o in [o for o in l.empties if o.name == name or o.name.startswith('crown:' + p['id'] + ':')]:
        l.empties.remove(o)
        bpy.data.objects.remove(o, do_unlink=True)
    l.data['colliders'] = [c for c in l.data['colliders'] if c['id'] != p['id']]
    l.data['buildings'] = [b for b in l.data['buildings'] if b['id'] != p['id']]


solids = [q['visualAabb'] for q in l.data['placements'] if not q['assetId'].startswith(('prop.tree', 'prop.hedge', 'prop.garden-bush', 'kit.crossing-crash')) and q['visualAabb']['max'][1] > 1.2]
drop = []
for i, p in enumerate(l.data['placements']):
    x, z = p['position'][0], p['position'][2]
    # Keep the L9 departure shoulder clear for the APC's long swept hull. A shallow line correction at
    # (-473.5, 6) used to thread the tree/pole cluster immediately east of the start lane.
    if p['assetId'] in ('prop.tree', 'prop.utility-pole') and math.hypot(x + 473.5, z - 6.0) < 12.0:
        drop.append(i)
        continue
    if in_gore(x, z) and route_d((x, z)) > 0 and not p['assetId'].startswith(('kit.', 'bld.')):
        drop.append(i)
        continue
    if p['assetId'] == 'prop.tree':
        b = p['visualAabb']
        mx, mz = (b['max'][0] - b['min'][0]) * .18, (b['max'][2] - b['min'][2]) * .18
        crown = (b['min'][0] + mx, b['min'][2] + mz, b['max'][0] - mx, b['max'][2] - mz)
        if any(box_gap(crown, (a['min'][0], a['min'][2], a['max'][0], a['max'][2])) < 0 for a in solids):
            drop.append(i)
for i in reversed(drop):
    gone(i)
    del l.data['placements'][i]
stats['look-l9-removed'] = len(drop)
print('L9 dress:',dict(sorted(stats.items(), key=lambda kv: -kv[1])[:30]), 'placements', len(l.data['placements']))
