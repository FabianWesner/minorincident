"""Sunset Grove (L1 v2): the compact 170 x 110 m starting district, origin at map centre (X east, Z south).

Grid of chibi streets (5 m carriageway, 2 m sidewalks) with mid-block alleys: Maple Corner (café, bus stop, rack) in the
west, Main Row shops with the Sunset Grove Courier depot in the north-west, the Juniper Lane blocks in the centre, the
Sunset Grove Medical Annex compound in the east, Elm Street (Henderson garage) in the south, Sunny Suds car wash + Sunset Fuel
and Fire Station 3 in the south-west. Houses sit on fenced lots; fences run on lot lines, gates at paths, lamps on the kerb
line; every map edge is closed by a visible fence/treeline or a road-work barrier.

Lane A authoring: tools/blender/sslib/grove_dressing.py. Gameplay tuning stays in src/levels/districts/D-GROVE.ts and
src/data/l1v2.ts. Models face +X at yaw 0 (see FACE_YAW); placeholder hero boxes get door-gap shells until B's GLBs land.
"""
import math
import random
from sslib.layout import Layout
from sslib import l1_dressing as D
from sslib.grove_dressing import Grove, FACE_YAW, rot

PI = math.pi
l = Layout('D-GROVE', 'Sunset Grove', size=(170, 110))
g = Grove(l)
rng = random.Random(19)
dims = g.dims

# ------------------------------------------------------------------------------------------------ streets
ZN, Z0, ZS = -31, 0, 30            # Main Row / Maple-Larch axis / Elm Street
XW, X2, X3, X4 = -64, -30, 14, 50  # Maple St / Juniper west / Juniper east / Larch St
E = 4.5                            # road centre line to sidewalk inner edge
ROADS = [
    dict(id='main', a=(-85, Z0), b=(85, Z0), ga=(-80.4, Z0), gb=(80.4, Z0), w=5, kind='road'),
    dict(id='row', a=(-85, ZN), b=(X4, ZN), ga=(-80.4, ZN), w=5, kind='road'),
    dict(id='elm', a=(-85, ZS), b=(85, ZS), ga=(-80.4, ZS), gb=(80.4, ZS), w=5, kind='road'),
    dict(id='maple', a=(XW, ZN), b=(XW, ZS), w=5, kind='road'),
    dict(id='junw', a=(X2, -53), b=(X2, 53), ga=(X2, -50.0), gb=(X2, 50.0), w=5, kind='road'),
    dict(id='june', a=(X3, -53), b=(X3, 53), ga=(X3, -50.0), gb=(X3, 50.0), w=5, kind='road'),
    dict(id='larch', a=(X4, ZN), b=(X4, 53), gb=(X4, 50.0), w=5, kind='road'),
    dict(id='alley-r0', a=(XW, -15.5), b=(X4, -15.5), w=3, kind='alley'),
    dict(id='alley-r1', a=(XW, 15.0), b=(82, 15.0), w=3, kind='alley'),
    dict(id='alley-n', a=(-82, -48.5), b=(48, -48.5), w=3, kind='alley'),
    dict(id='alley-s', a=(-82, 48.0), b=(82, 48.0), w=3, kind='alley'),
]
g.roads(ROADS)
# zebra stripes at the corners that matter: Maple Corner, the annex junction, Juniper/Elm
for cx, cz in [(XW, Z0), (X4, Z0), (X3, ZS), (X2, Z0)]:
    g.crosswalk(cx + 4.0, cz, 0)      # across the south arm... drawn on the east arm of the junction
    g.crosswalk(cx, cz - 4.0, 1)
# tidy details on the carriageways: manholes and drains
for x, z in [(-48, 1.0), (-8, -1.0), (30, 1.0), (68, -1.0), (-20, 29.0), (35, 31.0), (-64, -12), (50, 12)]:
    D.sphere(l, 'manhole-cover', 'denim', .43, [x, .062, z], (1, .04, 1))
    D.ring(l, 'manhole-rim', 'uiDark', .4, .028, [x, .068, z])
    for dx in (-.2, 0, .2): l.box('manhole-grid', 'uiDark', [.035, .012, .55], [x + dx, .087, z])
for x in range(-80, 81, 10):
    for z in (Z0 - 2.3, Z0 + 2.3, ZS - 2.3, ZS + 2.3, ZN + 2.3, ZN - 2.3):
        if abs(x - XW) < 4 or abs(x - X2) < 4 or abs(x - X3) < 4 or abs(x - X4) < 4: continue
        if z == ZN + 2.3 or z == ZN - 2.3:
            if x > X4: continue
        l.box('drain', 'uiDark', [.65, .012, .27], [x + 3, .063, z])
        for k in range(5): l.box('drain-bars', 'denim', [.035, .015, .25], [x + 3 - .25 + k * .12, .075, z])

anchors = {}                      # name -> (x, z)
cars = []                         # (x, z, block) for alarm car selection
doors = []                        # refuge door positions
CAR_POOL = ['veh.sedan-red', 'veh.sedan-blue', 'veh.suv-dark', 'veh.pickup-red', 'veh.sedan-white', 'veh.suv-green', 'veh.sedan-green', 'veh.pickup-white']
_ci = [0]
def next_car():
    _ci[0] += 1
    return CAR_POOL[_ci[0] % len(CAR_POOL)]

# ------------------------------------------------------------------------------------------------ house rows
HOUSE = {  # kind -> (asset, scale, door local x, door local z)
    'a': ('bld.house-a', 1.0, 4.1, -1.6),
    'b': ('bld.house-b', 1.0, .2, 5.9),
    'c': ('bld.house-c', .8, 5.6 * .8 + .3, -1.25 * .8),
    'd': ('bld.house-d', 1.0, dims('bld.house-d')[0] / 2 + .9, 0.0),
    'e': ('bld.house-e', 1.0, dims('bld.house-e')[0] / 2 + .9, 0.0),
}
def kind(k):
    asset = HOUSE[k][0]
    if g.placeholder(asset):  # side-tier placeholders fall back to a delivered house until B's model lands
        k = 'a'
    return k

def planter(x, z):
    if not g.fits([(x - .6, z - .3, x + .6, z + .3, .5)], .1):
        return
    D.planter(l, x, z)
    g.solids.append((f'planter@{x:.1f},{z:.1f}', x - .6, z - .3, x + .6, z + .3, .5, f'planter{x:.1f},{z:.1f}'))

def row(name, x0, x1, facing, line, rear, kinds, drives=None, gate_at=None):
    """One side of a block. facing: direction the houses face (N/S); line: z of the lot front line (sidewalk inner edge);
    rear: z of the rear (alley) fence. Lots are as wide as their house plus an equal share of the slack. Fences run on lot
    lines (privacy / tall hedge); the front picket fence has gaps at the door path and driveway; the rear fence closes the alley."""
    n = len(kinds)
    ks = [kind(k) for k in kinds]
    widths = [dims(HOUSE[k][0])[2] * HOUSE[k][1] for k in ks]
    slack = (x1 - x0 - sum(widths)) / n
    edges = [x0]
    for w in widths: edges.append(edges[-1] + w + slack)
    sgn = 1 if facing == 'N' else -1           # direction from the front line into the lot (z)
    yaw = FACE_YAW[facing]
    drives = drives or [0] * n
    out = []
    for i, bx in enumerate(edges):
        if abs(abs(bx) - 83.6) < .5: continue
        za, zb = sorted((line + sgn * .15, rear))
        if i % 2 == 0 or i in (0, n):
            g.fence('privacy', bx, za, bx, zb)
        else:
            g.hedge(bx, za, bx, zb, scale=1.15)
    # rear fence along the alley edge; yard gates (F) sit in the gaps left here
    g.fence('privacy', x0, rear, x1, rear, gaps=[(gate_at, 1.9)] if gate_at is not None else [])
    for i, (k, w) in enumerate(zip(ks, widths)):
        asset, scale, dx_door, dz_door = HOUSE[k]
        depth = dims(asset)[0] * scale
        lx0, lx1 = edges[i], edges[i + 1]; lot_w = lx1 - lx0; cx = (lx0 + lx1) / 2
        side_door = abs(dz_door) > 3          # house-b: the entry is on the side, towards a clear side yard
        d = 0 if side_door else drives[i]
        free = lot_w - w - .7
        lat = rot(yaw, dx_door, dz_door)[0]   # lateral world offset of the door from the house centre
        if side_door:
            shift = -math.copysign(lot_w / 2 - w / 2 - .7, lat)
        else:
            shift = 0.0 if not d else -d * (lot_w / 2 - w / 2 - .7)
        hx = cx + shift
        hz = line + sgn * (1.0 + depth / 2)
        g.place(asset, hx, hz, yaw, scale)
        ox, oz = rot(yaw, dx_door, dz_door)
        door = (hx + ox, hz + oz)
        doors.append(door)
        out.append(dict(x=hx, z=hz, door=door, lot=(lx0, lx1)))
        # front picket fence with a gap at the door path and one at the driveway
        gaps = [(door[0], 1.7)]
        carx = None
        if d:
            carx = (lx1 - free / 2) if d > 0 else (lx0 + free / 2)
            gaps.append((carx, min(3.2, free - .2)))
        g.fence('picket', lx0 + .2, line + sgn * .25, lx1 - .2, line + sgn * .25, gaps=gaps)
        g.path(door[0] - .6, door[1], door[0] + .6, line + sgn * .1)
        if d:
            g.path(carx - 1.4, line, carx + 1.4, line + sgn * 6.0, 'uiDark')
            car = next_car()
            cz = line + sgn * (.5 + 2.45)
            g.place(car, carx, cz, (PI / 2 if rng.random() < .5 else -PI / 2), 1.0, soft=True)
            cars.append((carx, cz, name))
        # front yard recipe: bushes by the fence corners, mailbox at the path, flowerbeds along the porch, a personality cluster
        near_side = -1 if door[0] > hx else 1
        g.place('prop.garden-bush-small', lx0 + 1.0, line + sgn * 1.0, 0, 1.0, soft=True)
        g.place('prop.garden-bush', lx1 - 1.2, line + sgn * 1.1, 0, .8, soft=True)
        mbx = door[0] + 1.3 if door[0] + 1.3 < lx1 - 1.5 and door[0] + 1.3 < hx + w / 2 else door[0] - 1.3
        g.place('prop.mailbox-blue', mbx, line + sgn * .7, yaw, .8, soft=True)
        g.flowers(door[0] - 3, line + (.3 if sgn > 0 else -2.2), door[0] + 3, line + (2.2 if sgn > 0 else -.3), 12)
        g.lawn(lx0 + .3, min(line, line + sgn * 3.0), lx1 - .3, max(line, line + sgn * 3.0))
        # back yard: a tree crown rising behind the house (large mass for the top-down camera)
        bz = (hz + sgn * depth / 2 + rear) / 2
        g.place('prop.street-tree' if (i + len(doors)) % 2 else 'prop.street-tree-blossom', hx, bz, 0, 1.0, soft=True)
        variant = len(doors) % 4
        gx = (lx0 + 1.6) if near_side > 0 else (lx1 - 1.6)
        gz = line + sgn * 2.4
        if variant == 0:
            planter(gx, gz)
        elif variant == 1:
            D.sphere(l, 'toy-ball', 'survivorRed', .16, [gx, .17, gz]); D.ring(l, 'garden-hose', 'backpackTeal', .42, .035, [gx + .6, .08, gz])
        elif variant == 2:
            g.place('prop.trash-bin', gx, gz, yaw, .55, soft=True)
        else:
            g.place('prop.folding-chair', gx, gz, yaw + .4, .75, soft=True)
    return out

# Residential blocks (R0 north of the axis, R1 south of it), two rows each with an alley between the back fences
R0N, R0S = (-26.5, -17.0), (-4.5, -14.0)
R1N, R1S = (4.5, 13.5), (25.5, 16.5)
C1, C2, C3 = (-59.5, -34.5), (-25.5, 9.5), (18.5, 45.5)
houses = []
houses += row('r0c1n', *C1, 'N', *R0N, ['b', 'a'], [0, -1])
houses += row('r0c1s', *C1, 'S', *R0S, ['a', 'c'], [-1, 1])
houses += row('r0c2n', *C2, 'N', *R0N, ['a', 'c', 'a'], [0, 1, -1], gate_at=-10.0)
houses += row('r0c2s', *C2, 'S', *R0S, ['c', 'b', 'a'], [1, 0, -1])
houses += row('r0c3n', *C3, 'N', *R0N, ['a', 'b'], [1, 0])
houses += row('r0c3s', *C3, 'S', *R0S, ['c', 'a'], [-1, 1], gate_at=None)
houses += row('r1c1n', *C1, 'N', *R1N, ['a', 'c'], [-1, 1])
houses += row('r1c1s', *C1, 'S', *R1S, ['a', 'b'], [1, 0])
houses += row('r1c2n', *C2, 'N', *R1N, ['a', 'c', 'b'], [1, -1, 0], gate_at=-20.0)
houses += row('r1c2s', *C2, 'S', *R1S, ['c', 'a', 'a'], [-1, 1, 0])
houses += row('r1c3n', *C3, 'N', *R1N, ['c', 'a'], [0, 1], gate_at=41.0)
houses += row('r1c3s', *C3, 'S', *R1S, ['b', 'c'], [0, 1])
C4 = (54.5, 83.6)
houses += row('r1c4n', *C4, 'N', *R1N, ['a', 'b', 'c'], [1, 0, -1])
houses += row('r1c4s', *C4, 'S', *R1S, ['c', 'a', 'c'], [1, -1, 1])
# north strip: houses face south onto Main Row, deep back yards, alley behind (z = -48.5)
NFRONT = -35.5
houses += row('nstrip-w', *C2, 'S', NFRONT, -47.0, ['a', 'c', 'a'], [1, -1, 0])
houses += row('nstrip-e', *C3, 'S', NFRONT, -47.0, ['b', 'a'], [0, 1])
# south strip: houses face north onto Elm Street, alley behind (z = 48)
SFRONT = 34.5
houses += row('sstrip-w', *C2, 'N', SFRONT, 46.0, ['a', 'c', 'a'], [0, 1, -1])
houses += row('sstrip-e', *C4, 'N', SFRONT, 46.0, ['c', 'a', 'a'], [1, 0, -1])

# ------------------------------------------------------------------------------------------------ hero buildings
# --- Maple Corner: café (south-west corner of the junction, front towards Maple St), rack, patio
cafe = 'bld.cafe-corner'
cdx, cdy, cdz = dims(cafe)
CAFE_FRONT_X, CAFE_Z0 = -69.0, 6.4        # front line 0.5 m behind the sidewalk, building starts south of the H0 sidewalk
cafe_x, cafe_z = CAFE_FRONT_X - cdx / 2, CAFE_Z0 + cdz / 2
g.place(cafe, cafe_x, cafe_z, FACE_YAW['E'])
if g.placeholder(cafe):
    g.shell('cafe', cafe_x, cafe_z, 'E', cdx, cdz, [('front', 0, 2.4)])
anchors['cafe-patio'] = (CAFE_FRONT_X + 1.0, cafe_z)
anchors['bike-start'] = (-72.4, 4.9)
g.place('prop.bike-rack', -72.4, 5.5, PI / 2)
anchors['player-start'] = (-67.6, 9.0)
doors.append((CAFE_FRONT_X + 1.0, cafe_z))
# patio dressing on the sidewalk side: planters, a bench facing the street, bin
planter(-68.1, CAFE_Z0 + 1.2)
planter(-68.1, cafe_z + 3.4) if cdz > 8 else None
g.place('prop.trash-bin', -68.0, CAFE_Z0 + cdz - 1.0, FACE_YAW['E'], .55, soft=True)

# --- Maple Green (north-west pocket park) with the bus stop
GX0, GX1, GZ0, GZ1 = -83.6, -68.5, -26.5, -4.5
g.lawn(GX0, GZ0, GX1, GZ1)
g.place('bld.bus-stop', -69.5, -9.0, 0.0)
g.collide_only('bus-stop-shelter-n', [2.0, 2.6, .3], [-69.5, 1.3, -11.4])
g.collide_only('bus-stop-shelter-s', [2.0, 2.6, .3], [-69.5, 1.3, -6.6])
anchors['bus-stop'] = (-67.6, -9.0)
for (x, z) in [(-75, -20), (-80, -10), (-74, -8), (-80, -23)]:
    g.place('prop.street-tree-blossom' if (x + z) % 2 else 'prop.street-tree', x, z, 0, 1.0, soft=True)
g.hedge(GX0 + 1.2, GZ0 + .6, GX1 - 2.5, GZ0 + .6, scale=1.15)
g.hedge(GX0 + .8, GZ0 + 1.5, GX0 + .8, GZ1 - 1.5, scale=1.15)
g.path(-79, -22, -72, -22.6)
g.path(-76.4, -23, -75.6, -7.5)
g.place('prop.bench', -77.4, -16.5, FACE_YAW['E'], .95, soft=True)
g.place('prop.bench', -74.6, -12.5, FACE_YAW['W'], .95, soft=True)
planter(-78.5, -7.0)
g.place('prop.trash-bin', -73.2, -7.2, FACE_YAW['E'], .55, soft=True)
g.place('prop.garden-bush', -81.5, -16.0, 0, 1.0, soft=True)
g.place('prop.garden-bush', -72.5, -18.5, 0, 1.0, soft=True)
g.flowers(-80, -22, -72, -8, 40)

# --- Main Row: shops facing south onto Maple Row, depot at the V2 corner, passage with the courier van
SHOP_FRONT = -38.5
bk = 'bld.mainstreet-brick'
bd, bh, bw = dims(bk)
shop_x = -81.5
for i in range(3):
    cxs = shop_x + bw / 2
    g.place(bk, cxs, SHOP_FRONT - bd / 2, FACE_YAW['S'])
    doors.append((cxs, SHOP_FRONT + 1.0))
    g.flowers(cxs - 3, SHOP_FRONT + .3, cxs + 3, SHOP_FRONT + 1.4, 8)
    planter(cxs - bw / 2 + 1.2, SHOP_FRONT + .8)
    shop_x += bw + .8
PASS_X = shop_x - .8 + 2.0       # centre of the 4 m service passage (courier van parks in the strip in front of it)
depot = 'bld.courier-depot'
ddx, ddy, ddz = dims(depot)
depot_x = -37.8
depot_z = SHOP_FRONT - ddx / 2
g.place(depot, depot_x, depot_z, FACE_YAW['S'])
if g.placeholder(depot):
    g.shell('depot', depot_x, depot_z, 'S', ddx, ddz, [('front', 0, 2.2)])
anchors['parcel-door'] = (depot_x, SHOP_FRONT + .9)
anchors['parcel-counter'] = (depot_x, SHOP_FRONT - 1.3)
doors.append(anchors['parcel-door'])
g.place('veh.courier-van', PASS_X, SHOP_FRONT + 1.7 - .35, 0, 1.0, soft=True)
# shop-front dressing: A-frame / vending / bench between the planters, lamps come with the kerb line below
g.place('prop.vending-machine', depot_x + 4.4, SHOP_FRONT + .6, FACE_YAW['S'], .65, soft=True)
g.place('prop.bench', -53.5, SHOP_FRONT + 1.0, FACE_YAW['S'], .9, soft=True)
# service strip behind the shops (accessible through the passage): crates, bins, fence line
for x in (-78, -69, -60):
    g.place('prop.trash-bin', x, -46.4, FACE_YAW['N'], .55, soft=True)
g.place('prop.pallet', -65.0, -46.8, 0.3, 1.0, soft=True)
g.place('prop.pallet', -49.5, -47.0, 0.0, 1.0, soft=True)

# --- Larch Street: the Sunset Grove Medical Annex compound
clinic = 'bld.clinic-annex'
kdx, kdy, kdz = dims(clinic)
ANNEX_FRONT = -13.5
ax_, az_ = 66.0, ANNEX_FRONT - kdx / 2
g.place(clinic, ax_, az_, FACE_YAW['S'])
FENCE_Z = -8.5
if g.placeholder(clinic):
    g.shell('annex', ax_, az_, 'S', kdx, kdz, [('front', 0, 2.4), ('left', kdx / 2 - 3.5, 2.0)])
    # compound fence: only for the placeholder box (the real model brings its own fence + sliding gate)
    g.fence('picket', 56, FENCE_Z, 78, FENCE_Z, gaps=[(60.5, 3.0)])
    g.fence('privacy', 56, FENCE_Z, 56, az_ - kdx / 2 - .2)
    g.fence('privacy', 78, FENCE_Z, 78, az_ - kdx / 2 - .2)
    g.fence('privacy', 56, az_ - kdx / 2 - .2, 78, az_ - kdx / 2 - .2)
anchors['lab-gate'] = (60.5, FENCE_Z)
anchors['lab-door'] = (ax_, ANNEX_FRONT + 1.2)
anchors['lab-exit-front'] = (ax_, ANNEX_FRONT + .8)
anchors['lab-exit-side'] = (ax_ + kdz / 2 + 1.5, az_ + kdx / 2 - 3.5)
anchors['lab-exit-window'] = (ax_ - kdz / 2 - 1.6, az_ + 3.0)
anchors['lab-tech-spawn'] = (ax_, az_ + kdx / 2 - 3.0)
anchors['lab-smoke-vent'] = (ax_ + 1.0, az_ - kdx / 2 + 2.5)
anchors['lab-smoke-window'] = (ax_ - kdz / 2 + .3, az_ + 2.0)
anchors['lab-bike-rack'] = (57.8, -6.1)
anchors['lab-bike-rack-front'] = (57.8, -5.2)
g.place('prop.bike-rack', 57.8, -6.1, PI / 2)
doors.append(anchors['lab-door'])
# staff parking east of the compound, a van and a sedan
g.place('veh.courier-van', 81.2, -22.0, PI / 2, 1.0, soft=True)
g.place('veh.sedan-white', 81.2, -14.5, -PI / 2, 1.0, soft=True)
g.path(79.8, -26, 82.6, -11.5, 'uiDark')
g.hedge(79.0, -28.5, 83.0, -28.5, scale=1.15)
g.hedge(79.0, -10.0, 83.0, -10.0, scale=1.15)

# --- Larch Green (north-east pocket park behind the compound)
g.lawn(54.5, -50.0, 83.6, -30.0)
for (x, z) in [(60, -44), (68, -40), (76, -45), (80, -36), (58, -35)]:
    g.place('prop.street-tree' if (x + z) % 2 else 'prop.street-tree-blossom', x, z, 0, 1.0, soft=True)
g.hedge(54.8, -34.0, 63.0, -34.0, scale=1.15)
g.hedge(70.0, -34.0, 83.2, -34.0, scale=1.15)
g.place('prop.bench', 66.5, -36.5, FACE_YAW['N'], .95, soft=True)
g.place('prop.bench', 70.5, -41.0, FACE_YAW['W'], .95, soft=True)
planter(66.0, -32.2)
g.flowers(56, -48, 82, -34, 50)

# --- Elm Street: the Henderson garage lot
garage = 'bld.garage-detached'
gdx, gdy, gdz = dims(garage)
GARAGE_FRONT = 36.4
gx, gz_ = 22.0, GARAGE_FRONT + gdx / 2
g.place(garage, gx, gz_, FACE_YAW['N'])
if g.placeholder(garage):
    g.shell('garage', gx, gz_, 'N', gdx, gdz, [('front', 0, 2.6)])
anchors['garage-door'] = (gx, GARAGE_FRONT - 1.2)
anchors['garage-bat'] = (gx - .8, GARAGE_FRONT + 2.4)
g.path(gx - 1.5, SFRONT, gx + 1.5, GARAGE_FRONT, 'uiDark')
hd = HOUSE['d']
henderson = kind('d')
hasset, hscale, hdx, hdz = HOUSE[henderson]
hdepth = dims(hasset)[0] * hscale
hw = dims(hasset)[2] * hscale
hx_ = 33.5
hz_ = SFRONT + 1.0 + hdepth / 2
g.place(hasset, hx_, hz_, FACE_YAW['N'], hscale)
ox, oz = rot(FACE_YAW['N'], hdx, hdz)
anchors['henderson-door'] = (hx_ + ox, hz_ + oz)
doors.append(anchors['henderson-door'])
g.path(hx_ + ox - .6, SFRONT, hx_ + ox + .6, SFRONT + 1.4)
g.fence('picket', 26.2, SFRONT + .25, 40.0, SFRONT + .25, gaps=[(hx_ + ox, 1.7)])
g.fence('picket', 18.8, SFRONT + .25, 25.0, SFRONT + .25, gaps=[(gx, 3.2)])
g.fence('privacy', 26.0, SFRONT + .4, 26.0, 46.0)
g.fence('privacy', 41.0, SFRONT + .4, 41.0, 46.0)
g.fence('privacy', 18.8, 46.0, 41.0, 46.0)
g.fence('privacy', 18.8, SFRONT + .4, 18.8, 46.0)
g.place('veh.sedan-blue', 29.2, SFRONT + 3.2, PI / 2, 1.0, soft=True)
cars.append((29.2, SFRONT + 3.2, 'henderson'))
g.place('prop.trash-bin', 27.2, SFRONT + 1.0, FACE_YAW['N'], .55, soft=True)
g.place('prop.street-tree', 36, 44.0, 0, 1.0, soft=True)
g.flowers(27, 35, 40, 37, 14)

# --- Sunny Suds car wash and Sunset Fuel corner (south-west)
cw = 'kit.car-wash'
cwx, cwy, cwz = dims(cw)
CW_X, CW_Z = -50.0, 41.5
g.place(cw, CW_X, CW_Z, 0.0)
g.fence('privacy', CW_X - 3.0, SFRONT + .3, CW_X - 3.0, 46.0)
anchors['carwash-start'] = (CW_X, SFRONT + 1.4)
gs = 'bld.gas-station'
gsd, gsh, gsw = dims(gs)
GS_X = -40.0
g.place(gs, GS_X, SFRONT + gsd / 2 + .2, FACE_YAW['N'])
g.place('prop.fire-hydrant', -57.2, 36.0, 0, .8, soft=True)
g.place('prop.trash-bin', -56.0, 35.6, FACE_YAW['N'], .55, soft=True)
g.hedge(-59.0, 46.0, -53.5, 46.0, scale=1.15)
g.hedge(-46.0, 46.2, -35.0, 46.2, scale=1.15)

# --- Fire Station 3 (south-west corner)
fs = 'bld.fire-station'
fdx, fdy, fdz = dims(fs)
FS_X = -75.0
FS_Z = SFRONT + fdx / 2
g.place(fs, FS_X, FS_Z, FACE_YAW['N'])
# model local +X is the apron/door side: door and trigger sit on the apron in front of the bay
fx, fz = rot(FACE_YAW['N'], 3.9, 0)
anchors['fire-bay-door'] = (FS_X + fx, FS_Z + fz)
fx, fz = rot(FACE_YAW['N'], 4.9, 0)
anchors['fire-bay-trigger'] = (FS_X + fx, FS_Z + fz)
doors.append(anchors['fire-bay-trigger'])
g.place('prop.fire-hydrant', -68.2, 36.2, 0, .8, soft=True)

# ------------------------------------------------------------------------------------------------ perimeter
PN, PS, PW, PE = -50.4, 49.9, -83.6, 83.6
road_gaps_x = [(XW, 10.0), (X2, 10.0), (X3, 10.0), (X4, 10.0)]
g.fence('privacy', -84.0, PN, X2 - 5, PN)
g.fence('privacy', X2 + 5, PN, X3 - 5, PN)
g.fence('privacy', X3 + 5, PN, 84.0, PN)
g.fence('privacy', -84.0, PS, X2 - 5, PS)
g.fence('privacy', X2 + 5, PS, X3 - 5, PS)
g.fence('privacy', X3 + 5, PS, X4 - 5, PS)
g.fence('privacy', X4 + 5, PS, 84.0, PS)
# west and east edges: closed except at the three streets (z = -31, 0, 30) which end in road-work barriers
g.fence('privacy', PW, PN, PW, ZN - 5.0)
g.fence('privacy', PW, ZN + 5.0, PW, Z0 - 5.0)
g.fence('privacy', PE, PN, PE, Z0 - 5.0)
for px in (PW, PE):
    g.fence('privacy', px, Z0 + 5.0, px, ZS - 5.0)
    g.fence('privacy', px, ZS + 5.0, px, PS)
# wings: the strip outside the fence line must not be reachable around the road-work barriers
for x in (X2, X3):
    for sx in (-5.0, 5.0):
        g.fence('privacy', x + sx, PN, x + sx, -54.9)
        g.fence('privacy', x + sx, PS, x + sx, 54.9)
for sx in (-5.0, 5.0):
    g.fence('privacy', X4 + sx, PS, X4 + sx, 54.9)
# road-work barriers at every street that reaches the map edge
RW = 'kit.edge-roadwork'
def barrier(x, z, yaw, sidewalks=(), side_axis=0):
    g.place(RW, x, z, yaw, 1.0)
    for (sx, sz) in sidewalks:   # barricade pieces close the two sidewalks between the barrier (3 m) and the fence gap (5 m)
        g.place('prop.barricade', sx, sz, yaw + PI / 2, (1.0, 1.0, .88))
barrier(-84.2, Z0, PI / 2, [(-84.2, -4.0), (-84.2, 4.0)])
barrier(84.2, Z0, PI / 2, [(84.2, -4.0), (84.2, 4.0)])
barrier(-84.2, ZN, PI / 2, [(-84.2, ZN - 4.0), (-84.2, ZN + 4.0)])
barrier(-84.2, ZS, PI / 2, [(-84.2, ZS - 4.0), (-84.2, ZS + 4.0)])
barrier(84.2, ZS, PI / 2, [(84.2, ZS - 4.0), (84.2, ZS + 4.0)])
for x in (X2, X3):
    barrier(x, -53.4, 0.0, [(x - 4.0, -53.4), (x + 4.0, -53.4)])
    barrier(x, 53.4, 0.0, [(x - 4.0, 53.4), (x + 4.0, 53.4)])
barrier(X4, 53.4, 0.0, [(X4 - 4.0, 53.4), (X4 + 4.0, 53.4)])
# tree line just inside the bounds to hide the edge, mixed blossom / green
for x in range(-80, 81, 8):
    for pz, off in ((-52.6, 0), (51.8, 0)):
        if any(abs(x + off - rx) < 5 for rx in (X2, X3, X4)): continue
        g.place('prop.street-tree' if (x // 8) % 2 else 'prop.street-tree-blossom', x + off, pz, 0, 1.0, soft=True)
for z in range(-48, 49, 8):
    if any(abs(z - rz) < 6 for rz in (ZN, Z0, ZS)): continue
    for px in (-84.3, 84.3):
        g.place('prop.street-tree' if (z // 8) % 2 else 'prop.street-tree-blossom', px, z, 0, 1.0, soft=True)

# ------------------------------------------------------------------------------------------------ kerb line: lamps, hydrants
def lamps():
    for r in g.road_list:
        if r['kind'] != 'road': continue
        ax = r['ax']; lo, hi = r['cuts'][0] + 6, r['cuts'][-1] - 6
        line = r['a'][1 - ax]
        v = lo
        while v < hi:
            for side in (-1, 1):
                p = v + (5 if side > 0 else 0)
                if any(abs(p - o['a'][ax]) < 6.5 for o in g.road_list if o is not r and o['ax'] != ax and o['kind'] == 'road'): continue
                off = side * (r['w'] / 2 + .5)
                x, z = (p, line + off) if ax == 0 else (line + off, p)
                g.place('prop.street-lamp', x, z, 0, 1.0, soft=True)
            v += 14
lamps()

# ------------------------------------------------------------------------------------------------ street furniture, alleys, patio
for (cx, cz) in [(XW, Z0), (X2, Z0), (X3, Z0), (X4, Z0), (XW, ZS), (X2, ZS), (X3, ZS), (X4, ZS), (XW, ZN), (X2, ZN), (X3, ZN), (X4, ZN)]:
    g.place('prop.street-sign', cx + 3.5, cz + 3.5, 0, .8, soft=True)
    g.place('prop.fire-hydrant', cx - 3.5, cz - 3.5, 0, .8, soft=True)
for x, z in [(-47, -3.6), (-9, 3.6), (31, -3.6), (68, 3.6), (-20, ZS - 3.6), (36, ZS + 3.6)]:
    g.place('prop.utility-pole', x, z, PI / 2, 1.0, soft=True)
DUMPSTERS = {'dumpster-1': (-52.0, -15.5), 'dumpster-1-end': (-58.5, -15.5), 'dumpster-2': (36.0, 15.0), 'dumpster-2-end': (27.0, 15.0)}

def alley_props(x0, x1, zc, step=9.0, phase=0.0):
    """Bins against the fences, a crate now and then; the alley corridor itself stays clear."""
    x = x0 + 4 + phase
    side = -1
    while x < x1 - 3:
        z = zc + side * 1.08
        if any(abs(x - vx) < 4.6 for vx in (XW, X2, X3, X4)) or any(abs(x - dx) < 6.5 and abs(zc - dz) < 2 for dx, dz in DUMPSTERS.values()):
            x += step; side = -side
            continue
        g.place('prop.trash-bin', x, z, FACE_YAW['E'] if side < 0 else FACE_YAW['W'], .5, soft=True)
        if rng.random() < .5:
            g.solid('crate', 'woodWarm', [.7, .55, .7], [x + 3.2, .28, zc - side * .95]) if g.fits([(x + 2.85, zc - side * .95 - .35, x + 3.55, zc - side * .95 + .35, .55)], .1) else None
        x += step; side = -side
alley_props(XW + 5, X2 - 5, -15.5, 8.0)
alley_props(X2 + 5, X3 - 5, -15.5, 9.0, 3)
alley_props(X3 + 5, X4 - 5, -15.5, 9.0, 1)
alley_props(XW + 5, X2 - 5, 15.0, 9.0, 2)
alley_props(X2 + 5, X3 - 5, 15.0, 8.0, 5)
alley_props(X3 + 5, X4 - 5, 15.0, 9.0, 4)
alley_props(X4 + 5, 80, 15.0, 9.0, 1)
alley_props(-80, X2 - 5, -48.5, 10.0, 2)
alley_props(X2 + 5, X3 - 5, -48.5, 9.0, 3)
alley_props(X3 + 5, 47, -48.5, 10.0, 1)
alley_props(-80, X2 - 5, 48.0, 10.0, 6)
alley_props(X2 + 5, X3 - 5, 48.0, 9.0, 2)
alley_props(X3 + 5, 80, 48.0, 10.0, 5)
# car wash approach lane, queue cones, hedge behind the bay, vending machine at the fuel corner
g.path(CW_X - 1.8, SFRONT, CW_X + 1.8, CW_Z - 5.0, 'uiDark')
for dz in (3.0, 5.5):
    g.place('prop.traffic-cone', CW_X + 2.9, SFRONT + dz, 0, 1.0, soft=True)
g.place('prop.vending-machine', GS_X + 5.6, SFRONT + 5.6, FACE_YAW['N'], .65, soft=True)

# ------------------------------------------------------------------------------------------------ anchors that follow the plan
def cars_near(x, z):
    return min(cars, key=lambda c: (c[0] - x) ** 2 + (c[1] - z) ** 2)
for i, tgt in enumerate([(-58.0, 8.0), (-12.0, -9.0), (28.0, -9.0), (45.0, 20.0)], 1):
    c = cars_near(*tgt)
    cars.remove(c)
    anchors[f'alarm-car-{i}'] = (c[0], c[1])
# rear gates sit in the alley-side fence of lots (gate_at gaps above): gate-1 R1 alley, gate-2 R0 alley, gate-3 R1 east alley
anchors['gate-1'] = (-20.0, R1N[1])
anchors['gate-2'] = (-10.0, R0N[1])
anchors['gate-3'] = (41.0, R1N[1])
anchors.update(DUMPSTERS)
for dx, dz in DUMPSTERS.values():   # worn asphalt pads: the dumpsters (F) stand and slide on these
    l.box('dumpster-pad', 'uiDark', [3.4, .05, 2.2], [dx, .03, dz])
doors_sorted = sorted(doors)
for i, d in enumerate(doors_sorted, 1):
    anchors[f'refuge-door-{i}'] = d
anchors['edge-in-1'] = (-81.5, Z0)
anchors['edge-in-2'] = (X2, -51.5)
anchors['edge-in-3'] = (X3, -51.5)
anchors['edge-in-4'] = (81.5, Z0)
anchors['edge-in-5'] = (X3, 51.5)
anchors['edge-in-6'] = (X2, 51.5)
anchors['elm-horde-entry'] = (X4, 51.0)
anchors['photo-l1-morning'] = (-67.8, 9.0)
anchors['photo-l1-pickup'] = (depot_x, SHOP_FRONT + 3.5)
anchors['photo-l1-facility'] = (60.0, -6.0)
anchors['photo-l1-accident'] = (ax_, ANNEX_FRONT + 3.5)
anchors['photo-l1-escape'] = (53.0, -3.0)
anchors['photo-l1-spread'] = (0.0, Z0)
anchors['photo-l1-garage'] = (gx, SFRONT + 1.0)
anchors['photo-l1-horde'] = (30.0, 31.0)
anchors['photo-l1-safe'] = (anchors['fire-bay-trigger'][0], anchors['fire-bay-trigger'][1] - 3.0)
for name, (x, z) in anchors.items():
    l.anchor(name, [x, 0, z])
l.data['anchors'] = {k: v for k, v in l.data['anchors'].items()}

# named gameplay polygons
l.zone('lab-nobike-zone', [(56, -29.8), (78, -29.8), (78, FENCE_Z), (56, FENCE_Z)])
l.zone('garage-nobike-zone', [(gx - 3.4, GARAGE_FRONT - 1.4), (gx + 3.4, GARAGE_FRONT - 1.4), (gx + 3.4, GARAGE_FRONT + gdx + .4), (gx - 3.4, GARAGE_FRONT + gdx + .4)])
fx0, fz0 = anchors['fire-bay-door']
l.zone('fire-nobike-zone', [(FS_X - 6.2, SFRONT), (FS_X + 6.2, SFRONT), (FS_X + 6.2, SFRONT + fdx + .5), (FS_X - 6.2, SFRONT + fdx + .5)])
l.zone('carwash-bay', [(CW_X - 2.5, CW_Z - 5), (CW_X + 2.5, CW_Z - 5), (CW_X + 2.5, CW_Z + 5), (CW_X - 2.5, CW_Z + 5)])

# Plausibility problems (overlaps) are written next to the build cache and fail the build in tests/unit/layouts/d-grove.test.ts
from pathlib import Path
out = Path(__file__).resolve().parents[2] / '.cache/layouts'
out.mkdir(parents=True, exist_ok=True)
(out / 'D-GROVE.problems.txt').write_text('\n'.join(g.problems) + '\n')
l.export()
