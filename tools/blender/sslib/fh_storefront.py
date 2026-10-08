"""bld.storefront-row: three connected two-storey Fairhaven shops (brick / mustard / coral).

+X front. Three 5.2 m bays centred on y = -5.2, 0, 5.2; walls are solid massing, every
facade feature is an explicit solid. Materials (8): brick, mustard, plaidRed, canvasTan,
backpackTeal, asphalt, sidewalk, emissive windowGlow.
"""
import math
from mathutils import Vector

BAYS = [
    dict(yc=-5.2, wall='brick', awn='brick', sign='brick', door='brick', name='FAIRHAVEN BAKERY', n=1),
    dict(yc=0.0, wall='mustard', awn='mustard', sign='asphalt', door='mustard', name='HARBOR BOOKS', n=2),
    dict(yc=5.2, wall='plaidRed', awn='backpackTeal', sign='backpackTeal', door='backpackTeal', name='LANTERN CAFE', n=3),
]
FACE = 4.0          # front wall plane
REAR = -4.0
TAN = 'canvasTan'


def upper_window(s, sx, x0, y, z, lit, wide=1.0, along='y'):
    """Cream-surround window facing +/-X (along='y') or +/-Y (along='x', x0 is the lateral position)."""
    if along == 'y':
        def P(dx, dy, dz): return (sx * (x0 + dx), y + dy, z + dz)
        def Z(a, b, c): return (a, b, c)
    else:
        def P(dx, dy, dz): return (y + dy, sx * (x0 + dx), z + dz)
        def Z(a, b, c): return (a, b, c)
    # backing frame, glass, bars, sill and lintel are all solids, proud of the wall by increasing depth
    size = lambda t, w, h: (t, w, h) if along == 'y' else (w, t, h)
    s.box('winFrame', P(.05, 0, 0), size(.10, wide + .30, 1.9), TAN)
    s.box('winGlass', P(.118, 0, 0), size(.03, wide, 1.55), 'glow' if lit else 'asphalt')
    for dz in (-.86, .86):
        s.box('winBarH', P(.15, 0, dz * .94), size(.08, wide + .30, .14), TAN, d=1)
    for dy in (-wide / 2 - .07, wide / 2 + .07):
        s.box('winBarV', P(.15, dy, 0), size(.08, .12, 1.76), TAN, d=1)
    s.box('winMullion', P(.145, 0, 0), size(.05, .06, 1.55), TAN, d=1)
    s.box('winTransom', P(.145, 0, .22), size(.05, wide, .06), TAN, d=1)
    s.box('winSill', P(.17, 0, -1.0), size(.30, wide + .55, .14), TAN, d=1)
    s.box('winLintel', P(.12, 0, 1.0), size(.24, wide + .5, .20), TAN, d=1)
    if along == 'y' and sx > 0:
        s.box('flowerBox', P(.28, 0, -.82), size(.20, wide + .3, .16), 'asphalt', d=0)
        for k in range(5):
            tok = ['brick', 'mustard', 'plaidRed', 'backpackTeal', TAN][(int(y * 3) + k) % 5]
            s.box('flower', P(.28, -wide / 2 + .02 + k * (wide - .04) / 4, -.66), size(.14, .15, .16), tok, d=0, bevel=.02)


def awning(s, yc, token):
    # sloped stripes: top edge at (4.05, 3.55), lower edge at (4.95, 2.85)
    top, low = (4.05, 3.55), (4.95, 2.85)
    length = math.hypot(low[0] - top[0], low[1] - top[1]) + .08
    theta = math.atan2(top[1] - low[1], low[0] - top[0])
    mid = ((top[0] + low[0]) / 2, (top[1] + low[1]) / 2)
    count = 8
    width = 4.6 / count
    for i in range(count):
        y = yc - 2.3 + width * (i + .5)
        tok = token if i % 2 == 0 else TAN
        s.box('awningStripe', (mid[0], y, mid[1]), (length, width * 1.0, .07), tok, rot=(0, theta, 0), bevel=0)
        s.box('awningValance', (low[0] + .02, y, low[1] - .15), (.07, width, .30), tok, bevel=0, d=2)
    for side in (-1, 1):
        y = yc + side * 2.3
        s.extrude('awningCheek', [(4.04, 3.52), (4.97, 2.84), (4.97, 2.62), (4.04, 2.62)], 'y', y - .035, y + .035, token)
    # wooden brackets under the awning (d=1)
    for side in (-1, 0, 1):
        y = yc + side * 2.15
        s.beam('awningStay', (4.06, y, 2.62), (4.9, y, 2.9), .05, 'asphalt', d=1)


def dressing(s, bay):
    yc, n = bay['yc'], bay['n']
    if n == 1:      # bread crates and a sandwich board
        for k, (dy, z) in enumerate([(-2.0, .32), (-1.55, .32), (-1.78, .72)]):
            s.box('crate', (4.62, yc + dy, z), (.42, .42, .36 if k < 2 else .34), TAN, bevel=.02, d=1)
            s.box('crateLid', (4.62, yc + dy, z + .19), (.38, .38, .04), 'brick', d=0)
        s.box('boardLegA', (4.7, yc + 2.0, .45), (.5, .06, .9), TAN, rot=(.28, 0, 0), d=1)
        s.box('boardLegB', (4.7, yc + 2.3, .45), (.5, .06, .9), TAN, rot=(-.28, 0, 0), d=1)
    elif n == 2:    # book cart
        s.box('cartBody', (4.7, yc - 1.4, .58), (.62, 1.3, .5), 'asphalt', bevel=.02, d=1)
        for k in range(9):
            s.box('cartBook', (4.7, yc - 1.95 + k * .14, .92), (.46, .1, .26 + .06 * (k % 3)), ['brick', 'mustard', 'backpackTeal', TAN, 'plaidRed'][k % 5], d=1, bevel=0)
        for dy in (-.7, .7):
            s.tube('cartWheel', (4.7, yc - 1.4 + dy, .22), .15, .1, 'asphalt', (math.pi / 2, 0, 0), d=1)
        s.beam('cartHandle', (4.36, yc - 2.12, .55), (4.36, yc - 2.12, 1.15), .05, 'asphalt', d=1)
    else:           # cafe table and two chairs
        s.tube('cafeTable', (4.65, yc - 1.4, .78), .38, .06, TAN, d=1)
        s.tube('cafeTableLeg', (4.65, yc - 1.4, .4), .05, .76, 'asphalt', d=1)
        s.tube('cafeTableFoot', (4.65, yc - 1.4, .06), .22, .08, 'asphalt', d=1)
        for dy in (-.62, .62):
            s.box('chairSeat', (4.65, yc - 1.4 + dy, .46), (.4, .4, .06), 'backpackTeal', d=1)
            s.box('chairBack', (4.65, yc - 1.4 + dy + (.19 if dy > 0 else -.19), .75), (.4, .05, .5), 'backpackTeal', d=1)
            for lx in (-.15, .15):
                for ly in (-.15, .15):
                    s.box('chairLeg', (4.65 + lx, yc - 1.4 + dy + ly, .22), (.05, .05, .44), 'asphalt', d=0)
        s.box('planter', (4.7, yc + .3, .3), (.5, 1.0, .4), 'brick', bevel=.02, d=1)
        for k in range(4):
            s.box('planterLeaf', (4.7, yc - .05 + k * .24, .55), (.2, .2, .22), 'backpackTeal', d=1, bevel=.03)
            s.box('planterBloom', (4.7, yc - .05 + k * .24, .72), (.12, .12, .1), 'mustard', d=0, bevel=.02)


def blade_signs(s):
    for y, tok in ((-7.8, 'brick'), (-2.6, 'backpackTeal'), (2.6, 'mustard')):
        s.box('bladeFrame', (4.8, y, 4.35), (1.06, .10, 1.06), TAN)
        s.box('bladeBoard', (4.8, y, 4.35), (.96, .14, .92), tok)
        s.box('bladeGlow', (4.8, y, 4.35), (.66, .17, .58), 'glow')
        s.box('bladeCore', (4.8, y, 4.35), (.30, .19, .30), tok, d=1)
        s.box('bladeArm', (4.55, y, 4.95), (.78, .07, .07), 'asphalt')
        s.beam('bladeStay', (4.28, y, 4.5), (4.7, y, 4.93), .05, 'asphalt', d=1)
        for dx in (-.38, .38):
            s.box('bladeHanger', (4.8 + dx, y, 4.9), (.04, .04, .1), 'asphalt', d=1)


def roof_equipment(s):
    top = 7.62
    for k, (x, y) in enumerate([(-2.3, -4.1), (1.2, 3.3), (-1.0, -0.9), (2.6, -6.0)]):
        s.box('acUnit', (x, y, top + .35), (1.2, 1.0, .7), TAN)
        s.tube('acFan', (x, y, top + .72), .36, .05, 'asphalt', sides=(16, 10, 8))
        s.box('acFanBar', (x, y, top + .76), (.7, .06, .04), 'asphalt', d=0)
        s.box('acFanBar', (x, y, top + .76), (.06, .7, .04), 'asphalt', d=0)
        s.box('acFoot', (x, y, top + .04), (1.3, 1.1, .08), 'asphalt', d=1)
    for x, y, w, d in [(-1.0, 1.0, 3.0, 2.2), (2.0, -3.5, 2.4, 2.0), (-2.5, 4.0, 2.0, 1.8)]:
        s.box('tarPatch', (x, y, top + .008), (w, d, .02), 'sidewalk', d=1)
    for x, y in [(1.5, 6.5), (-3.0, 2.0), (0.5, -6.2), (3.0, 0.3)]:
        s.tube('ventPipe', (x, y, top + .55), .09, 1.1, 'asphalt', sides=(10, 8, 6), d=1)
        s.tube('ventCap', (x, y, top + 1.12), .15, .06, 'asphalt', sides=(10, 8, 6), d=1)
    # water tank on legs
    tx, ty = -2.9, -1.4
    for dx in (-.55, .55):
        for dy in (-.55, .55):
            s.box('tankLeg', (tx + dx, ty + dy, top + .55), (.1, .1, 1.1), 'asphalt', d=1)
    s.tube('tank', (tx, ty, top + 1.8), .85, 1.4, TAN, sides=(18, 12, 8))
    s.tube('tankLid', (tx, ty, top + 2.54), .9, .08, 'asphalt', sides=(18, 12, 8), d=1)
    for z in (1.4, 2.2):
        s.tube('tankHoop', (tx, ty, top + z), .87, .06, 'asphalt', sides=(18, 12, 8), d=0)
    s.box('chimney2', (3.2, 5.0, top + 1.0), (.9, .9, 2.0), 'brick')
    s.box('chimney2Cap', (3.2, 5.0, top + 2.05), (1.1, 1.1, .12), TAN, d=1)


def street_lamps(s):
    for n, y in enumerate((-5.2, 5.2)):
        x = 5.2
        s.tube('lampPost', (x, y, 1.75), .06, 3.2, 'asphalt', d=1)
        s.tube('lampBase', (x, y, .45), .14, .5, 'asphalt', d=1)
        s.box('lampArm', (x - .08, y, 3.4), (.35, .05, .05), 'asphalt', d=1)
        s.box('lampCap', (x - .15, y, 3.78), (.34, .34, .08), 'asphalt')
        s.box('lampLantern', (x - .15, y, 3.55), (.24, .24, .32), 'glow')
        s.box('lampFoot', (x - .15, y, 3.34), (.30, .30, .06), 'asphalt', d=1)
        s.light('streetLamp%d' % (n + 1), (x - .15, y, 3.4), 'point', 'light_window_warm', 2.4, 7.5, 'fairhaven-storefront-row')


def shopfront(s, bay):
    yc, n = bay['yc'], bay['n']
    # kick panel
    s.box('kickPanel', (4.06, yc, .62), (.14, 4.65, .84), TAN)
    for k in range(3):
        s.box('kickInset', (4.14, yc - 1.3 + k * 1.3 - .0, .62), (.03, 1.0, .46), bay['wall'] if bay['wall'] != 'brick' else 'brick', d=1)
    yw = yc - .875
    # shop window
    s.box('shopFrame', (4.05, yw, 1.78), (.10, 2.65, 2.02), TAN)
    s.box('shopGlass', (4.118, yw, 1.78), (.03, 2.35, 1.72), 'glow')
    # interior silhouettes seen through the glow (shelves, counter, goods)
    for z in (1.18, 1.72, 2.26):
        s.box('shopShelf', (4.14, yw, z), (.05, 2.2, .045), 'asphalt', d=1)
    for k in range(7):
        c = [bay['sign'], 'mustard', TAN, bay['awn']][k % 4]
        s.box('shopGoods', (4.155, yw - .95 + k * .32, 1.30 + .0 if k % 2 == 0 else 1.84), (.05, .18 + .04 * (k % 3), .22 + .04 * (k % 2)), c, d=0)
    s.box('shopCounter', (4.14, yw + .45, .98), (.07, .9, .35), 'asphalt', d=0)
    for dz in (-.93, .93):
        s.box('shopBarH', (4.14, yw, 1.78 + dz), (.09, 2.65, .14), TAN)
    for dy in (-1.26, 1.26):
        s.box('shopBarV', (4.14, yw + dy, 1.78), (.09, .14, 2.0), TAN)
    s.box('shopMullion', (4.15, yw - .1, 1.78), (.06, .07, 1.72), TAN, d=1)
    s.box('shopTransom', (4.15, yw, 2.28), (.05, 2.35, .06), TAN, d=1)
    s.box('shopSill', (4.2, yw, .86), (.30, 2.85, .14), TAN, d=1)
    # entrance door
    yd = yc + 1.55
    s.box('doorFrame', (4.05, yd, 1.42), (.12, 1.34, 2.44), TAN)
    s.box('doorLeaf', (4.13, yd, 1.34), (.08, 1.0, 2.22), bay['door'])
    s.box('doorGlass', (4.178, yd, 1.76), (.03, .62, 1.0), 'glow')
    s.box('doorPanel', (4.18, yd, .62), (.03, .72, .62), bay['door'], d=1)
    s.box('doorBarV', (4.18, yd, 1.76), (.04, .07, 1.0), bay['door'], d=1)
    s.box('doorBarH', (4.18, yd, 1.76), (.04, .62, .07), bay['door'], d=1)
    s.box('doorHandle', (4.20, yd - .34, 1.28), (.06, .06, .30), TAN, d=1)
    s.box('doorHead', (4.12, yd, 2.62), (.20, 1.6, .16), TAN, d=1)
    s.box('doorStep', (4.5, yd, .27), (.7, 1.4, .14), TAN, d=1)
    awning(s, yc, bay['awn'])
    dressing(s, bay)
    # sign band
    s.box('signFrame', (4.10, yc, 3.95), (.16, 4.65, .66), TAN)
    s.box('signBoard', (4.2, yc, 3.95), (.07, 4.4, .48), bay['sign'])
    s.text(bay['name'], (4.245, yc, 3.95), .31, TAN)
    # hanging lamp bracket glow
    s.box('signLamp', (4.32, yc + 1.9, 4.38), (.12, .22, .10), 'glow', d=1)


def facade_upper(s, bay, idx):
    yc = bay['yc']
    for k, off in enumerate((-1.0, 1.0)):
        upper_window(s, 1, FACE, yc + off, 5.85, (idx + k) % 2 == 0)
    s.box('stringCourse', (4.12, yc, 4.52), (.34, 4.65, .26), TAN)
    s.box('stringCourseUnder', (4.07, yc, 4.35), (.24, 4.65, .10), TAN, d=1)
    if bay['wall'] == 'brick':
        # brick courses (all tiers keep courses, LOD0 adds individual staggered bricks)
        for r in range(11):
            z = 4.84 + r * .245
            s.box('brickCourse', (4.015, yc, z), (.04, 4.65, .05), 'brick', d=1)
        for r in range(11):
            z = 4.84 + r * .245 + .12
            for c in range(11):
                y = yc - 2.1 + c * .43 + (.21 if r % 2 else 0)
                if abs((y - yc) - 1.0) < .75 or abs((y - yc) + 1.0) < .75:
                    if 5.0 < z < 6.7:
                        continue
                if abs(y - yc) > 2.25:
                    continue
                s.box('brick', (4.02, y, z), (.045, .38, .20), 'brick', d=0, bevel=.012)
    elif bay['wall'] == 'mustard':
        for r in range(6):
            s.box('stuccoBand', (4.01, yc, 4.9 + r * .45), (.025, 4.65, .035), 'mustard', d=0)
    else:
        for r in range(6):
            s.box('stuccoBand', (4.01, yc, 4.9 + r * .45), (.025, 4.65, .035), 'plaidRed', d=0)
    # cornice with dentils
    s.box('cornice', (3.95, yc, 7.5), (.80, 5.2, .30), TAN)
    s.box('corniceLip', (4.30, yc, 7.34), (.14, 5.0, .12), TAN, d=1)
    for k in range(16):
        s.box('dentil', (4.31, yc - 2.4 + k * .32, 7.22), (.12, .16, .18), TAN, d=0)
    s.box('parapetFront', (4.0, yc, 7.88), (.42, 5.2, .46), TAN)
    s.box('parapetPanel', (4.215, yc, 7.88), (.03, 4.5, .26), TAN, d=0)


def rear_bay(s, bay, idx):
    yc = bay['yc']
    for k, off in enumerate((-1.0, 1.0)):
        upper_window(s, -1, FACE, yc + off, 5.85, (idx + k + 1) % 2 == 0)
    s.box('rearString', (-4.12, yc, 4.52), (.34, 4.65, .26), TAN)
    s.box('rearCornice', (-3.95, yc, 7.5), (.80, 5.2, .30), TAN)
    s.box('rearParapet', (-4.0, yc, 7.88), (.42, 5.2, .46), TAN)
    for k in range(16):
        s.box('rearDentil', (-4.31, yc - 2.4 + k * .32, 7.22), (.12, .16, .18), TAN, d=0)
    # back door, step and lamp
    yd = yc + (-.4 if idx == 1 else .4)
    s.box('rearDoorFrame', (-4.05, yd, 1.42), (.12, 1.34, 2.44), TAN)
    s.box('rearDoorLeaf', (-4.13, yd, 1.34), (.08, 1.0, 2.22), bay['door'])
    s.box('rearDoorPanel', (-4.18, yd, .78), (.03, .72, .7), bay['door'], d=1)
    s.box('rearDoorPanelTop', (-4.18, yd, 1.9), (.03, .72, .7), bay['door'], d=1)
    s.box('rearDoorHandle', (-4.2, yd - .34, 1.28), (.06, .06, .30), TAN, d=1)
    s.box('rearDoorHead', (-4.12, yd, 2.62), (.20, 1.6, .16), TAN, d=1)
    s.box('rearStep', (-4.4, yd, .30), (.6, 1.5, .20), TAN)
    s.box('rearLamp', (-4.22, yd, 2.95), (.12, .26, .18), 'glow')
    s.box('rearBase', (-4.06, yc, .55), (.14, 4.65, .7), TAN, d=1)
    for z in (4.84 + r * .245 for r in range(11)):
        if bay['wall'] == 'brick':
            s.box('rearBrickCourse', (-4.015, yc, z), (.04, 4.65, .05), 'brick', d=1)


def recipe(s):
    roof = None  # no separate roof owner: it would add per-material draws beyond the 8-draw cap
    s.box('plinth', (.35, 0, .1), (10.1, 16.2, .2), 'sidewalk', bevel=.03)
    s.box('curb', (5.25, 0, .15), (.3, 16.2, .30), 'sidewalk', bevel=.03)
    for r in range(2):
        for c in range(16):
            s.box('paver', (4.55 + r * .42, -7.5 + c * 1.0, .2), (.38, .94, .02), 'sidewalk', d=0, bevel=.008)
    for i, bay in enumerate(BAYS):
        yc = bay['yc']
        s.box('mass', (0, yc, 3.85), (8.0, 5.2, 7.3), bay['wall'], bevel=0)
        shopfront(s, bay)
        facade_upper(s, bay, i)
        rear_bay(s, bay, i)
        # roof furniture
        s.box('skylightFrame', (-.2, yc, 7.8), (2.3, 1.7, .28), TAN, roof)
        s.box('skylightGlass', (-.2, yc, 7.95), (1.9, 1.3, .08), 'backpackTeal', roof, d=1)
        s.box('skylightRidge', (-.2, yc, 8.05), (1.9, .12, .1), TAN, roof, d=0)
        s.box('roofVent', (2.2, yc + .9, 7.82), (.5, .5, .32), 'asphalt', roof, d=1)
        s.light('shop%dWindow' % bay['n'], (4.45, yc - .875, 1.85), 'window', 'light_window_warm', 2.2, 5.5, 'fairhaven-storefront-row')
        sockets_pos = {'shop%dDoor' % bay['n']: (4.7, yc + 1.55, .2), 'rear%dDoor' % bay['n']: (-4.75, yc + (-.4 if i == 1 else .4), .2)}
        from . import sockets
        for name, p in sockets_pos.items():
            sockets.empty(name + 'Socket', p, s.root)
    street_lamps(s)
    blade_signs(s)
    roof_equipment(s)
    # roof deck, parapets (roof owner), chimney stack, AC unit
    s.box('roofDeck', (0, 0, 7.55), (7.7, 15.5, .14), 'asphalt', roof)
    for sy in (-7.65, 7.65):
        s.box('parapetSide', (0, sy, 7.88), (8.4, .30, .46), TAN, roof)
    s.box('parapetRearCap', (-4.0, 0, 8.14), (.5, 15.6, .07), TAN, roof, d=1)
    s.box('parapetFrontCap', (4.0, 0, 8.14), (.5, 15.6, .07), TAN, roof, d=1)
    for y in (-7.8, -2.6, 2.6, 7.8):
        for x in (-4.1, 4.1):
            s.box('pilasterBase', (x, y, .5), (.46, .78, .6), TAN, d=1)
            s.box('pilasterShaft', (x, y, 3.95), (.34, .6, 7.5), TAN)
            s.box('pilasterCap', (x, y, 8.0), (.62, .80, .62), TAN, roof)
            s.box('pilasterCapTop', (x, y, 8.4), (.76, .94, .14), TAN, roof, d=1)
    s.box('chimney', (-2.4, 6.3, 8.55), (.95, .95, 1.8), 'brick', roof)
    s.box('chimneyCap', (-2.4, 6.3, 9.5), (1.15, 1.15, .14), TAN, roof, d=1)
    # side walls: windows + base bands
    for sy in (-1, 1):
        for x in (-1.9, 1.9):
            upper_window(s, sy, 7.8, x, 5.85, False if sy < 0 else (x > 0), along='x')
        s.box('sideBase', (0, sy * 7.88, .55), (8.2, .14, .7), TAN, d=1)
        s.box('sideString', (0, sy * 7.88, 4.52), (8.2, .3, .26), TAN)
        s.box('sideDownspout', (-3.5, sy * 7.9, 3.8), (.14, .14, 7.2), 'asphalt', d=1)
    # side wall brick/ledge detail
    for r in range(22):
        s.box('sideLedge', (0, -7.815, .95 + r * .3), (8.0, .035, .05), 'brick', d=1)
    for r in range(22):
        s.box('sideLedge', (0, 7.815, .95 + r * .3), (8.0, .035, .05), 'plaidRed', d=1)
    for r in range(8):
        for c in range(9):
            s.box('sideBrick', (-3.7 + c * .92 + (.46 if r % 2 else 0), -7.82, .9 + r * .3 + .15), (.82, .035, .22), 'brick', d=0, bevel=.01)
    from . import colliders
    colliders.cuboid('walls', (8.4, 16.2, 7.5), (0, 0, 3.95), s.root)
    s.physics('fixed', 0, False)
