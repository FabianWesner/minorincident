"""Fairhaven downtown (E22 L4 "The Safe City Falls"): the 170 x 130 m district D-FAIR, built clean (W0, alive).

Origin at the map centre, X east, Z south (the game camera looks from the south-east, so the north and west are "behind"
the action: tall blocks stand there, the south and east rows stay low). Streets (all axis-aligned):

    Lakeshore Avenue  z = +46   the convoy route and the lake promenade (water south of it); the army gate sits at its west end
    Harbor Street     z = -40   shops and apartment blocks, the Fairhaven Metro entrance on its north side
    Church Road       x = -58   north-south, west of the plaza block
    Plaza Way         x = +14   north-south, east of the plaza block (the convoy turns west into the plaza through a 6.5 m gap)
    Metro Road        x = +50   north-south
    Kessler Lane      z = 28.6  an alley east of Metro Road, dead-ending at the east fence: Kessler's Hardware (its cellar door
                                is on the lane side) stands on the Lakeshore front south of it

The reception plaza is the open square x -36..2, z -22..35 inside the central block: the town hall (north), the church and an
apartment block (west), low shops (east) and the lake gardens (south) frame it; alleys at its corners let people and infected
through. The cellar of Kessler's Hardware (int.basement-cellar) is a sealed yard behind the west block (x -85..-73); only a
scripted descent reaches it. Gameplay data beyond the base anchors, the army dressing and the spectacle actors are TS data
(src/data/l4.ts, src/levels/L4/layout.ts).
"""
import math
from sslib.layout import Layout
from sslib import l1_dressing as D
from sslib.grove_dressing import Grove, FACE_YAW, rot
from sslib import grove_dressing as G

PI = math.pi
W, DEPTH = 170, 130
l = Layout('D-FAIR', 'Fairhaven Downtown', size=(W, DEPTH))
l.yaw_matches_collision = True
g = Grove(l)
dims = g.dims

# ------------------------------------------------------------------------------------------------ streets
ZL, ZH = 46, -40                        # Lakeshore Avenue / Harbor Street
XC, XP, XM = -58, 14, 50                # Church Road / Plaza Way / Metro Road
ZK = 28.6                               # Kessler Lane
ROADS = [
    dict(id='lakeshore', a=(-85, ZL), b=(85, ZL), ga=(-60, ZL), gb=(76, ZL), w=7, kind='road'),     # the street graph ends clear of the army gate and the barriers
    dict(id='harbor', a=(-85, ZH), b=(85, ZH), ga=(-78, ZH), gb=(78, ZH), w=7, kind='road'),
    dict(id='church-rd', a=(XC, ZH), b=(XC, ZL), w=5, kind='road'),
    dict(id='plaza-way', a=(XP, ZH), b=(XP, ZL), w=5, kind='road'),
    dict(id='metro-rd', a=(XM, ZH), b=(XM, ZL), w=5, kind='road'),
    dict(id='kessler-lane', a=(XM, ZK), b=(84.4, ZK), w=3, kind='alley'),
]
g.roads(ROADS)
for cx in (XC, XP, XM):
    for cz in (ZH, ZL):
        g.crosswalk(cx + 4.6, cz, 0)
        g.crosswalk(cx - 4.6, cz, 0)

doors = []          # refuge doors (pavement in front of each building door): infected emerge from these
anchors = {}
rects = {}          # strip -> [(lo, hi, depth_lo, depth_hi, horizontal)] building extents, for filling the slits between neighbours

def put(strip, asset, facing, front, a, door=True, back=None):
    """Place `asset` facing `facing` with its FRONT wall on `front` (z for N/S, x for E/W), centred at `a` along the street.
    With `back` the BACK wall is on that line instead (buildings flush with a street edge)."""
    depth, width = dims(asset)[0], dims(asset)[2]
    if back is not None:
        front = back + (depth if facing in ('S', 'E') else -depth)
    if facing == 'S': cx, cz = a, front - depth / 2
    elif facing == 'N': cx, cz = a, front + depth / 2
    elif facing == 'E': cx, cz = front - depth / 2, a
    else: cx, cz = front + depth / 2, a
    pid = g.place(asset, cx, cz, FACE_YAW[facing])
    horizontal = facing in ('S', 'N')
    c, d = (cx, cz) if horizontal else (cz, cx)
    rects.setdefault(strip, []).append((c - width / 2, c + width / 2, d - depth / 2, d + depth / 2, horizontal))
    if pid and door:
        fx, fz = {'S': (0, 1), 'N': (0, -1), 'E': (1, 0), 'W': (-1, 0)}[facing]
        doors.append((cx + fx * (depth / 2 + .9) if fx else a, cz + fz * (depth / 2 + .9) if fz else a))
    return pid, cx, cz

def fill(strip, max_gap=1.6):
    """Brick party walls in the slits (<= max_gap) between neighbouring buildings of a strip: no walkable pockets."""
    items = sorted(rects[strip])
    for (a0, a1, d0, d1, hz), (b0, b1, e0, e1, _) in zip(items, items[1:]):
        gap = b0 - a1
        if gap <= .02 or gap > max_gap: continue
        lo, hi = max(d0, e0), min(d1, e1)
        if hi - lo < .5: continue
        c, m = (a1 + b0) / 2, (lo + hi) / 2
        if hz: g.solid('party-wall', 'brick', [gap + .04, 3.0, hi - lo], [c, 1.5, m])
        else: g.solid('party-wall', 'brick', [hi - lo, 3.0, gap + .04], [m, 1.5, c])

# ------------------------------------------------------------------------------------------------ the plaza block (x -53.2..9.2, z -34.2..40.2)
BACK_N, BACK_W, BACK_E = -34.2, -53.2, 9.2        # backs flush with the pavement edges of Harbor, Church Road and Plaza Way
# North row, facing south: apartment, town hall, storefront row, apartment (tall: they stand behind the action)
HALL_X = -30.0
put('pn', 'bld.apartment-block-a', 'S', 0, -46.9, back=BACK_N)
put('pn', 'bld.town-hall', 'S', 0, HALL_X, back=BACK_N)
put('pn', 'bld.storefront-row', 'S', 0, -22.0 + 8.27, back=BACK_N)
put('pn', 'bld.apartment-block-b', 'S', 0, -22.0 + 16.54 + .05 + 6.3, back=BACK_N)
fill('pn')
g.solid('party-wall', 'brick', [1.9, 3.0, 10.0], [8.15, 1.5, -29.2])     # east end of the north row up to Plaza Way
# West row, facing east: apartment, church, apartment, cafe
put('pw', 'bld.apartment-block-a', 'E', 0, -15.5, back=BACK_W)
put('pw', 'bld.church', 'E', 0, -2.7, back=BACK_W)
put('pw', 'bld.apartment-block-b', 'E', 0, 10.2, back=BACK_W)
put('pw', 'bld.cafe-corner', 'E', 0, 27.05, back=BACK_W)
fill('pw')
# East row, facing west: low shops; a 6.5 m gap at z 2.5..9 is the convoy and tank way
put('pe', 'bld.supermarket', 'W', 0, -17.5, back=BACK_E)
put('pe', 'bld.pharmacy', 'W', 0, -9.0, back=BACK_E)
put('pe', 'bld.pharmacy', 'W', 0, -1.2, back=BACK_E)
put('pe', 'bld.cafe-corner', 'W', 0, 18.75, back=BACK_E)
put('pe', 'bld.supermarket', 'W', 0, 33.5, back=BACK_E)
fill('pe')
# the plaza itself: paving, planters, benches, a lake-side garden line with two gaps
g.path(-36.0, -22.0, 2.0, 35.5, 'sidewalk')
l.data['surfaces'].append(dict(surface='tile', polygon=[[-36, -22], [2, -22], [2, 35.5], [-36, 35.5], [-36, -22]]))
g.path(1.9, 2.5, 14.0, 9.0, 'asphalt')                      # the gap to Plaza Way
for (x, z) in ((-33, -19), (-10, -19), (-33, 31), (-3, 31)):
    D.planter(l, x, z)
for (x, z) in ((-8.0, -19.5), (-14.0, -19.5), (-32.8, 18.0), (-32.8, 10.0), (-4.0, 33.8), (-26, 33.8)):
    D.bench(l, x, z)
for (x, z) in ((-24, -19.2), (-35.3, 26.0)):
    D.bin(l, x, z)
for x in (-31, -23, -15, -7, 0):
    g.place('prop.street-tree-blossom' if int(x) % 2 else 'prop.street-tree', x, 36.6, 0, .8, soft=True)
g.hedge(-36.0, 38.8, -25.0, 38.8, scale=1.1); g.hedge(-14.0, 38.8, -10.0, 38.8, scale=1.1); g.hedge(-3.0, 38.8, 8.0, 38.8, scale=1.1)
g.fence('privacy', -53.0, 40.6, 9.0, 40.6, gaps=[(-20.0, 10), (-6.5, 7)])   # the plaza opens to Lakeshore through these gaps

# ------------------------------------------------------------------------------------------------ the east block (x 18.8..45.2): storefront rows and apartments
FRONT_PW = 18.8
for z in (-25.9, -8.5, 8.6, 25.9):
    put('be', 'bld.storefront-row', 'W', FRONT_PW, z)
fill('be')
FRONT_MW = 45.2                         # fronts on Metro Road's west pavement edge
for asset, z in (('bld.apartment-block-a', -28.0), ('bld.apartment-block-b', -14.6), ('bld.apartment-block-a', -1.2), ('bld.apartment-block-b', 12.2), ('bld.apartment-block-a', 25.4)):
    put('bm', asset, 'E', FRONT_MW, z)
put('bm', 'bld.pharmacy', 'E', FRONT_MW, 36.6)
fill('bm')
g.fence('privacy', 29.4, -34.4, 29.4, 40.4); g.fence('privacy', 34.2, -34.4, 34.2, 40.4)
g.fence('privacy', 19.0, 40.4, 45.0, 40.4)
g.fence('privacy', 19.0, -34.4, 45.0, -34.4)

# ------------------------------------------------------------------------------------------------ the west block (x -73.1..-62.8): apartments and a cafe facing Church Road
FRONT_CW = -62.8
for asset, z in (('bld.apartment-block-a', -28.0), ('bld.apartment-block-b', -14.6), ('bld.apartment-block-a', -1.2), ('bld.apartment-block-b', 12.2)):
    put('bw', asset, 'E', FRONT_CW, z)
put('bw', 'bld.cafe-corner', 'E', FRONT_CW, 30.3)
fill('bw')
# the yard behind the block (x -85..-73) is an empty fenced lot (L7's W6 corridor); the cellar yard is in the east lot (see CELLAR_X below)
for x0, z0, x1, z1 in ((-84.4, -34.6, -73.2, -34.6), (-84.4, 40.6, -73.2, 40.6), (-84.4, -34.6, -84.4, 40.6), (-73.2, -34.6, -73.2, 40.6)):
    g.fence('privacy', x0, z0, x1, z1)
g.fence('privacy', -73.4, 40.6, -62.8, 40.6)
# The cellar yard (sealed island) stands in the empty east lot (x 66..84.4, z -34.4..26.9): the game camera looks from the south-east, and
# nothing taller than the 1.8 m fence stands on that side. (PO 10-12: it sat behind the 5-storey west block, hidden from the camera.)
CELLAR_X, CELLAR_Z = 75.0, -4.0
CELLAR_ID = g.place('int.basement-cellar', CELLAR_X, CELLAR_Z, PI / 2, 1.0, check=False, y=-.3)   # its floor top is 0.3 m: the player walks at y 0
# The baked slab would block the whole room: the cellar is non-solid and its walls, shelves and stair are authored here
# (local x, z of the model -> world (cx + z, cz - x) at yaw pi/2), 2.4 m high.
def cellar_box(name, x0, x1, z0, z1):
    g.collide_only(name, [z1 - z0, 2.4, x1 - x0], [CELLAR_X + (z0 + z1) / 2, 1.2, CELLAR_Z - (x0 + x1) / 2])
cellar_box('cellar-back', -4.4, -3.3, -3.4, 3.4); cellar_box('cellar-front', 4.0, 4.4, -3.4, 3.4)
cellar_box('cellar-left', -4.4, 4.4, 2.3, 3.4); cellar_box('cellar-right', -4.4, 4.4, -3.4, -2.3)
cellar_box('cellar-shelves', -3.05, .25, -2.28, -1.58); cellar_box('cellar-stair', -3.3, 1.7, 1.3, 2.3)
g.path(CELLAR_X - 4.0, CELLAR_Z - 4.0, CELLAR_X + 4.0, CELLAR_Z + 4.0, 'sidewalk')
# The cellar is a building for the audio occlusion (the city's gunfire above is muffled: -6 dB and a 1.2 kHz low-pass) and a small reverberant room.
_c = (CELLAR_X - 3.6, CELLAR_X + 3.6, CELLAR_Z - 4.6, CELLAR_Z + 4.6)
l.data['buildings'].append(dict(id=CELLAR_ID, assetId='int.basement-cellar', aabb=dict(min=[_c[0], 0, _c[2]], max=[_c[1], 4, _c[3]]), label="Kessler's cellar"))
l.data['acousticZones'].insert(0, dict(id='cellar', preset='interior-small', polygon=[[_c[0], _c[2]], [_c[1], _c[2]], [_c[1], _c[3]], [_c[0], _c[3]], [_c[0], _c[2]]]))

# ------------------------------------------------------------------------------------------------ the north row (facing Harbor Street, z < -45.8)
FRONT_NH = -45.8
x = -84.0
MET_X = None
for asset in ('bld.apartment-block-b', 'bld.storefront-row', 'bld.storefront-row', 'bld.apartment-block-a', 'bld.storefront-row', 'bld.apartment-block-b', 'bld.storefront-row', 'bld.apartment-block-a',
              'bld.metro-entrance', 'bld.apartment-block-b', 'bld.storefront-row', 'bld.apartment-block-a'):
    w = dims(asset)[2]
    if asset == 'bld.metro-entrance':
        x += 2.4                                                 # a street-side plaza of the station entrance, closed behind it
        MET_X = x + w / 2
        put('nh', asset, 'S', FRONT_NH, MET_X, door=False)
        g.solid('metro-back', 'brick', [w + 4.8, 3.0, 4.0], [MET_X, 1.5, -54.4])
        x += w + 2.4
        continue
    if x + w > 84.0: break
    put('nh', asset, 'S', FRONT_NH, x + w / 2); x += w + .05
for asset in ('bld.supermarket', 'bld.pharmacy'):             # a low shop closes the row's east end
    w = dims(asset)[2]
    if x + w <= 84.2:
        put('nh', asset, 'S', FRONT_NH, x + w / 2); x += w + .05
if x < 84.3:
    g.solid('row-end', 'brick', [84.4 - x, 3.0, 10.0], [(x + 84.4) / 2, 1.5, -51.0])
fill('nh', max_gap=2.6)
for x0, z0, x1, z1 in ((-84.4, -58.8, 84.4, -58.8), (-84.4, -58.8, -84.4, -45.6), (84.4, -58.8, 84.4, -45.6)):
    g.fence('privacy', x0, z0, x1, z1)

# ------------------------------------------------------------------------------------------------ the east strip (x 54.8..84.4): shops on Metro Road, Kessler Lane, the Lakeshore front
FRONT_ME = 54.8
put('be2', 'bld.storefront-row', 'W', FRONT_ME, -25.9)
put('be2', 'bld.storefront-row', 'W', FRONT_ME, -8.5)
put('be2', 'bld.apartment-block-a', 'W', FRONT_ME, 8.5)
fill('be2')
for x0, z0, x1, z1 in ((66.0, -34.4, 66.0, 26.9), (66.0, 26.9, 84.4, 26.9), (66.0, -34.4, 84.4, -34.4), (84.4, -34.4, 84.4, 26.9)):
    g.fence('privacy', x0, z0, x1, z1)
g.fence('privacy', 54.8, 26.9, 66.0, 26.9)
# Lakeshore front south of Kessler Lane: pharmacy, Kessler's Hardware (shopfront on the lane, cellar door on the Lakeshore side that the game camera sees), a supermarket
FRONT_LK = 40.2
put('lk', 'bld.pharmacy', 'S', FRONT_LK, 58.0)
HW_X = 68.0
_, hwx, hwz = put('lk', 'bld.kessler-hardware', 'N', 30.2, HW_X)   # turned round (PO 10-12): the rear cellar door faces the south, not the 10.8 m wall between it and the camera
put('lk', 'bld.supermarket', 'S', FRONT_LK, 78.5)
fill('lk', max_gap=3.0)
g.fence('privacy', 54.8, 30.2, 61.2, 30.2)
g.fence('privacy', 84.4, 26.9, 84.4, 41.2)
g.fence('privacy', 84.4, 51.0, 84.4, 56.4)
# local (-4.1, -1.6) is the cellar door socket (rear wall); with yaw +pi/2 that is world (x - 1.6, z + 4.1): on the Lakeshore side, the player stands south of it
ox, oz = rot(FACE_YAW['N'], -4.1, -1.6)
CELLAR_DOOR = (hwx + ox, hwz + oz)
anchors['kessler-cellar-door'] = (CELLAR_DOOR[0], CELLAR_DOOR[1] + 1.4)

# ------------------------------------------------------------------------------------------------ the lake promenade (south of Lakeshore)
l.box('promenade', 'sidewalk', [W, .12, 5.2], [0, .05, 54.1])
l.box('lake', 'denim', [W, .05, 8.4], [0, -.02, 61.0])
g.solid('lake-wall', 'sidewalk', [W, .9, .5], [0, .45, 56.9])
for x in range(-76, 80, 16):
    g.place('prop.street-lamp', x, 52.4, 0, 1.0, soft=True)
for x in (-70, -50, -30, -2, 22, 40, 62, 76):
    D.bench(l, x, 54.3)
for x in (-64, -42, -12, 10, 30, 52, 70):
    g.place('prop.street-tree' if int(x) % 3 else 'prop.street-tree-blossom', x, 52.6, 0, .75, soft=True)
g.fence('privacy', -84.4, 51.0, -84.4, 56.4)
g.fence('privacy', -84.4, 40.6, -84.4, 41.2)

# ------------------------------------------------------------------------------------------------ the army gate (Lakeshore, west end)
GATE_X = -74.0      # the army gate is dressing (src/levels/L4/layout.ts: barriers, sandbags, light towers) beside a 6 m open lane: the convoy passes through it

# ------------------------------------------------------------------------------------------------ kerb lamps, signs, hydrants
for r in g.road_list:
    if r['kind'] != 'road' or r['ax'] != 0: continue
    z = r['a'][1]
    x = -80.0
    while x < 82.0:
        for side in (-1, 1):
            if z == ZL and side > 0: continue          # the promenade has its own lamps
            p = x + (8 if side > 0 else 0)
            if abs(p) > 80: continue
            if any(abs(p - c) < 7 for c in (XC, XP, XM)) or abs(p - GATE_X) < 9: continue
            g.place('prop.street-lamp', p, z + side * (r['w'] / 2 + .5), 0, 1.0, soft=True)
        x += 16.0
for cx in (XC, XP, XM):
    for cz in (ZH, ZL):
        g.place('prop.street-sign', cx + 3.7, cz + (4.7 if cz > 0 else -4.7), 0, .8, soft=True)
        g.place('prop.fire-hydrant', cx - 3.7, cz + (4.7 if cz > 0 else -4.7), 0, .8, soft=True)

# ------------------------------------------------------------------------------------------------ the east backyards (dress-l8-cellar)
# Opus visual QA #35: "Kessler's cellar sits alone on a featureless dark-green plane at the map edge." A sealed pocket of the district
# reaches east of the lot fences (x 85..135, z -34.4..41.2). Its west side is the lots' own 84.4 fence line (z -34.4..41.2, no gap), so no
# street, lot or path opens into it and no gameplay route, nav cell or timing changes; it only gives the camera a suburb to look at:
# a fenced lane, two rows of houses back to back (the near row faces the cellar lot, the far row faces a green street), yards, trees,
# lamps, cars and one lit window (the lit house gets the always-on `l5-cue` group in L5, see src/levels/L5/layout.ts).
PX0, PX1, PZ0, PZ1 = W / 2, 135.0, -34.4, 41.2
l.data['bounds'][:] = [[-W / 2, -DEPTH / 2], [W / 2, -DEPTH / 2], [W / 2, PZ0], [PX1, PZ0], [PX1, PZ1], [W / 2, PZ1], [W / 2, DEPTH / 2], [-W / 2, DEPTH / 2], [-W / 2, -DEPTH / 2]]
l.box('east-yards-terrain', 'grass', [PX1 - PX0, .25, PZ1 - PZ0], [(PX0 + PX1) / 2, -.13, (PZ0 + PZ1) / 2])
l.box('east-lane-walk', 'sidewalk', [3.4, .12, PZ1 - PZ0], [86.8, .05, (PZ0 + PZ1) / 2])
import random as _random
_yr = _random.Random(1019)
_HOUSE = {'a': ('bld.house-a', 1.0, 4.1, -1.6), 'b': ('bld.house-b', 1.0, .2, 5.9), 'c': ('bld.house-c', .8, 5.6 * .8 + .3, -1.25 * .8),
          'd': ('bld.house-d', .8, 4.1 * .8 + .25, 0.0), 'e': ('bld.house-e', .85, 4.7 * .85 + .2, 0.0)}
_TINTS = ['#ffe58f', '#bfe8c8', '#b3d7f5', '#ffb8a3', '#d3dfae', '#fff6e6', '#d9c8f2']
def east_row(kinds, facing, front_x, z_start, gap, back_x):
    """One row of houses on the pocket; `front_x` is the line of the front walls, `back_x` the rear fence. Returns [(x, z, w, door_z)]."""
    yaw = FACE_YAW[facing]
    sgn = 1 if facing == 'W' else -1                    # direction from the front wall into the house (x)
    cursor, out = z_start, []
    for i, k in enumerate(kinds):
        asset, sc, ddx, ddz = _HOUSE[k]
        dx_, _, dz_ = dims(asset)
        zc = cursor + dz_ * sc / 2
        xc = front_x + sgn * dx_ * sc / 2
        g.place(asset, xc, zc, yaw, sc, tint=_TINTS[(i * 3 + (1 if facing == 'E' else 0)) % len(_TINTS)])
        ox, oz = rot(yaw, ddx, ddz)
        out.append((xc, zc, dz_ * sc, zc + oz, ox))
        # side fences between lots, from the front fence to the rear fence
        zb = cursor + dz_ * sc + gap / 2
        if i < len(kinds) - 1: g.fence('privacy', min(front_x - sgn * 1.0, back_x), zb, max(front_x - sgn * 1.0, back_x), zb)
        cursor += dz_ * sc + gap
    return out

_rowA = east_row('acbdea', 'W', 91.0, -33.2, 3.0, 106.0)
_rowB = east_row('ebacdb', 'E', 121.5, -30.0, 3.0, 106.0)
g.fence('privacy', 106.0, PZ0 + .4, 106.0, PZ1 - .4)                                  # the rear fence the two rows share
# front picket fences with a gap at each door path, a path to the lane, a hedge at the lane side
g.fence('picket', 89.6, PZ0 + 1.0, 89.6, PZ1 - 1.0, gaps=[(r[3], 1.7) for r in _rowA])
g.fence('picket', 123.2, PZ0 + 1.0, 123.2, PZ1 - 1.0, gaps=[(r[3], 1.7) for r in _rowB])
for r in _rowA:
    g.path(86.0, r[3] - .6, 91.2, r[3] + .6)
for r in _rowB:
    g.path(121.4, r[3] - .6, 126.5, r[3] + .6)
# the lane west of the near row: lamps, a hydrant, mailboxes, bins, parked cars
for z in range(-28, 41, 14):
    g.place('prop.street-lamp', 88.4, z + 4.0, 0, 1.0, soft=True)
g.place('prop.fire-hydrant', 88.2, -15.6, 0, .8, soft=True)
for i, r in enumerate(_rowA):
    g.place('prop.mailbox-blue', 88.2, r[3] + 1.8, math.pi, .8, soft=True)
    g.place('prop.trash-bin', 88.0, r[3] - 2.4, 0, .9, soft=True)
    if r[3] - 1.2 - (r[1] - r[2] / 2 + .3) > 1.5: g.hedge(90.4, r[1] - r[2] / 2 + .3, 90.4, r[3] - 1.2)
g.place('veh.sedan-white', 87.4, -21.0, math.pi / 2, 1.0, soft=True)
g.place('veh.suv-green', 87.4, 12.5, math.pi / 2, 1.0, soft=True)
# backyards (x 98..106 behind the near row, 106..114 behind the far row): trees, sheds, laundry, barbecues, chairs, bins
_yard = [('prop.tree', 104.2, .85), ('prop.street-tree-blossom', 102.6, .8), ('prop.tree', 103.4, .75)]
for i, r in enumerate(_rowA):
    z0, z1 = r[1] - r[2] / 2, r[1] + r[2] / 2
    t = _yard[i % 3]
    g.place(t[0], t[1], z0 + 1.6 + _yr.random() * (r[2] - 3.2), 0, t[2], soft=True)
    if i % 2 == 0: g.place('bld.shed', 102.8, z1 - 3.0, math.pi, .8, soft=True)
    else:
        g.place('prop.laundry-line', 101.8, z0 + r[2] / 2, math.pi / 2, 1.0, soft=True)
        g.place('prop.bbq', 100.9, z1 - 1.3, math.pi / 2, 1.0, soft=True)
    g.place('prop.lawn-chair-a', 100.8, z0 + 1.4, -math.pi / 2 + .4, 1.0, soft=True)
    g.place('prop.recycling-bin', 105.2, z0 + .9, 0, 1.0, soft=True)
for i, r in enumerate(_rowB):
    z0, z1 = r[1] - r[2] / 2, r[1] + r[2] / 2
    g.place('prop.tree' if i % 2 else 'prop.street-tree-blossom', 108.6, z0 + 1.5 + _yr.random() * (r[2] - 3.0), 0, .8, soft=True)
    if i % 3 == 0: g.place('bld.garage-detached', 109.4, z1 - 3.8, 0, .7, soft=True)
    elif i % 3 == 1: g.place('prop.kiddie-pool', 109.0, z0 + 2.2, 0, .9, soft=True); g.place('prop.gnome', 107.4, z0 + 1.2, 0, 1.0, soft=True)
    else: g.place('prop.wheelbarrow', 108.6, z1 - 1.0, math.pi / 2, 1.0, soft=True); g.place('prop.crates', 109.2, z1 - 2.4, 0, 1.0, soft=True)
# the green street east of the far row: cars in the drives, lamps, a pole line and a tree screen along the edge fence
for i, r in enumerate(_rowB):
    car = ['veh.pickup-white', 'veh.sedan-blue', 'veh.suv-dark', 'veh.sedan-red', 'veh.pickup-red', 'veh.sedan-white'][i % 6]
    g.place(car, 126.2, r[3] + (2.8 if i % 2 else -2.8), math.pi / 2 if i % 2 else -math.pi / 2, 1.0, soft=True)
    if r[3] - 1.2 - (r[1] - r[2] / 2 + .3) > 1.5: g.hedge(122.4, r[1] - r[2] / 2 + .3, 122.4, r[3] - 1.2)
for z in range(-26, 34, 13):
    g.place('prop.street-lamp', 129.0, z, 0, 1.0, soft=True)
    g.place('prop.utility-pole', 131.0, z + 4.5, 0, 1.0, soft=True)
for z in range(-31, 40, 7):
    g.place('prop.street-tree' if (z // 7) % 2 else 'prop.street-tree-blossom', 133.2 - (z // 7 % 2) * 1.2, z + _yr.random() * 2.0, 0, .9 + .2 * _yr.random(), soft=True)

# ------------------------------------------------------------------------------------------------ the cellar yard (dress-l8-cellar)
# The east lot (x 66..84.4, z -34.4..26.9) was a bare lawn round the cellar. It is a sealed island (the fences have no gap), so it takes
# a lived-in backyard that the game camera (south-east of the cellar, about 12 m of ground in frame at the default zoom) sees: a lit house at the
# south-west corner, a shed and a clothes line on the west strip, hedges on the fence lines, a vegetable garden and a picnic corner south of the
# door, a parked pickup and a tree on the east strip, lamps, and a second house and more trees further out for the wide zoom. Nothing stands
# within 1.5 m of the cellar footprint (x 69.5..80.5, z -9.9..1.9): its door, stair foot and brace anchors keep the open ground they had.
def lot(asset, x, z, yaw=0.0, s=1.0, **kw):
    if 69.5 < x < 80.5 and -9.9 < z < 1.9: return None
    return g.place(asset, x, z, yaw, s, soft=True, **kw)
YARD_LIT = (69.8, 12.4)
g.place('bld.house-c', YARD_LIT[0], YARD_LIT[1], FACE_YAW['E'], .8, tint='#ffe9b0')
l.anchor('cellar-yard-lit-house', [YARD_LIT[0], 0, YARD_LIT[1]])
g.place('bld.house-a', 70.4, -24.0, FACE_YAW['E'], 1.0, tint='#bfd8f0')
g.hedge(75.6, 26.1, 83.2, 26.1, scale=1.0)
g.hedge(68.2, -33.6, 82.0, -33.6, scale=1.0)
g.hedge(66.9, 0.2, 66.9, 8.4, scale=1.0)
g.hedge(66.9, -33.0, 66.9, -29.0, scale=1.0)
g.hedge(83.6, -31.5, 83.6, -9.0, scale=1.0)
g.hedge(83.6, 0.6, 83.6, 8.0, scale=1.0)
g.hedge(83.6, 13.0, 83.6, 24.5, scale=1.0)
for i, (x, z) in enumerate(((77.6, 7.6), (80.4, 7.6), (79.0, 10.4))):      # vegetable garden south of the door
    lot('prop.flower-bed.large' if i % 2 == 0 else 'prop.flower-bed', x, z, math.pi / 2 + (0 if i % 2 == 0 else math.pi))
lot('prop.flower-bed.small', 72.2, 5.6, math.pi / 2); lot('prop.flower-bed.small', 72.2, 7.4, math.pi / 2)
g.path(74.0, 0.4, 76.0, 6.6)                                               # flagstones from the cellar door to the garden
g.path(73.7, 12.0, 75.9, 12.9, 'sidewalk')                                  # front step path of the lit house
for x, z, a, s in ((82.8, -6.4, 'prop.tree', .8), (82.4, 19.6, 'prop.street-tree-blossom', .9), (76.0, 22.6, 'prop.tree', .85),
                   (67.6, -12.6, 'prop.tree', .85), (68.2, -29.5, 'prop.tree', .95), (82.2, -29.5, 'prop.street-tree-blossom', .95),
                   (80.8, -21.0, 'prop.tree', .9), (76.0, -30.6, 'prop.tree', .8), (68.2, 20.8, 'prop.street-tree', .85), (82.6, 3.8, 'prop.garden-bush', 1.0)):
    lot(a, x, z, 0, s)
lot('prop.bbq', 80.0, 14.4, math.pi / 2); lot('prop.lawn-chair-a', 77.8, 14.8, -2.2); lot('prop.lawn-chair-b', 79.4, 16.0, 2.6); lot('prop.folding-chair', 81.4, 15.6, 2.0)
lot('prop.laundry-line', 67.9, -2.4, 0); lot('prop.wheelbarrow', 74.6, 14.6, .4); lot('prop.crates', 73.9, 15.5, .2)
lot('prop.kiddie-pool', 79.4, 20.4); lot('prop.sprinkler', 77.2, 18.8, .8); lot('prop.gnome', 74.2, 7.6, 2.4); lot('prop.trash-bags', 83.0, 23.4, .7)
lot('veh.pickup-white', 82.4, 11.2, math.pi / 2, .9)
lot('bld.shed', 68.5, -7.4, 0, .75)
lot('prop.street-lamp', 68.0, 2.8); lot('prop.street-lamp', 82.2, 2.6)
lot('prop.bench', 80.8, -11.6, math.pi); lot('prop.crates', 82.4, -25.6, .3); lot('prop.pallet', 82.6, -26.9, .1)
lot('prop.recycling-bin', 67.6, -11.0, 0); lot('prop.trash-bin', 67.6, -12.2, 0); lot('prop.wheelbarrow', 79.0, -24.0, 1.2)
lot('bld.shed', 81.8, -31.0, math.pi, .8)

# ------------------------------------------------------------------------------------------------ anchors
for i, d in enumerate(sorted(doors), 1):
    anchors[f'refuge-door-{i}'] = d
anchors['player-start'] = (-64.0, ZL - 2.2)
anchors['edge-in-1'] = (-82.0, ZH)           # Harbor Street west end
anchors['edge-in-2'] = (82.0, ZH)            # Harbor Street east end
anchors['edge-in-3'] = (82.0, ZL)            # Lakeshore east end
anchors['edge-in-4'] = (XC, 40.0)            # Church Road south
anchors['edge-in-5'] = (XM, ZH + 3.0)        # Metro Road north
anchors['metro-entrance'] = (MET_X, FRONT_NH + 1.6)
anchors['town-hall-steps'] = (HALL_X, -21.0)
anchors['cellar-interior'] = (CELLAR_X, CELLAR_Z)
for name, (x, z) in anchors.items():
    l.anchor(name, [x, 0, z])

for _m in G.clear_contacts(g): print('clearance', *_m)
from pathlib import Path
out = Path(__file__).resolve().parents[2] / '.cache/layouts'
out.mkdir(parents=True, exist_ok=True)
(out / 'D-FAIR.problems.txt').write_text('\n'.join(g.problems) + '\n')
l.export()
