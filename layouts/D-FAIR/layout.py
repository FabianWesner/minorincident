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
# the yard behind the block (x -85..-73) is the sealed cellar yard
for x0, z0, x1, z1 in ((-84.4, -34.6, -73.2, -34.6), (-84.4, 40.6, -73.2, 40.6), (-84.4, -34.6, -84.4, 40.6), (-73.2, -34.6, -73.2, 40.6)):
    g.fence('privacy', x0, z0, x1, z1)
g.fence('privacy', -73.4, 40.6, -62.8, 40.6)
CELLAR_X, CELLAR_Z = -79.0, 3.0
CELLAR_ID = g.place('int.basement-cellar', CELLAR_X, CELLAR_Z, PI / 2, 1.0, check=False, y=-.3)   # its floor top is 0.3 m: the player walks at y 0
# The baked slab would block the whole room: the cellar is non-solid and its walls, shelves and stair are authored here
# (local x, z of the model -> world (cx + z, cz - x) at yaw pi/2), 2.4 m high.
def cellar_box(name, x0, x1, z0, z1):
    g.collide_only(name, [z1 - z0, 2.4, x1 - x0], [CELLAR_X + (z0 + z1) / 2, 1.2, CELLAR_Z - (x0 + x1) / 2])
cellar_box('cellar-back', -4.4, -3.3, -3.4, 3.4); cellar_box('cellar-front', 4.0, 4.4, -3.4, 3.4)
cellar_box('cellar-left', -4.4, 4.4, 2.3, 3.4); cellar_box('cellar-right', -4.4, 4.4, -3.4, -2.3)
cellar_box('cellar-shelves', -3.05, .25, -2.28, -1.58); cellar_box('cellar-stair', -3.3, 1.7, 1.3, 2.3)
g.path(-83.0, -1.0, -75.0, 7.0, 'sidewalk')
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
# Lakeshore front south of Kessler Lane: pharmacy, Kessler's Hardware (cellar door on the lane), a supermarket
FRONT_LK = 40.2
put('lk', 'bld.pharmacy', 'S', FRONT_LK, 58.0)
HW_X = 68.0
_, hwx, hwz = put('lk', 'bld.kessler-hardware', 'S', FRONT_LK, HW_X)
put('lk', 'bld.supermarket', 'S', FRONT_LK, 78.5)
fill('lk', max_gap=3.0)
g.fence('privacy', 54.8, 30.2, 61.2, 30.2)
g.fence('privacy', 84.4, 26.9, 84.4, 41.2)
g.fence('privacy', 84.4, 51.0, 84.4, 56.4)
# local (-4.1, -1.6) is the cellar door socket (rear wall); with yaw -pi/2 that is world (x + 1.6, z - 4.1)
ox, oz = rot(FACE_YAW['S'], -4.1, -1.6)
CELLAR_DOOR = (hwx + ox, hwz + oz)
anchors['kessler-cellar-door'] = (CELLAR_DOOR[0], CELLAR_DOOR[1] - 1.4)

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
