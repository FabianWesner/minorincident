"""Sunset Grove Avenues (E21 L3 "The Police Collapse"): the linear 344 x 92 m corridor district D-CORRIDOR.

Origin at the map centre, X east, Z south. The corridor runs WEST -> EAST: it continues L2's eastward escape over the river
bridge (the police bridgehead and Sunset Grove Police Station yard at the west end) to the army checkpoint at the highway
on-ramp at the east end. Three parallel streets run the whole way:

    Grove Boulevard  z = -28  (main road, 7 m carriageway: shops and big frontages, wrecks and the traffic jam)
    Commerce Street  z =   0  (shopping street: shop rows on both sides; it runs through the station yard and the army gate)
    Oak Avenue       z = +28  (residential: houses on fenced lots on both sides)

Cross-links between neighbouring streets every <= 45 m: Station Road (x = -120), Elm Cross (x = -55), Pine Cross (x = 40) and
On-ramp Road (x = 128) are full streets; three mid-block alleys (x = -90, -15, 85) pass between the rows. Every edge is closed by
visible geometry: the river and bridge gate (west), rear lot fences (north/south), T-walls and the on-ramp (east).

W2/W3 damage comes from the building variants authored here (per placement `decay`); wrecks, fires, corpses, glass, signs and
barricades are the TS dressing manifest of src/levels/L3/layout.ts (static AC15 test). Gameplay points live in src/data/l3.ts.
"""
import math
from sslib.layout import Layout
from sslib import l1_dressing as D
from sslib.grove_dressing import Grove, FACE_YAW, rot
from sslib import grove_dressing as G

PI = math.pi
W, DEPTH = 496, 92
l = Layout('D-CORRIDOR', 'Sunset Grove Avenues', size=(W, DEPTH))
l.data['bounds'] = [[-172, -46], [248, -46], [248, 46], [-172, 46], [-172, -46]]
l.yaw_matches_collision = True
g = Grove(l)
dims = g.dims

# ------------------------------------------------------------------------------------------------ streets
ZB, ZC, ZO = -28, 0, 28                 # Grove Boulevard / Commerce Street / Oak Avenue
XS, XE = -120, 128                      # Station Road / On-ramp Road
XA, XB = -55, 40                        # Elm Cross / Pine Cross
ALLEYS = (-90, -15, 85)
XR = -166.0                             # river bank (water west of it)
ROADS = [
    dict(id='blvd', a=(-164, ZB), b=(XE, ZB), w=7, kind='road'),
    dict(id='commerce', a=(-172, ZC), b=(172, ZC), ga=(-158.5, ZC), gb=(133.0, ZC), w=5, kind='road'),   # graph ends clear of the bridge and the army gate
    dict(id='oak', a=(-164, ZO), b=(XE, ZO), w=5, kind='road'),
    dict(id='station-rd', a=(XS, ZB), b=(XS, ZO), w=5, kind='road'),
    dict(id='onramp-rd', a=(XE, ZB), b=(XE, ZO), w=5, kind='road'),
    dict(id='elm-x', a=(XA, ZB), b=(XA, ZO), w=5, kind='road'),
    dict(id='pine-x', a=(XB, ZB), b=(XB, ZO), w=5, kind='road'),
] + [dict(id=f'alley-{i}', a=(x, ZB + 5.5), b=(x, ZO - 4.5), w=3, kind='alley') for i, x in enumerate(ALLEYS)]
g.roads(ROADS)
for cx in (XS, XA, XB, XE):
    for cz in (ZB, ZC, ZO):
        g.crosswalk(cx + 4.6, cz, 0)

doors = []          # refuge doors (pavement in front of each building door)
anchors = {}
SHOP_TINTS = ['#ffe9c8', '#e8f0ff', '#ffe0d6', '#e9f7e4']
HOUSE_TINTS = ['#ffe58f', '#bfe8c8', '#b3d7f5', '#ffb8a3', '#d3dfae', '#fff6e6', '#d9c8f2']
_t = [0]
def tint(pool):
    _t[0] += 1
    return pool[(_t[0] * 3) % len(pool)]

def decay_of(i, street):
    """W2 on most frontages, W3 on every third (Commerce and the Boulevard are hit harder than Oak)."""
    k = {'oak': 3, 'commerce': 2, 'blvd': 2}[street]
    return 'w3' if i % k == 0 else 'w2'

def set_decay(pid, decay):
    if pid is None: return
    for p in reversed(l.data['placements']):
        if p['id'] == pid:
            if decay in l.manifest[p['assetId']].get('decayVariants', []): p['decay'] = decay
            return

def lots(x0, x1, outer=False):
    """Lot ranges of one row side between x0 and x1, cut at the cross streets and alleys (outer rows: only the end roads)."""
    cuts = [(XS, 4.6), (XE, 4.6)] + ([] if outer else [(XA, 4.6), (XB, 4.6)] + [(a, 2.1) for a in ALLEYS])
    out, start = [], x0
    for c, half in sorted(cuts):
        if c - half <= start or c + half >= x1:
            if c - half < start < c + half: start = c + half
            continue
        out.append((start, c - half)); start = c + half
    if x1 - start > 3: out.append((start, x1))
    return out

# ------------------------------------------------------------------------------------------------ shop rows
SHOPS = [('bld.mainstreet-brick', 1.0), ('bld.joes-diner', 1.0), ('bld.maple-hardware', 1.0)]
# Rows on the camera side of a street (their fronts face north, toward the street and away from the camera) stay low so the
# game camera, which looks from the south-east, sees the carriageway over them (pharmacies, a supermarket, the corner cafe).
LOW_SHOPS = [('bld.pharmacy', 1.0), ('bld.supermarket', 1.0), ('bld.pharmacy', 1.0), ('bld.cafe-corner', 1.0)]
LOW_BLVD = [('bld.cafe-corner', 1.0), ('bld.pharmacy', 1.0)]
def shop_row(street, x0, x1, facing, line, rear, assets=SHOPS, gap=.1, seed=0, outer=False):
    """Shops facing N or S with their front on `line`, side by side. `rear`: z of the back line. The row is one solid
    terrace: brick party walls fill the slots between the shops' collision footprints and the lot ends, and a low brick
    back-yard wall block fills each shop's strip to the rear line, so no hidden pocket or slot is walkable behind a row."""
    sgn = 1 if facing == 'N' else -1          # direction from the front line into the lot (z)
    yaw = FACE_YAW[facing]
    front = line + sgn * .3
    placed = []
    for lx0, lx1 in lots(x0, x1, outer):
        x, k, prints = lx0 + .4, seed, []
        while True:
            asset, scale = assets[k % len(assets)]
            depth, _, width = dims(asset)
            if x + width * scale > lx1 - .3:
                # a narrower one still fits?
                fit = [a for a in assets if x + dims(a[0])[2] * a[1] <= lx1 - .3]
                if not fit: break
                asset, scale = fit[0]; depth, _, width = dims(asset)
            cx, cz = x + width * scale / 2, line + sgn * (depth * scale / 2 + .3)
            boxes = [b for b in g.footprint(asset, cx, cz, yaw, (scale, scale, scale)) if b[4] > 1.0]
            pid = g.place(asset, cx, cz, yaw, scale, tint=tint(SHOP_TINTS))
            if pid:
                set_decay(pid, decay_of(len(placed), street))
                placed.append((cx, cz, asset, width * scale))
                doors.append((cx, line - sgn * .9))
                xs0, xs1 = min(b[0] for b in boxes), max(b[2] for b in boxes)
                back = max(b[3] for b in boxes) if sgn > 0 else min(b[1] for b in boxes)
                prints.append((xs0, xs1, back))
            x += width * scale + gap; k += 1
        seed += 1
        if not prints: continue
        # party walls between neighbouring footprints (narrow slots); a wider gap at a lot end gets a fence across the
        # frontage and one down the lot line instead (the notch behind it is closed, never a walkable pocket)
        edges = [(lx0, prints[0][0])] + [(a[1], b[0]) for a, b in zip(prints, prints[1:])] + [(prints[-1][1], lx1)]
        za, zb = sorted((front, rear))
        for e0, e1 in edges:
            if e1 - e0 <= .02: continue
            if e1 - e0 <= 1.4:
                g.solid('party-wall', 'brick', [e1 - e0 + .04, 3.0, zb - za], [(e0 + e1) / 2, 1.5, (za + zb) / 2])
            else:
                # clear of the neighbour's visual box too (eaves and signs overhang its collision footprint)
                g.fence('privacy', e0 + .5, front + sgn * .2, e1 - .5, front + sgn * .2)
                g.fence('privacy', lx0 + .15 if e0 <= lx0 + .01 else lx1 - .15, za, lx0 + .15 if e0 <= lx0 + .01 else lx1 - .15, zb)
        # overgrown back gardens between each footprint's back and the rear line (low shrub mass, not walkable)
        for xs0, xs1, back in prints:
            a0, a1 = sorted((back, rear))
            if a1 - a0 > .05:
                g.solid('back-garden', 'foliageDark', [xs1 - xs0 + .04, .7, a1 - a0 + .04], [(xs0 + xs1) / 2, .35, (a0 + a1) / 2])
    return placed

# ------------------------------------------------------------------------------------------------ house rows
HOUSE = {  # kind -> (asset, scale, door local x, door local z)   (as D-GROVE)
    'a': ('bld.house-a', 1.0, 4.1, -1.6),
    'c': ('bld.house-c', .8, 5.6 * .8 + .3, -1.25 * .8),
    'd': ('bld.house-d', .8, 4.1 * .8 + .25, 0.0),
    'e': ('bld.house-e', .85, 4.7 * .85 + .2, 0.0),
}
KINDS = ['a', 'd', 'e', 'c', 'e', 'a', 'd', 'c']
def house_row(x0, x1, facing, line, rear, seed=0, outer=False):
    """Houses on fenced lots facing N or S: picket front fence with a gap at the door path, privacy fences on lot lines and the
    rear line, lawns and a tree behind. Fewer garden toys than L1: the gardens are trampled (W2/W3)."""
    sgn = 1 if facing == 'N' else -1
    yaw = FACE_YAW[facing]
    out = []
    for lx0, lx1 in lots(x0, x1, outer):
        span = lx1 - lx0
        ks, widths = [], []
        k = seed
        while True:
            kk = KINDS[k % len(KINDS)]; w = dims(HOUSE[kk][0])[2] * HOUSE[kk][1]
            if sum(widths) + w + 2.4 * (len(widths) + 1) > span: break
            ks.append(kk); widths.append(w); k += 1
        seed = k
        if not ks: continue
        slack = (span - sum(widths)) / len(ks)
        edges = [lx0]
        for w in widths: edges.append(edges[-1] + w + slack)
        za, zb = sorted((line + sgn * .15, rear))
        for i, bx in enumerate(edges):
            if i in (0, len(ks)) or i % 2 == 0: g.fence('privacy', bx, za, bx, zb)
            else: g.hedge(bx, za, bx, zb, scale=1.15)
        g.fence('privacy', lx0, rear, lx1, rear)
        for i, (kk, w) in enumerate(zip(ks, widths)):
            asset, scale, dxd, dzd = HOUSE[kk]
            depth = dims(asset)[0] * scale
            cx = (edges[i] + edges[i + 1]) / 2
            hz = line + sgn * (1.0 + depth / 2)
            pid = g.place(asset, cx, hz, yaw, scale, tint=tint(HOUSE_TINTS))
            set_decay(pid, decay_of(len(out), 'oak'))
            ox, oz = rot(yaw, dxd, dzd)
            door = (cx + ox, hz + oz)
            doors.append((door[0], line - sgn * .5))
            g.fence('picket', edges[i] + .2, line + sgn * .25, edges[i + 1] - .2, line + sgn * .25, gaps=[(door[0], 1.7)])
            g.path(door[0] - .6, door[1], door[0] + .6, line + sgn * .1)
            g.lawn(edges[i] + .3, min(line, line + sgn * 1.0), edges[i + 1] - .3, max(line, line + sgn * 1.0))
            bz = (hz + sgn * depth / 2 + rear) / 2
            if abs(rear - (hz + sgn * depth / 2)) > 2.2:
                g.place('prop.street-tree' if i % 2 else 'prop.street-tree-blossom', cx + (1.4 if i % 2 else -1.4), bz, 0, .75, soft=True)
            out.append((cx, hz, door))
    return out

# Block geometry (see the module doc): sidewalk inner edges
BN, BS = ZB - 5.5, ZB + 5.5            # -33.5 / -22.5
CN, CS = ZC - 4.5, ZC + 4.5            # -4.5 / 4.5
ON, OS = ZO - 4.5, ZO + 4.5            # 23.5 / 32.5
EAST = XE - 4.6

# North of the Boulevard: big frontages facing south (behind the street from the camera).
NORTH = [('bld.maple-hardware', 1.0), ('bld.mainstreet-brick', 1.0), ('bld.supermarket', 1.0), ('bld.joes-diner', 1.0), ('bld.pharmacy', 1.0), ('bld.mainstreet-brick', 1.0)]
shop_row('blvd', XS + 4.6, EAST, 'S', BN, -45.3, NORTH, seed=0, outer=True)
g.fence('privacy', XS + 4.6, -45.6, EAST, -45.6)
# Block N: Boulevard south side (facing N) back to back with Commerce north side (facing S); one service fence between.
shop_row('blvd', XS + 4.6, EAST, 'N', BS, -13.7, LOW_BLVD, seed=1)
shop_row('commerce', XS + 4.6, EAST, 'S', CN, -13.3, SHOPS, seed=2)
for lx0, lx1 in lots(XS + 4.6, EAST):
    g.fence('privacy', lx0 + .3, -13.5, lx1 - .3, -13.5)
# Block S: Commerce south side (facing N) back to back with Oak north houses (facing S).
shop_row('commerce', XS + 4.6, EAST, 'N', CS, 14.2, LOW_SHOPS, seed=0)
house_row(XS + 4.6, EAST, 'S', ON, 14.4, seed=0)
# South of Oak: houses facing north.
house_row(XS + 4.6, EAST, 'N', OS, 45.5, seed=3, outer=True)

# ------------------------------------------------------------------------------------------------ the station yard (west)
YX0, YX1, YZ0, YZ1 = -160.0, -126.0, -22.0, 22.0
st = 'bld.police-station'
sdx, sdy, sdz = dims(st)
ST_X, ST_Z = -148.0, -12.7             # faces east along the yard; south wall on the Commerce sidewalk line
spid = g.place(st, ST_X, ST_Z, FACE_YAW['E'])
l.data['buildings'].append(dict(id=spid, assetId=st, aabb=l.data['placements'][-1]['visualAabb'], label='Sunset Grove Police'))
doors.append((ST_X + sdx / 2 + 1.0, ST_Z - 3.0))
# Yard fence with four openings: Commerce (east, to the corridor), Boulevard side gate (north-east), Oak side gate (south-east)
# and the river-path gate (north-west, between the station and the river).
G.security_fence(g, YX0, YZ0, YX1, YZ0, gaps=[(-157.0, 3.6), (-132.0, 4.0)])
G.security_fence(g, YX0, YZ1, YX1, YZ1, gaps=[(-132.0, 4.0)])
G.security_fence(g, YX1, YZ0, YX1, -5.0)
G.security_fence(g, YX1, 5.0, YX1, YZ1)
G.security_fence(g, YX0, YZ0, YX0, -5.0)
G.security_fence(g, YX0, 5.0, YX0, YZ1)
g.path(-148.0, 4.5, -128.0, 20.0, 'asphalt')               # parking apron south of Commerce
g.path(ST_X + sdx / 2, -4.5, -128.0, -20.0, 'sidewalk')    # forecourt in front of the station
# Bridge gate (closed behind the player): the L2 checkpoint seen from the inside.
g.collide_only('bridge-gate', [.3, 2.2, 10.6], [-161.0, 1.1, 0.0])
for z in (-3.4, 0.0, 3.4):
    g.place('prop.barricade', -160.4, z, 0.0, 1.0, soft=True)
g.place('bld.river-bridge', -167.0, 0.0, 0.0, (.7, 1.0, 1.0), check=False, y=-3.03)
for z in (-22.0, 22.0):
    g.fence('privacy', XR + .7, z, YX0, z)
# the river: water west of the bank, a low parapet as the visible edge
l.box('river', 'denim', [6.0, .05, DEPTH], [XR - 3.0, -.02, 0.0])
for z0, z1 in ((-45.2, -6.4), (6.4, 45.2)):
    g.solid('parapet', 'sidewalk', [.5, .9, z1 - z0], [XR + .25, .45, (z0 + z1) / 2])
# River path: the bank walk north of the Boulevard (one of the three attack directions), a boathouse at its far end.
g.path(-165.5, -46.0, -161.5, -33.0, 'sidewalk')
g.place('bld.shed', -152.0, -41.0, FACE_YAW['W'], 1.0)
for z in (-44.0, -38.0):
    g.place('prop.street-tree', -158.0, z, 0, .9, soft=True)
g.hedge(-150.0, -34.2, -125.2, -34.2, scale=1.15)
g.fence('privacy', -165.2, -45.6, -124.9, -45.6)
g.lawn(-160.0, -45.0, -124.0, -34.5)
# Oak's west end: the riverside lawn and the station car park hedge
g.hedge(-162.0, 33.4, -125.2, 33.4, scale=1.15)
g.fence('privacy', -165.2, 45.6, -124.9, 45.6)
g.lawn(-162.0, 34.0, -124.0, 45.0)
for x in (-154.0, -140.0, -130.0):
    g.place('prop.street-tree-blossom', x, 40.0, 0, .9, soft=True)

# ------------------------------------------------------------------------------------------------ army checkpoint (east)
AX = 212.0                               # T-wall line; the army zone lies east of it
kit = 'kit.army-checkpoint'
kdx, kdy, kdz = dims(kit)
g.place(kit, AX + kdx / 2, ZC, 0.0, 1.0, check=False)
# Concrete T-walls (3.4 m) sealing the rest of the line, sandbag nests in front.
for z0, z1 in ((-46.0, -4.45), (4.45, 46.0)):   # flush with the kit's own T-wall lines (z = +-4.4)
    n = int((z1 - z0) / 1.6)
    for i in range(n):
        zc = z0 + (i + .5) * (z1 - z0) / n
        g.solid('t-wall', 'sidewalk', [.5, 3.4, (z1 - z0) / n - .08], [AX + .25, 1.7, zc])
        l.box('t-wall-foot', 'sidewalk', [1.4, .35, (z1 - z0) / n - .08], [AX + .55, .17, zc])
    for zc in (z0 + 4.0, (z0 + z1) / 2, z1 - 4.0):
        g.place('prop.sandbag-pallet', AX - 1.3, zc, 0.0, 1.0, soft=True)
# razor wire in front of the walls (low silver coils on stakes)
for z0, z1 in ((-44.0, -kdz / 2 - 1.2), (kdz / 2 + 1.2, 44.0)):
    z = z0
    while z < z1:
        D.ring(l, 'razor-wire', 'silver', .38, .03, [AX - 2.6, .4, z], vertical=True)
        z += .9
    g.collide_only('razor-wire', [.8, .9, z1 - z0], [AX - 2.6, .45, (z0 + z1) / 2])
g.path(AX, -4.0, 248.0, 4.0, 'uiDark')
g.fence('privacy', AX + .6, -45.6, 248.0, -45.6)
g.fence('privacy', AX + .6, 45.6, 248.0, 45.6)
# PO 10-11: the final approach crosses the highway before entering the relocated base.
g.place('kit.highway-onramp', 155.5, 0.0, PI, 1.0, check=False)
g.place('kit.highway-onramp', 191.5, 0.0, 0.0, 1.0, check=False)
# Q-133 / Q-129: the deck, the wedges and the paint are flat, unbevelled slabs (g.solid boxes carry a 7 cm toy bevel: every top edge
# was a chamfer ridge, read as a lighter patch with hard edges and as a dark seam where two boxes met). One top height for all of them,
# 3 mm over the kit road (5.70) so nothing z-fights, paint 16 mm above that like the kit's own (1.9 cm over 5.70).
import bpy
from sslib.layout import material as _material
DECK_TOP, PAINT = 5.703, .016


def slab(name, token, pts, top, thick):
    """Extruded polygon (x, z points in game metres), flat top at `top`, no bevel; same merge path as Layout.box."""
    area = sum(a[0] * -b[1] - b[0] * -a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
    ring = pts if area > 0 else pts[::-1]
    n = len(ring)
    verts = [(x, -z, top) for x, z in ring] + [(x, -z, top - thick) for x, z in ring]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, i + n, (i + 1) % n + n, (i + 1) % n) for i in range(n)]
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.update()
    o = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(o)
    o.data.materials.append(_material(token)); l.layers[0].append(o)
    return o


def strip(name, token, a, b, width, top):
    """A paint band of `width` between two points on the deck plane."""
    dx, dz = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dz); nx, nz = -dz / d * width / 2, dx / d * width / 2
    return slab(name, token, [(a[0] + nx, a[1] + nz), (b[0] + nx, b[1] + nz), (b[0] - nx, b[1] - nz), (a[0] - nx, a[1] - nz)], top, PAINT)


slab('highway-deck', 'asphalt', [(167.5, -2.31), (179.5, -2.31), (179.5, 2.31), (167.5, 2.31)], DECK_TOP, .5)
# PO P1-113: each ramp's road ends on a line tilted ~48 deg while the span ends square, leaving a dark wedge beside the joint rail
# (x 179.5-181.3 at z<0 east, mirrored west). Fill exactly that quad, 5 cm into the deck and the road (collision: l3-highway-wedge in levels/L3/layout.ts).
EAST_HOLE = [(179.45, 0.0), (181.25, -1.55), (181.45, -1.75), (179.45, -2.4)]
slab('highway-wedge', 'asphalt', EAST_HOLE, DECK_TOP, .5)
slab('highway-wedge', 'asphalt', [(347.0 - x, -z) for x, z in EAST_HOLE], DECK_TOP, .5)
# Lane paint of the deck, the kit's own bands (assets/kit.highway-onramp/build.py: yellow edge lines +-1.895..2.025, a 5 cm centre dash
# every 1.043 m, dash .5 m long) kept between the two kits' tilted road ends (x 169.3-177.7) and joined to the kit's edge lines across the wedges.
top = DECK_TOP + PAINT
for z in (-1.96, 1.96):
    strip('highway-edge-line', 'schoolBusYellow', (169.3, z), (177.7, z), .13, top)
for k in range(8):
    x0 = 169.45 + k * 1.043
    strip('highway-centre-dash', 'picketWhite', (x0, 0), (x0 + .5, 0), .05, top)
for z, (ex, ez), (ox, oz) in ((-1.96, (180.97, -1.30), (179.5, -1.96)), (1.96, (166.03, 1.30), (167.5, 1.96))):
    strip('highway-edge-line', 'schoolBusYellow', (ox, oz), (ex, ez), .13, top)
for side in (-1, 1):
    g.solid('highway-jersey', 'sidewalk', [12.0, .95, .5], [173.5, 6.175, side * 2.58])
    g.fence('privacy', 132.7, side * 10.5, AX, side * 10.5)
    g.fence('privacy', 132.7, side * 10.5, 132.7, side * 4.5)
g.fence('privacy', 247.4, -45.6, 247.4, 45.6)
g.fence('privacy', 143.0, 12.0, 204.0, 12.0)
g.path(128, -4.0, AX, 4.0, 'asphalt')
# Short sloped lips meet the low ends of the existing ramp (deck top .70 m).
for i in range(14):
    h = (i + 1) * .05
    for x in (139.3 + i * .3, 207.7 - i * .3):
        g.solid('highway-lip', 'asphalt', [.31, h, 4.62], [x, h / 2, 0], collide=False)
for x in (136, 174, 207):
    g.place('prop.street-lamp', x, -4.0, 0, 1, soft=True)

# ------------------------------------------------------------------------------------------------ north/south/east edges
# rear fences of the outer rows already close z = +-45; close the strips between the rows and the bounds at the street ends
for x in (XS - 4.6, ):
    g.fence('privacy', x, -45.6, x, BN - .4)
for x in (XE + 4.6, ):
    g.fence('privacy', x, -45.6, x, BN - .4)
    g.fence('privacy', x, OS + .4, x, 45.6)
g.fence('privacy', XS - 4.6, OS + .4, XS - 4.6, 45.6)
for xa, xb in ((XS - 4.6, XS + 4.6), (EAST, XE + 4.6)):
    g.fence('privacy', xa, -45.6, xb, -45.6)
    g.fence('privacy', xa, 45.6, xb, 45.6)

# ------------------------------------------------------------------------------------------------ kerb lamps and signs
for r in g.road_list:
    if r['kind'] != 'road' or r['ax'] != 0: continue
    z = r['a'][1]
    x = -116.0
    while x < 124.0:
        for side in (-1, 1):
            p = x + (7 if side > 0 else 0)
            if any(abs(p - c) < 6.5 for c in (XS, XA, XB, XE)): continue
            g.place('prop.street-lamp', p, z + side * (r['w'] / 2 + .5), 0, 1.0, soft=True)
        x += 16.0
for cx in (XS, XA, XB, XE):
    for cz in (ZB, ZO):
        g.place('prop.street-sign', cx + 3.5, cz + (3.5 if cz > 0 else -4.0), 0, .8, soft=True)
        g.place('prop.fire-hydrant', cx - 3.5, cz + (3.5 if cz > 0 else -4.0), 0, .8, soft=True)

# ------------------------------------------------------------------------------------------------ anchors
for i, d in enumerate(sorted(doors), 1):
    anchors[f'refuge-door-{i}'] = d
# Ramp emergence points extend the same out-of-view encounter system onto the highway.
for x in (146, 174, 199):
    doors.append((x, 0))
for i, d in enumerate(sorted(doors), 1):
    anchors[f'refuge-door-{i}'] = d
anchors['player-start'] = (-155.5, 1.6)
anchors['edge-in-1'] = (-163.0, -44.0)       # river path north end
anchors['edge-in-2'] = (XE + 2.0, ZB)        # Boulevard east end (behind the barrier line, outside the zone)
anchors['edge-in-3'] = (XE + 2.0, ZO)
for name, (x, z) in anchors.items():
    l.anchor(name, [x, 0, z])

for _m in G.clear_contacts(g): print('clearance', *_m)
from pathlib import Path
out = Path(__file__).resolve().parents[2] / '.cache/layouts'
out.mkdir(parents=True, exist_ok=True)
(out / 'D-CORRIDOR.problems.txt').write_text('\n'.join(g.problems) + '\n')
l.export()
