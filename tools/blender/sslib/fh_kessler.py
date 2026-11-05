"""bld.kessler-hardware: two-storey brick hardware store with hip roof, striped awning, rear cellar door.

+X front (Kessler Lane shopfront), -X rear carries the cellar door `door_cellar` and the
`cellarDoorSocket` shared with int.basement-cellar. Materials (8): brick, woodWarm, canvasTan,
asphalt (slate roof, dark trim), redDark, backpackTeal, sidewalk, emissive windowGlow.
"""
import json
import math
from mathutils import Vector
from . import sockets, colliders

TAN = 'canvasTan'
WOOD = 'woodWarm'
EAVE_Z = 7.3
RIDGE_Z = 9.7
A, B = 3.95, 4.55   # roof half extents (x, y)
RIDGE = .6          # ridge half length along Y


def window(s, plane, along, lat, z, lit, face, wide=1.0):
    """Stone-surround window on a wall. along='x': wall normal is +/-X at x=plane, `lat` is y;
    along='y': wall normal +/-Y at y=plane, `lat` is x. face = +1 / -1 outward sign."""
    def P(t, w, dz):
        return (plane + face * t, lat + w, z + dz) if along == 'x' else (lat + w, plane + face * t, z + dz)

    def sz(t, w, h):
        return (t, w, h) if along == 'x' else (w, t, h)
    s.box('winFrame', P(.05, 0, 0), sz(.10, wide + .32, 1.95), TAN)
    s.box('winGlass', P(.118, 0, 0), sz(.03, wide, 1.6), 'glow' if lit else 'asphalt')
    for dz in (-.88, .88):
        s.box('winBarH', P(.15, 0, dz), sz(.08, wide + .32, .14), TAN, d=1)
    for w in (-wide / 2 - .08, wide / 2 + .08):
        s.box('winBarV', P(.15, w, 0), sz(.08, .12, 1.8), TAN, d=1)
    s.box('winMullion', P(.145, 0, 0), sz(.05, .06, 1.6), TAN, d=1)
    s.box('winTransom', P(.145, 0, .2), sz(.05, wide, .06), TAN, d=1)
    s.box('winSill', P(.17, 0, -1.03), sz(.30, wide + .55, .14), TAN, d=1)
    s.box('winLintel', P(.12, 0, 1.04), sz(.24, wide + .5, .20), TAN, d=1)


def awning(s):
    top, low = (3.93, 3.50), (5.0, 2.72)
    length = math.hypot(low[0] - top[0], low[1] - top[1]) + .08
    theta = math.atan2(top[1] - low[1], low[0] - top[0])
    mid = ((top[0] + low[0]) / 2, (top[1] + low[1]) / 2)
    count, span = 14, 7.7
    w = span / count
    for i in range(count):
        y = -span / 2 + w * (i + .5)
        tok = 'redDark' if i % 2 == 0 else TAN
        s.box('awningStripe', (mid[0], y, mid[1]), (length, w, .08), tok, rot=(0, theta, 0), bevel=0)
        s.box('awningValance', (low[0] + .02, y, low[1] - .17), (.08, w, .34), tok, bevel=0)
    for side in (-1, 1):
        y = side * span / 2
        s.extrude('awningCheek', [(3.92, 3.47), (5.02, 2.71), (5.02, 2.38), (3.92, 2.38)], 'y', y - .04, y + .04, 'redDark')
    for y in (-3.6, -1.8, 0, 1.8, 3.6):
        s.beam('awningStay', (3.95, y, 2.55), (4.95, y, 2.78), .06, WOOD, d=1)


def tool_rack(s):
    # shovels, rake and broom leaning in a wooden rack left of the door (street side -Y)
    x = 4.35
    for y in (-3.45, -2.4):
        s.box('rackPost', (x, y, .95), (.09, .09, 1.6), WOOD, d=1)
    for z in (.45, 1.05):
        s.box('rackRail', (x, -2.925, z), (.07, 1.15, .07), WOOD, d=1)
    s.box('rackFoot', (x + .05, -2.925, .09), (.4, 1.2, .12), WOOD, d=1)
    for k, y in enumerate((-3.3, -3.0, -2.7, -2.5)):
        z0 = .5 + (.05 * (k % 2))
        s.box('toolHandle', (x + .1, y, z0 + .75), (.045, .045, 1.6 - .1 * (k % 2)), WOOD, d=1)
        if k < 2:       # shovel blades
            s.box('shovelBlade', (x + .1, y, z0 + .0), (.05, .26, .38), 'sidewalk', d=1)
            s.box('shovelGrip', (x + .1, y, z0 + 1.5), (.05, .14, .06), WOOD, d=1)
        elif k == 2:    # rake
            s.box('rakeHead', (x + .1, y, z0 + .1), (.05, .42, .07), 'sidewalk', d=1)
            for t in range(4):
                s.box('rakeTine', (x + .1, y - .15 + t * .1, z0 - .02), (.04, .03, .14), 'sidewalk', d=0)
        else:           # broom
            s.box('broomHead', (x + .1, y, z0 + .0), (.12, .3, .36), TAN, d=1)
    # crate with hand tools
    s.box('toolCrate', (4.5, -1.75, .33), (.5, .55, .46), WOOD, d=1)
    for k in range(3):
        s.box('crateTool', (4.5, -1.9 + k * .15, .85), (.05, .05, .6), WOOD, d=1)
        s.box('crateToolHead', (4.5, -1.9 + k * .15, 1.17), (.05, .14, .07), 'sidewalk', d=1)


def paint_shelf(s):
    x = 4.4
    for y in (1.9, 3.1):
        for dx in (-.2, .2):
            s.box('shelfPost', (x + dx, y, .9), (.07, .07, 1.5), WOOD, d=1)
    for z in (.32, .82, 1.32):
        s.box('shelfBoard', (x, 2.5, z), (.52, 1.35, .06), WOOD, d=1)
    cols = ['redDark', 'asphalt', TAN, 'redDark', 'asphalt', TAN]
    for r, z in enumerate((.32, .82, 1.32)):
        for k in range(5):
            y = 2.0 + k * .24
            s.box('paintCan', (x, y, z + .13), (.18, .18, .20), 'sidewalk', d=1, bevel=0)
            s.box('paintLid', (x, y, z + .245), (.19, .19, .035), cols[(k + r) % 6], d=1, bevel=0)
    s.box('bucketCrate', (4.55, 3.5, .3), (.45, .4, .4), WOOD, d=1)
    for k in range(3):
        s.box('crateBroom', (4.55, 3.4 + k * .1, .85), (.04, .04, .9), WOOD, d=1)
        s.box('crateBroomHead', (4.55, 3.4 + k * .1, 1.27), (.06, .09, .22), TAN, d=1)


def shopfront(s):
    # timber posts framing the two shop windows and the double door
    for y in (-3.8, 3.8):
        s.box('shopPost', (3.72, y, 1.85), (.42, .45, 3.3), WOOD)
        s.box('shopPostBase', (3.74, y, .35), (.5, .56, .3), WOOD, d=1)
        s.box('shopPostCap', (3.74, y, 3.5), (.5, .58, .18), WOOD, d=1)
    s.box('doorPostL', (3.66, -1.15, 1.85), (.3, .3, 3.3), WOOD, d=1)
    s.box('doorPostR', (3.66, 1.15, 1.85), (.3, .3, 3.3), WOOD, d=1)
    for side in (-1, 1):
        yw = side * 2.3
        s.box('shopFrame', (3.6, yw, 1.95), (.14, 2.3, 2.7), WOOD)
        s.box('shopGlass', (3.675, yw, 1.95), (.03, 2.0, 2.3), 'glow')
        for z in (-1.25, 1.25):
            s.box('shopBarH', (3.7, yw, 1.95 + z), (.12, 2.3, .14), WOOD)
        for dy in (-1.08, 1.08):
            s.box('shopBarV', (3.7, yw + dy, 1.95), (.12, .14, 2.7), WOOD)
        s.box('shopMullion', (3.71, yw, 1.95), (.08, .08, 2.3), WOOD, d=1)
        s.box('shopTransom', (3.71, yw, 2.65), (.08, 2.0, .08), WOOD, d=1)
        s.box('shopBulkhead', (3.68, yw, .52), (.20, 2.3, .64), WOOD)
        for k in range(3):
            s.box('bulkheadInset', (3.79, yw - .7 + k * .7, .52), (.03, .55, .42), 'asphalt', d=1)
        # interior silhouettes through the glow: shelves, goods, hanging tools
        for z in (1.25, 1.85, 2.45):
            s.box('innerShelf', (3.72, yw, z), (.06, 1.95, .05), 'asphalt', d=1)
        for k in range(6):
            tok = ['redDark', 'asphalt', TAN, 'brick'][(k + (side > 0)) % 4]
            s.box('innerGoods', (3.745, yw - .85 + k * .34, 1.38 if k % 2 else 1.98), (.06, .2, .24), tok, d=0)
        s.box('shopSill', (3.82, yw, .9), (.30, 2.5, .12), TAN, d=1)
    # double door with glazed upper panels and transom
    s.box('doorFrame', (3.58, 0, 1.78), (.2, 2.5, 3.1), WOOD)
    s.box('transomGlass', (3.68, 0, 3.15), (.03, 1.9, .5), 'glow')
    s.box('transomBar', (3.7, 0, 2.92), (.1, 2.1, .1), WOOD)
    for k, y in enumerate((-.5, .5)):
        s.box('doorLeaf', (3.67, y, 1.55), (.1, .98, 2.7), WOOD)
        s.box('doorLowerPanel', (3.735, y, .8), (.03, .7, .8), WOOD, d=1)
        s.box('doorLowerInset', (3.755, y, .8), (.02, .5, .6), 'asphalt', d=1)
        for r in range(2):
            for c in range(2):
                s.box('doorPane', (3.735, y - .2 + c * .4 if k == 0 else y - .2 + c * .4, 1.72 + r * .52), (.03, .32, .42), 'glow', d=1)
        s.box('doorPaneBarV', (3.75, y, 1.98), (.04, .05, 1.0), WOOD, d=1)
        s.box('doorPaneBarH', (3.75, y, 1.98), (.04, .85, .05), WOOD, d=1)
    s.box('doorPull', (3.78, -.12, 1.4), (.06, .05, .5), 'asphalt', d=1)
    s.box('doorPull', (3.78, .12, 1.4), (.06, .05, .5), 'asphalt', d=1)
    s.box('doorStepUpper', (3.95, 0, .3), (.6, 2.9, .2), TAN, d=1)
    s.box('doorStepLower', (4.35, 0, .25), (.4, 2.9, .1), TAN, d=1)
    # sign beam + dark board + lettering
    s.box('signBeam', (3.74, 0, 4.0), (.50, 8.2, .94), WOOD)
    s.box('signBoard', (4.0, 0, 4.0), (.05, 7.4, .72), 'asphalt')
    for y in (-3.7, 3.7):
        s.box('signEnd', (4.02, y, 4.0), (.06, .14, .74), TAN, d=1)
    s.box('signRailTop', (4.02, 0, 4.38), (.06, 7.4, .06), TAN, d=1)
    s.box('signRailBottom', (4.02, 0, 3.63), (.06, 7.4, .06), TAN, d=1)
    s.text('KESSLER HARDWARE', (4.04, 0, 4.0), .52, TAN, d=2)
    # gooseneck lamps above the sign
    for n, y in enumerate((-3.3, 3.3)):
        s.box('lampArmUp', (3.95, y, 4.6), (.06, .06, .3), 'asphalt', d=1)
        s.box('lampArm', (4.13, y, 4.76), (.4, .06, .06), 'asphalt', d=1)
        s.box('lampShade', (4.3, y, 4.7), (.28, .28, .12), 'asphalt', d=1)
        s.box('lampBulb', (4.3, y, 4.62), (.18, .18, .07), 'glow', d=1)
        s.light('signLamp%d' % (n + 1), (4.3, y, 4.6), 'point', 'light_window_warm', 1.6, 5.5, 'kessler-hardware')
    awning(s)
    tool_rack(s)
    paint_shelf(s)
    s.light('shopWindowL', (3.95, -2.3, 1.95), 'window', 'light_window_warm', 2.2, 5, 'kessler-hardware')
    s.light('shopWindowR', (3.95, 2.3, 1.95), 'window', 'light_window_warm', 2.2, 5, 'kessler-hardware')


def plate(s, face, t0, t1, tokens, segs, row, thick, center):
    """Shingle plates on a roof face: face = [P0, P1, P2, P3] (eave left/right, ridge right/left)."""
    P0, P1, P2, P3 = [Vector(p) for p in face]

    def Q(t, u):
        l = P0.lerp(P3, t)
        r = P1.lerp(P2, t)
        return l.lerp(r, u)
    for k in range(segs):
        u0 = (k + (.5 if row % 2 else 0)) / segs + .004
        u1 = (k + 1 + (.5 if row % 2 else 0)) / segs - .004
        if row % 2:
            if k == segs - 1:
                u1 = 1.0
            u0 = max(u0, 0)
        u0, u1 = max(0, u0), min(1, u1)
        if u1 - u0 < .03:
            continue
        quad = [Q(t0, u0), Q(t0, u1), Q(t1, u1), Q(t1, u0)]
        n = (quad[1] - quad[0]).cross(quad[3] - quad[0])
        c = sum(quad, Vector()) / 4
        if n.dot(c - center) < 0:
            quad = [quad[1], quad[0], quad[3], quad[2]]
        s.slab('shingle', [tuple(v) for v in quad], thick, tokens, d=0)


def roof(s):
    e = EAVE_Z
    c = Vector((0, 0, e + 1.0))
    F0, F1, F2, F3 = (A, -B, e), (A, B, e), (0 + .0, RIDGE, RIDGE_Z), (0, -RIDGE, RIDGE_Z)
    # exact hip roof shell: base quad + 2 trapezoids + 2 triangles
    verts = [(A, -B, e), (A, B, e), (-A, B, e), (-A, -B, e), (0, RIDGE, RIDGE_Z), (0, -RIDGE, RIDGE_Z)]
    faces = [(0, 1, 2, 3), (0, 1, 4, 5), (2, 3, 5, 4), (0, 3, 5), (1, 2, 4)]
    s.solid('roofShell', verts, faces, 'asphalt')
    # shingle courses: authored plates on all four faces (LOD0 tabs, LOD1 full-width courses, LOD2 none)
    faces4 = [
        [(A, -B, e), (A, B, e), (0, RIDGE, RIDGE_Z), (0, -RIDGE, RIDGE_Z)],          # front (+X)
        [(-A, B, e), (-A, -B, e), (0, -RIDGE, RIDGE_Z), (0, RIDGE, RIDGE_Z)],        # back (-X)
        [(-A, -B, e), (A, -B, e), (0, -RIDGE, RIDGE_Z), (0, -RIDGE, RIDGE_Z)],       # left (-Y) triangle
        [(A, B, e), (-A, B, e), (0, RIDGE, RIDGE_Z), (0, RIDGE, RIDGE_Z)],           # right (+Y) triangle
    ]
    rows = 11
    for fi, face in enumerate(faces4):
        for r in range(rows):
            t0, t1 = r / rows + .004, (r + 1) / rows - .018
            if fi >= 2 and t1 > .92:
                continue
            width = 8.2 if fi < 2 else 7.5
            segs = max(3, int(round(width * (1 - t0 * (.76 if fi < 2 else 1)) / .62)))
            plate(s, face, t0, t1, 'asphalt', segs, r, .06, c)
    # eave fascia ring (cream), ridge and hip caps
    for name, pos, size in [('fasciaFront', (A + .05, 0, e + .08), (.18, 2 * B + .2, .32)), ('fasciaBack', (-A - .05, 0, e + .08), (.18, 2 * B + .2, .32)),
                            ('fasciaLeft', (0, -B - .05, e + .08), (2 * A + .2, .18, .32)), ('fasciaRight', (0, B + .05, e + .08), (2 * A + .2, .18, .32))]:
        s.box(name, pos, size, TAN)
    s.box('ridgeCap', (0, 0, RIDGE_Z + .06), (.3, 2 * RIDGE + .45, .2), 'asphalt', d=1)
    for (x0, y0, x1, y1) in [(A, -B, 0, -RIDGE), (A, B, 0, RIDGE), (-A, -B, 0, -RIDGE), (-A, B, 0, RIDGE)]:
        s.beam('hipCap', (x0 * .995, y0 * .995, e + .16), (x1, y1, RIDGE_Z + .08), .22, 'asphalt', d=1)
    # chimney, brick courses and cap
    cx, cy = -1.0, -3.1
    s.box('chimney', (cx, cy, 9.0), (1.0, .9, 3.2), 'brick')
    for z in (8.3, 9.0, 9.7):
        s.box('chimneyBand', (cx, cy, z), (1.12, 1.02, .1), 'brick', d=1)
    s.box('chimneyCap', (cx, cy, 10.65), (1.28, 1.18, .16), TAN)
    s.box('chimneyFlue', (cx, cy, 10.76), (.64, .54, .08), 'asphalt', d=1)
    s.box('chimneyStep', (cx, cy, 10.45), (1.14, 1.04, .12), 'brick', d=1)


def blade_sign(s):
    """Projecting hardware sign at the front-left corner, readable from the -Y game-camera side."""
    y = -3.85
    s.box('bladeArm', (4.0, y, 6.5), (1.2, .08, .08), 'asphalt')
    s.box('bladeStay', (3.65, y, 6.2), (.08, .08, .6), 'asphalt', d=1)
    s.beam('bladeStayDiag', (3.55, y, 6.05), (4.1, y, 6.45), .06, 'asphalt', d=1)
    s.box('bladeFrame', (4.1, y, 5.78), (1.0, .12, 1.08), WOOD)
    s.box('bladeBoard', (4.1, y, 5.78), (.9, .16, .96), 'redDark')
    s.box('bladeGlow', (4.1, y, 5.78), (.62, .19, .6), 'glow')
    # tool silhouette: hammer
    s.box('bladeHammerHandle', (4.1, y, 5.72), (.07, .21, .46), 'asphalt', d=1)
    s.box('bladeHammerHead', (4.1, y, 5.98), (.34, .21, .1), 'asphalt', d=1)
    for dx in (-.4, .4):
        s.box('bladeHanger', (4.1 + dx, y, 6.42), (.04, .04, .12), 'asphalt', d=1)


def dormers(s):
    e = EAVE_Z
    # front (+X) dormer
    s.box('dormerFrontBody', (2.5, 0, 8.2), (1.0, 1.5, 1.4), TAN, d=1)
    s.box('dormerFrontFrame', (3.02, 0, 8.2), (.06, 1.0, .92), WOOD, d=1)
    s.box('dormerFrontGlass', (3.06, 0, 8.2), (.03, .78, .7), 'glow', d=1)
    s.box('dormerFrontBar', (3.08, 0, 8.2), (.03, .05, .7), WOOD, d=1)
    s.extrude('dormerFrontRoof', [(-.95, 8.9), (.95, 8.9), (0, 9.52)], 'x', 1.9, 3.2, 'asphalt', d=1)
    # -Y dormer
    s.box('dormerSideBody', (1.6, -2.7, 8.3), (1.5, 1.0, 1.4), TAN, d=1)
    s.box('dormerSideFrame', (1.6, -3.22, 8.3), (1.0, .06, .92), WOOD, d=1)
    s.box('dormerSideGlass', (1.6, -3.26, 8.3), (.78, .03, .7), 'glow', d=1)
    s.box('dormerSideBar', (1.6, -3.28, 8.3), (.05, .03, .7), WOOD, d=1)
    s.extrude('dormerSideRoof', [(.65, 9.0), (2.55, 9.0), (1.6, 9.62)], 'y', -3.4, -2.0, 'asphalt', d=1)


def cellar_door(s):
    """Rear cellar door: hinge joint with real planks, plus stone stoop, lamp and shared socket."""
    y0 = 1.05
    hinge = s.joint('door_cellar', (-3.62, y0, .2))
    hinge['ss_door'] = json.dumps({'axis': 'Z', 'openAngle': 95, 'initialState': 'closed', 'hingeSide': 'minusY', 'note': 'shared cellar-door anchor with int.basement-cellar'})
    s.box('cellarFrame', (-3.55, 1.6, 1.55), (.16, 1.75, 2.7), TAN)
    s.box('cellarFrameHead', (-3.58, 1.6, 2.95), (.26, 2.1, .2), TAN, d=1)
    s.box('cellarDark', (-3.545, 1.6, 1.35), (.05, 1.05, 2.3), 'asphalt')
    # leaf (closed): planks, ledgers, strap hinges and ring, all children of the joint
    for i in range(5):
        s.box('cellarPlank', (-.05, .11 + i * .22, 1.2), (.09, .2, 2.4), WOOD, parent=hinge, bevel=.01)
    for z in (.45, 1.95):
        s.box('cellarLedger', (-.12, .55, z), (.06, 1.0, .18), WOOD, parent=hinge, d=1)
        s.box('cellarStrap', (-.16, .45, z), (.03, .9, .07), WOOD, parent=hinge, d=1)
    s.beam('cellarBrace', (-.12, .12, .5), (-.12, .98, 1.95), .1, WOOD, parent=hinge, d=1)
    s.box('cellarRing', (-.14, .95, 1.1), (.04, .14, .14), WOOD, parent=hinge, d=1)
    # stoop, lamp, rear window
    s.box('cellarStoop', (-3.95, 1.6, .31), (.85, 2.0, .22), TAN)
    s.box('cellarStoopStep', (-4.28, 1.6, .24), (.4, 1.8, .1), TAN, d=1)
    s.box('cellarLamp', (-3.74, 1.6, 3.15), (.16, .32, .22), 'glow')
    s.box('cellarLampBracket', (-3.65, 1.6, 3.1), (.1, .08, .3), 'asphalt', d=1)
    s.light('cellarDoorLamp', (-3.8, 1.6, 3.1), 'point', 'light_window_warm', 1.8, 5, 'kessler-lane')
    sockets.empty('cellarDoorSocket', (-4.1, 1.6, .2), s.root)


def recipe(s):
    s.box('plinth', (.6, 0, .1), (10.0, 9.4, .2), 'sidewalk', bevel=.03)
    s.box('curb', (5.5, 0, .15), (.2, 9.4, .30), 'sidewalk', bevel=.03)
    for r in range(2):
        for c in range(9):
            s.box('paver', (4.9 + r * .0 + (r * .3 - .3), -4.2 + c * 1.05, .2), (.55, .98, .02), 'sidewalk', d=0, bevel=.008)
    s.box('mass', (0, 0, 3.6), (7.0, 8.2, 6.8), 'brick', bevel=0)
    shopfront(s)
    # belt course + cornice
    for name, pos, size in [('beltBack', (-3.55, 0, 3.55), (.12, 8.4, .28)), ('beltLeft', (0, -4.15, 3.55), (7.2, .12, .28)), ('beltRight', (0, 4.15, 3.55), (7.2, .12, .28))]:
        s.box(name, pos, size, TAN)
    for name, pos, size in [('corniceFront', (3.7, 0, 7.12), (.45, 8.8, .32)), ('corniceBack', (-3.7, 0, 7.12), (.45, 8.8, .32)),
                            ('corniceLeft', (0, -4.35, 7.12), (7.5, .45, .32)), ('corniceRight', (0, 4.35, 7.12), (7.5, .45, .32))]:
        s.box(name, pos, size, TAN)
    s.box('corniceFrontUnder', (3.62, 0, 6.9), (.3, 8.5, .14), TAN, d=1)
    for k in range(16):
        s.box('dentil', (3.88, -3.9 + k * .52, 6.88), (.1, .2, .16), TAN, d=0)
    # brick coursing: ledges on every wall at LOD0/1, individual staggered bricks on camera-facing walls at LOD0
    for r in range(25):
        z = .5 + r * .255
        if z < 3.45 and False:
            continue
        s.box('ledgeBack', (-3.515, 0, z), (.035, 8.2, .05), 'brick', d=1)
        s.box('ledgeLeft', (0, -4.115, z), (7.0, .035, .05), 'brick', d=1)
        s.box('ledgeRight', (0, 4.115, z), (7.0, .035, .05), 'brick', d=1)
        if z > 4.62:
            s.box('ledgeFront', (3.515, 0, z), (.035, 8.2, .05), 'brick', d=1)
    for r in range(26):
        z = .62 + r * .255
        for c in range(13):
            x = -3.3 + c * .53 + (.265 if r % 2 else 0)
            if abs(x) > 3.4:
                continue
            s.box('brick', (x, -4.12, z), (.46, .045, .20), 'brick', d=0, bevel=.012)
    for r in range(11):
        z = 4.75 + r * .255 + .13
        for c in range(15):
            y = -3.95 + c * .55 + (.275 if r % 2 else 0)
            if abs(y) > 4.0:
                continue
            if any(abs(y - wy) < .85 and 4.85 < z < 6.8 for wy in (-2.6, 0, 2.6)):
                continue
            s.box('brick', (3.52, y, z), (.045, .48, .20), 'brick', d=0, bevel=.012)
    # upper windows: front x3, left x2, back x2, right x2
    for k, y in enumerate((-2.6, 0, 2.6)):
        window(s, 3.5, 'x', y, 5.75, k != 1, 1)
    for k, x in enumerate((-1.5, 1.5)):
        window(s, -4.1, 'y', x, 5.75, k == 1, -1)
        window(s, 4.1, 'y', x, 5.75, k == 0, 1)
    for k, y in enumerate((-2.0, 2.0)):
        window(s, -3.5, 'x', y, 5.75, k == 0, -1)
    for x in (-1.6, 1.6):
        window(s, -4.1, 'y', x, 2.0, True, -1)
    window(s, -3.5, 'x', -2.4, 1.9, False, -1, .8)
    roof(s)
    dormers(s)
    blade_sign(s)
    cellar_door(s)
    # downspouts
    s.box('downspout', (-3.6, -4.2, 3.6), (.14, .14, 6.8), 'asphalt', d=1)
    s.box('downspoutFront', (3.65, 4.2, 3.3), (.14, .14, 6.2), 'asphalt', d=1)
    colliders.cuboid('walls', (7.2, 8.4, 7.3), (0, 0, 3.85), s.root)
    sockets.empty('shopDoorSocket', (4.9, 0, .2), s.root)
    s.physics('fixed', 0, False)
