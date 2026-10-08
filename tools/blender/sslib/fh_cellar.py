"""int.basement-cellar: low stone cellar (cutaway, open to +X), stair along the -Y wall, shelves on +Y,
heavy barrable door `door_cellar` in the back (-X) wall, one warm bulb. Clear aisle y in [-1.3, 1.6].

Materials: khaki (wall/floor mass), khakiLight (stone blocks, flags, treads), woodWarm, uiDark, sidewalk, emissive
windowGlow in the body (6) plus door planks (woodWarm) and iron bands (uiDark) as the door-joint owner (2) = 8 draws.
"""
import json
import math
import random
from . import sockets, colliders

MASS, STONE, WOOD, IRON, TAN = 'khaki', 'khakiLight', 'woodWarm', 'uiDark', 'sidewalk'
FLOOR = .3          # floor level (slab top)
WALL_TOP = 3.4
BACK_X = -3.3       # inner face of the back wall
STAIR_X0 = 1.5      # bottom step front
STEPS = 15
RUN = (STAIR_X0 - BACK_X) / STEPS
RISE = 2.8 / STEPS
STAIR_Y0, STAIR_Y1 = -2.3, -1.3
DOOR_Y0, DOOR_W = -.4, 1.6


def step_top(i):
    return FLOOR + RISE * (i + 1)


def left_height(x):
    """Top of the stepped -Y wall at x (follows the stair line plus a parapet; stubs at the front)."""
    if x > STAIR_X0:
        return 1.35 if x < 3.0 else .85
    i = min(STEPS - 1, max(0, int((STAIR_X0 - x) / RUN)))
    return min(WALL_TOP, step_top(i) + .85)


def right_height(x):
    if x < -.5:
        return WALL_TOP
    if x < 1.4:
        return 2.7
    if x < 2.9:
        return 1.9
    return 1.1


def blocks_vertical(s, rng, axis, plane, sign, u0, u1, z0, height, row_h=.34, wmin=.5, wmax=.95, skip=None, thick=.06, token=STONE):
    """Rows of beveled stone blocks on a wall face (axis 'y': face plane y=plane spanning x; 'x': plane x=plane spanning y).
    height(u) gives the local wall top so blocks follow the stepped profile."""
    z = z0 + .04
    row = 0
    while z + row_h * .5 < max(height(u0), height(u1), height((u0 + u1) / 2)) + .01:
        u = u0 + (rng.random() * .4 if row % 2 else 0)
        while u < u1 - .08:
            w = min(rng.uniform(wmin, wmax), u1 - u)
            c = u + w / 2
            top = height(c)
            if w > .18 and z + row_h - .02 <= top + .02 and not (skip and skip(c, z + row_h / 2, w)):
                zc = z + row_h / 2 - .01
                size = (w - .05, thick, row_h - .05) if axis == 'y' else (thick, w - .05, row_h - .05)
                pos = (c, plane + sign * thick / 2, zc) if axis == 'y' else (plane + sign * thick / 2, c, zc)
                s.box('block', pos, size, token if rng.random() > .22 else TAN, d=1, bevel=.022)
            u += w
        z += row_h
        row += 1


def recipe(s):
    rng = random.Random(21)
    # ---- base slab and floor
    s.box('slab', (0, 0, .15), (8.8, 6.8, .3), TAN, bevel=.04)
    s.box('floor', (.3, 0, FLOOR + .03), (7.4, 4.6, .06), MASS)
    ys = [-2.2, -1.45, -.7, .05, .8, 1.55, 2.2]
    for r in range(len(ys) - 1):
        yc = (ys[r] + ys[r + 1]) / 2
        h = ys[r + 1] - ys[r] - .05
        x = -3.3 + (rng.random() * .5 if r % 2 else 0)
        while x < 3.95:
            w = min(rng.uniform(.75, 1.4), 4.0 - x)
            if w > .2:
                s.box('flag', (x + w / 2, yc, FLOOR + .07), (w - .05, h, .05), STONE, d=1, bevel=.014)
            x += w
    # ---- walls
    s.box('backWallL', (-3.65, (-3 + (DOOR_Y0 - .25)) / 2, (FLOOR + WALL_TOP) / 2), (.7, (DOOR_Y0 - .25) + 3, WALL_TOP - FLOOR), MASS, bevel=0)
    s.box('backWallR', (-3.65, (DOOR_Y0 + DOOR_W + .25 + 3) / 2, (FLOOR + WALL_TOP) / 2), (.7, 3 - (DOOR_Y0 + DOOR_W + .25), WALL_TOP - FLOOR), MASS, bevel=0)
    s.box('backWallTop', (-3.65, DOOR_Y0 + DOOR_W / 2, (2.65 + WALL_TOP) / 2), (.7, DOOR_W + .5, WALL_TOP - 2.65), MASS, bevel=0)
    s.box('doorBack', (-3.82, DOOR_Y0 + DOOR_W / 2, 1.5), (.14, DOOR_W + .1, 2.4), IRON)
    s.box('doorBackCap', (-3.96, DOOR_Y0 + DOOR_W / 2, 1.5), (.08, DOOR_W + .1, 2.4), MASS, bevel=0)
    # stone door surround (jambs, lintel, threshold)
    for y in (DOOR_Y0 - .16, DOOR_Y0 + DOOR_W + .16):
        s.box('jamb', (-3.36, y, 1.5), (.26, .26, 2.4), STONE, bevel=.025)
    s.box('lintel', (-3.36, DOOR_Y0 + DOOR_W / 2, 2.78), (.28, DOOR_W + .62, .3), STONE, bevel=.03)
    s.box('threshold', (-3.3, DOOR_Y0 + DOOR_W / 2, FLOOR + .05), (.4, DOOR_W + .3, .1), STONE, bevel=.02)
    # right (+Y) wall: stepped profile as columns
    for x0, x1 in [(-4, -.5), (-.5, 1.4), (1.4, 2.9), (2.9, 4.0)]:
        h = right_height((x0 + x1) / 2)
        s.box('wallRight', ((x0 + x1) / 2, 2.65, (FLOOR + h) / 2), (x1 - x0, .7, h - FLOOR), MASS, bevel=0)
    # left (-Y) wall: one column per stair step plus front stubs
    s.box('wallLeftBack', (-3.65, -2.65, (FLOOR + WALL_TOP) / 2), (.7, .7, WALL_TOP - FLOOR), MASS, bevel=0)
    for i in range(STEPS):
        xa = STAIR_X0 - RUN * (i + 1)
        xb = xa + RUN
        h = left_height((xa + xb) / 2)
        s.box('wallLeft', ((xa + xb) / 2, -2.65, (FLOOR + h) / 2), (RUN + .002, .7, h - FLOOR), MASS, bevel=0)
    for x0, x1 in [(1.5, 3.0), (3.0, 4.0)]:
        h = left_height((x0 + x1) / 2)
        s.box('wallLeft', ((x0 + x1) / 2, -2.65, (FLOOR + h) / 2), (x1 - x0, .7, h - FLOOR), MASS, bevel=0)
    # cap stones where the beam lands, and jagged front corner chunks
    for y in (-2.75, 2.75):
        s.box('beamSeat', (-2.2, y, WALL_TOP + .13), (.6, .8, .26), STONE, bevel=.03)
    for x, y, w, d, h in [(3.65, -2.65, .5, .66, 1.55), (3.1, -2.7, .5, .6, 1.2), (3.7, 2.65, .5, .66, 1.35), (3.2, 2.7, .55, .6, 1.0)]:
        s.box('stub', (x, y, FLOOR + h / 2), (w, d, h), STONE, bevel=.05)
    # ---- stone courses (LOD0/1 blocks)
    blocks_vertical(s, rng, 'y', -3.0, -1, -3.2, 4.0, FLOOR, left_height)                           # left wall outer face
    blocks_vertical(s, rng, 'x', BACK_X, 1, -2.3, 2.3, FLOOR, lambda u: WALL_TOP - .02,
                    skip=lambda u, z, w: DOOR_Y0 - .5 < u + w / 2 and u - w / 2 < DOOR_Y0 + DOOR_W + .5 and z < 3.0)   # back wall inner face
    blocks_vertical(s, rng, 'y', 2.3, -1, -3.1, 4.0, FLOOR, right_height)                           # right wall inner face
    blocks_vertical(s, rng, 'x', 4.0, 1, -3.0, -2.3, FLOOR, lambda u: 1.3, thick=.05)               # front stub face
    # ---- stairs along the -Y wall
    for i in range(STEPS):
        x0 = STAIR_X0 - RUN * (i + 1)
        top = step_top(i)
        s.box('stair', (x0 + RUN / 2, (STAIR_Y0 + STAIR_Y1) / 2, (FLOOR + top) / 2), (RUN, STAIR_Y1 - STAIR_Y0, top - FLOOR), MASS, bevel=0)
        s.box('tread', (x0 + RUN / 2 - .01, (STAIR_Y0 + STAIR_Y1) / 2, top + .02), (RUN + .04, STAIR_Y1 - STAIR_Y0 + .06, .06), STONE, bevel=.015, d=1)
    for i in range(0, STEPS, 3):
        x = STAIR_X0 - RUN * (i + .5)
        s.box('newel', (x, STAIR_Y1 + .06, step_top(i) + .46), (.09, .09, .92), WOOD, d=1)
    s.beam('handrail', (STAIR_X0, STAIR_Y1 + .06, FLOOR + RISE + .95), (BACK_X + 1.4, STAIR_Y1 + .06, FLOOR + RISE + .95 + (STAIR_X0 - BACK_X - 1.4) * RISE / RUN), .11, WOOD)
    s.beam('railLow', (STAIR_X0, STAIR_Y1 + .06, FLOOR + RISE + .48), (BACK_X + 1.4, STAIR_Y1 + .06, FLOOR + RISE + .48 + (STAIR_X0 - BACK_X - 1.4) * RISE / RUN), .06, WOOD, d=0)
    s.box('newelBottom', (STAIR_X0 + .1, STAIR_Y1 + .06, FLOOR + .55), (.16, .16, 1.1), WOOD, d=1)
    # ---- ceiling beam, bulb and cord
    s.box('beam', (-2.2, 0, WALL_TOP + .45), (.34, 6.0, .32), WOOD, bevel=.03)
    s.box('beamClamp', (-2.2, .2, WALL_TOP + .22), (.4, .22, .22), IRON, d=1)
    s.box('cord', (-2.2, .2, WALL_TOP - .45), (.03, .03, 1.2), IRON, d=1)
    s.box('socket', (-2.2, .2, 2.62), (.1, .1, .16), IRON, d=1)
    s.ball('bulb', (-2.2, .2, 2.43), .19, 'glow')
    # ---- shelving unit on the +Y wall (steel posts, plank boards, crates and boxes)
    sx0, sx1, sy0, sy1 = -3.0, .2, 1.6, 2.25
    for x in (sx0, (sx0 + sx1) / 2, sx1):
        for y in (sy0, sy1):
            s.box('shelfPost', (x, y, FLOOR + 1.35), (.08, .08, 2.7), IRON, bevel=0)
    zs = [FLOOR + .35, FLOOR + 1.25, FLOOR + 2.15]
    for z in zs:
        s.box('shelfBoard', ((sx0 + sx1) / 2, (sy0 + sy1) / 2, z), (sx1 - sx0 + .12, sy1 - sy0 + .1, .07), WOOD, bevel=.012)
        s.box('shelfBrace', ((sx0 + sx1) / 2, sy0 - .02, z - .1), (sx1 - sx0, .04, .1), IRON, d=1)
    for z in zs:
        x = sx0 + .2
        while x < sx1 - .25:
            kind = rng.choice(['crate', 'crate', 'box', 'jar', 'jar'])
            w = rng.uniform(.4, .65)
            if x + w > sx1 - .1:
                break
            if kind == 'crate':
                s.box('crate', (x + w / 2, 1.95, z + .03 + w * .3), (w, .5, w * .6), WOOD, d=1, bevel=.02)
                s.box('crateSlat', (x + w / 2, 1.69, z + .03 + w * .3), (w - .06, .03, .04), IRON, d=0)
            elif kind == 'box':
                s.box('box', (x + w / 2, 1.95, z + .04 + .17), (w, .46, .34), TAN, d=1, bevel=.02)
            else:
                s.tube('jar', (x + w / 2 - .05, 1.95, z + .04 + .17), .13, .34, TAN, d=1, sides=(12, 8, 6))
                s.tube('jarLid', (x + w / 2 - .05, 1.95, z + .04 + .36), .11, .05, WOOD, d=1, sides=(12, 8, 6))
            x += w + .08
    # ---- floor clutter: barrels (front right), crates and a sack stack, all outside the aisle
    for bx, by in [(2.7, 2.0), (3.4, 1.85), (3.15, 2.5)]:
        s.tube('barrel', (bx, by, FLOOR + .43), .36, .86, WOOD, sides=(16, 12, 8))
        for z in (.16, .43, .7):
            s.tube('hoop', (bx, by, FLOOR + z), .375, .05, IRON, d=1, sides=(16, 12, 8))
        s.tube('barrelTop', (bx, by, FLOOR + .87), .30, .03, TAN, d=1, sides=(16, 12, 8))
    for k, (cx, cy, w) in enumerate([(1.0, 2.45, .62), (1.65, 2.5, .55)]):
        s.box('floorCrate', (cx, cy, FLOOR + w / 2), (w, .6, w), WOOD, bevel=.02, d=1)
        s.box('floorCrateBand', (cx, cy - .31, FLOOR + w / 2), (w - .06, .03, .08), IRON, d=0)
    s.box('floorCrateTop', (1.3, 2.46, FLOOR + .62 + .2), (.5, .5, .4), TAN, bevel=.02, d=1)
    # ---- heavy door (hinge joint), brace brackets, stored bar
    hinge = s.joint('door_cellar', (BACK_X - .06, DOOR_Y0, FLOOR))
    hinge['ss_door'] = json.dumps({'axis': 'Z', 'openAngle': -95, 'initialState': 'closed', 'hingeSide': 'minusY',
                                   'note': 'swings into the room; brace bar goes in braceSocket brackets; shared anchor cellarDoorSocket'})
    planks = 7
    for i in range(planks):
        w = DOOR_W / planks
        s.box('doorPlank', (-.05, w * (i + .5), 1.15), (.12, w - .01, 2.3), WOOD, parent=hinge, bevel=.012)
    for z in (.45, 1.2, 1.95):
        s.box('doorBand', (.065, DOOR_W / 2, z), (.04, DOOR_W - .05, .16), IRON, parent=hinge, bevel=0)
    s.box('doorHinge', (.075, .22, 1.2), (.04, .44, .5), IRON, parent=hinge, d=1)
    s.box('doorRing', (.085, DOOR_W - .22, 1.15), (.04, .22, .22), IRON, parent=hinge, d=1)
    for y in (DOOR_Y0 - .2, DOOR_Y0 + DOOR_W + .2):
        s.box('braceBracket', (-3.2, y, 1.35), (.22, .12, .4), IRON, d=1)
        s.box('braceBracketLip', (-3.1, y, 1.52), (.12, .16, .08), IRON, d=1)
    s.box('braceBar', (-3.0, 2.2, FLOOR + 1.1), (.12, .12, 2.1), WOOD, d=1, rot=(0, .06, 0))
    s.light('bulb', (-2.2, .2, 2.4), 'point', 'light_window_warm', 3.2, 9, 'cellar', ['body_emi_windowGlow'])
    sockets.empty('cellarDoorSocket', (BACK_X + .1, DOOR_Y0 + DOOR_W / 2, FLOOR), s.root)
    sockets.empty('braceSocket', (-3.1, DOOR_Y0 + DOOR_W / 2, 1.35), s.root)
    sockets.empty('stairTopSocket', (BACK_X + .4, -1.8, step_top(STEPS - 1)), s.root)
    sockets.empty('stairBottomSocket', (STAIR_X0 + .4, -1.8, FLOOR), s.root)
    sockets.empty('bulbSocket', (-2.2, .2, 2.43), s.root)
    for name, size, pos in [('floor', (7.4, 6.0, .3), (0, 0, .15)), ('backWall', (.7, 6.0, WALL_TOP), (-3.65, 0, WALL_TOP / 2)),
                            ('rightWall', (7.2, .7, 2.4), (-.3, 2.65, 1.4)), ('leftWall', (7.2, .7, 2.4), (-.3, -2.65, 1.4)),
                            ('shelves', (3.3, .7, 2.7), (-1.4, 1.93, FLOOR + 1.35))]:
        colliders.cuboid(name, size, pos, s.root)
    for i in range(STEPS):
        x0 = STAIR_X0 - RUN * (i + 1)
        top = step_top(i)
        colliders.cuboid('stair%02d' % i, (RUN, STAIR_Y1 - STAIR_Y0, top - FLOOR), (x0 + RUN / 2, (STAIR_Y0 + STAIR_Y1) / 2, (FLOOR + top) / 2), s.root)
    s.physics('fixed', 0, True, 'prop.stone-heavy')
