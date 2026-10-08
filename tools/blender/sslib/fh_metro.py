"""bld.metro-entrance: green metro canopy over a real stair pit, roll-down shutter `shutter` under the sign.

+X is the street side (sign + shutter + entrance steps); the stairs descend towards -X. Materials (7 + shutter):
foliageDark (green), tealDark (ribs/shadow), khakiLight (plinth), khaki (stairs, block joints), picketWhite (sign,
shutter), uiDark (lettering, pit floor), emissive windowGlow. The shutter joint is a separate single-material draw.
"""
import json
import math
from . import sockets, colliders

GREEN, RIB, STONE, STONE2, WHITE, DARK = 'foliageDark', 'tealDark', 'khakiLight', 'khaki', 'picketWhite', 'uiDark'
TOP = 1.2           # plinth/platform top
PIT = 1.2           # half width of the stair shaft
PX = 2.55           # post x
PY = 1.75           # post y
EAVE = 4.9
RIDGE = 6.3
BOT = .15           # pit floor


def plinth(s):
    # walls around the shaft: left/right/rear, platform in front, two entrance steps, pit floor
    s.box('wallLeft', (0, -1.8, TOP / 2), (6.4, 1.2, TOP), STONE, bevel=.03)
    s.box('wallRight', (0, 1.8, TOP / 2), (6.4, 1.2, TOP), STONE, bevel=.03)
    s.box('wallRear', (-2.7, 0, TOP / 2), (1.0, 2.4, TOP), STONE, bevel=.03)
    s.box('platform', (2.7, 0, TOP / 2), (1.0, 2.4, TOP), STONE, bevel=.03)
    s.box('pitFloor', (-.2, 0, BOT / 2), (4.4, 2.4, BOT), DARK)
    s.box('stepOne', (3.45, 0, .4), (.5, 4.0, .8), STONE, bevel=.03)
    s.box('stepTwo', (3.95, 0, .2), (.5, 4.0, .4), STONE, bevel=.03)
    # stairs descending towards -X: 8 solid treads, each carries the full shaft width
    n = 8
    run, rise = 4.4 / n, (TOP - BOT) / n
    for i in range(n):
        top = TOP - rise * (i + 1)
        x0 = 2.2 - run * (i + 1)
        s.box('stair', (x0 + run / 2, 0, (top + BOT) / 2), (run, 2.4, top - BOT), STONE2, bevel=.02)
        s.box('stairNose', (x0 + run - .03, 0, top - .02), (.08, 2.4, .05), STONE, d=1)
    # coping and block joints on every exposed stone face
    for y in (-2.4, 2.4):
        s.box('copingSide', (0, y - (.13 if y > 0 else -.13), TOP + .03), (6.4, .26, .07), STONE, d=1)
    s.box('copingRear', (-3.07, 0, TOP + .03), (.26, 4.8, .07), STONE, d=1)
    s.box('copingFront', (3.07, 0, TOP + .03), (.26, 4.8, .07), STONE, d=1)
    for y, sgn in ((-2.4, -1), (2.4, 1)):
        for r in range(2):
            for c in range(6):
                s.box('block', (-2.8 + c * 1.12 + (.56 if r else 0), y + sgn * .01, .3 + r * .6), (1.04, .03, .54), STONE2, d=0, bevel=.012)
    for r in range(2):
        for c in range(4):
            s.box('block', (-3.2 - .01, -1.5 + c * 1.0 + (.5 if r else 0) * 0, .3 + r * .6), (.03, .94, .54), STONE2, d=0, bevel=.012)
        for c in range(3):
            s.box('stepBlock', (3.2 + .0, -1.8 + c * 1.2, .3 + r * .6), (.03, 1.1, .54), STONE2, d=0, bevel=.012)
    # shaft walls (inner faces) with block courses visible down the stairs
    for y, sgn in ((-PIT, 1), (PIT, -1)):
        for c in range(7):
            s.box('shaftBlock', (-1.9 + c * .62, y + sgn * .015, .38 + (c % 2) * .3), (.55, .03, .5), STONE2, d=0, bevel=.01)
        s.box('stairLamp', (-.2, y + sgn * .02, .85), (.5, .04, .12), 'glow', d=1)
        s.box('stairLamp', (-1.4, y + sgn * .02, .55), (.5, .04, .12), 'glow', d=1)


def posts(s):
    for x in (-PX, PX):
        for y in (-PY, PY):
            s.box('postBase', (x, y, TOP + .27), (.74, .74, .54), GREEN, bevel=.03)
            s.box('postBaseCap', (x, y, TOP + .58), (.82, .82, .1), RIB, d=1)
            s.box('postShaft', (x, y, (TOP + .6 + EAVE - .1) / 2), (.5, .5, EAVE - .1 - TOP - .6), GREEN, bevel=.025)
            s.box('postCap', (x, y, EAVE - .02), (.66, .66, .3), GREEN, bevel=.03)
            s.box('postFinial', (x, y, EAVE + .24), (.56, .56, .24), GREEN, bevel=.03)
            s.box('postFinialTop', (x, y, EAVE + .4), (.4, .4, .1), RIB, d=1)


def roof(s):
    hx, hy = 3.0, 2.15
    # gable infill + barge boards at front and rear
    for x, sgn in ((2.88, 1), (-2.88, -1)):
        s.extrude('gable', [(-hy, EAVE), (hy, EAVE), (0, RIDGE)], 'x', x - .1, x + .1, RIB)
        for sy in (-1, 1):
            a = (x + sgn * .14, sy * hy, EAVE)
            b = (x + sgn * .14, 0, RIDGE + .02)
            s.beam('bargeBoard', a, b, .14, GREEN, depth=.2, d=1)
    # two slopes (closed slabs), standing seams every 0.74 m
    rise_len = math.hypot(hy, RIDGE - EAVE)
    ang = math.atan2(RIDGE - EAVE, hy)
    for sy in (-1, 1):
        mid_y = sy * hy / 2
        mid_z = (EAVE + RIDGE) / 2 + .02
        tilt = (-sy * ang, 0, 0)
        s.box('roofSlope', (0, mid_y, mid_z), (2 * hx, rise_len + .12, .16), RIB, rot=tilt, bevel=0)
        for i in range(9):
            x = -hx + .38 + i * ((2 * hx - .76) / 8)
            s.box('roofSeam', (x, mid_y, mid_z + .1), (.08, rise_len + .1, .07), GREEN, rot=tilt, bevel=0, d=1)
        s.box('roofEaveBand', (0, sy * (hy + .02), EAVE - .06), (2 * hx + .1, .22, .22), GREEN, d=1)
    s.box('ridgeCap', (0, 0, RIDGE + .1), (2 * hx + .2, .3, .16), GREEN, d=1)
    s.box('roofUnderside', (0, 0, EAVE - .12), (2 * hx - .1, 2 * hy - .1, .06), RIB, d=2)
    for x in (-1.4, 1.4):
        s.box('canopyLamp', (x, -.0, EAVE - .17), (.55, .3, .08), 'glow')
        s.box('canopyLampBase', (x, 0, EAVE - .13), (.65, .4, .05), DARK, d=1)


def rails(s):
    for y in (-PY, PY):
        for z in (TOP + 1.1, TOP + .55):
            s.box('sideRail', (0, y, z), (2 * PX, .12, .12), GREEN, bevel=.02)
        for i in range(16):
            x = -PX + .3 + i * ((2 * PX - .6) / 15)
            s.box('sideBaluster', (x, y, TOP + .55), (.07, .07, 1.05), GREEN, d=1, bevel=0)
    for z in (TOP + 1.1, TOP + .55):
        s.box('rearRail', (-PX, 0, z), (.12, 2 * PY, .12), GREEN, bevel=.02)
    for i in range(10):
        y = -PY + .27 + i * ((2 * PY - .54) / 9)
        s.box('rearBaluster', (-PX, y, TOP + .55), (.07, .07, 1.05), GREEN, d=1, bevel=0)
    # sloped handrails down the stairs inside the shaft
    for y in (-PIT + .1, PIT - .1):
        s.beam('stairHandrail', (2.2, y, TOP + .92), (-1.9, y, BOT + .92), .09, GREEN, d=1)
        s.beam('stairHandrailLow', (2.2, y, TOP + .42), (-1.9, y, BOT + .42), .06, GREEN, d=0)
        for x in (1.8, .4, -1.0):
            z0 = TOP - (2.2 - x) / 4.4 * (TOP - BOT)
            s.box('stairStanchion', (x, y, z0 + .46), (.07, .07, .92), GREEN, d=1)


def sign_and_shutter(s):
    # sign board between the front posts, cream with green border
    s.box('signBoard', (PX + .05, 0, 4.3), (.12, 2 * PY - .5, .86), 'glow')
    for z in (4.3 - .43, 4.3 + .43):
        s.box('signBorderH', (PX + .12, 0, z), (.08, 2 * PY - .5, .09), GREEN, d=1)
    for y in (-(PY - .25), PY - .25):
        s.box('signBorderV', (PX + .12, y, 4.3), (.08, .09, .86), GREEN, d=1)
    s.text('FAIRHAVEN METRO', (PX + .13, 0, 4.3), .27, GREEN, d=2, extrude=.015)
    for y in (-1.15, 1.15):
        for z in (3.98, 4.62):
            s.box('signRivet', (PX + .13, y, z), (.04, .08, .08), RIB, d=0, bevel=.01)
    # roundel on the front gable and warm sign lamps
    s.tube('roundelDisc', (3.0, 0, 5.62), .5, .07, WHITE, rot=(0, math.pi / 2, 0), sides=(24, 16, 10))
    s.tube('roundelCore', (3.04, 0, 5.62), .34, .07, GREEN, rot=(0, math.pi / 2, 0), sides=(24, 16, 10))
    s.box('roundelBar', (3.07, 0, 5.62), (.06, 1.28, .2), WHITE)
    for y in (-1.15, 1.15):
        s.box('signLampArm', (PX + .2, y, 4.86), (.3, .06, .06), DARK, d=1)
        s.box('signLampBulb', (PX + .36, y, 4.8), (.2, .18, .08), 'glow')
    s.light('signLamp', (PX + .36, 0, 4.7), 'point', 'light_window_warm', 1.4, 4.5, 'metro-entrance')
    # roll housing + guides
    s.tube('shutterRoll', (PX - .12, 0, 3.55), .27, 2 * PY - .6, WHITE, rot=(math.pi / 2, 0, 0), sides=(20, 12, 8))
    for y in (-(PY - .3), PY - .3):
        s.tube('rollCap', (PX - .12, y, 3.55), .31, .1, GREEN, rot=(math.pi / 2, 0, 0), d=1)
    for y in (-(PY - .3), PY - .3):
        s.box('shutterGuide', (PX - .12, y, (TOP + 3.4) / 2), (.1, .12, 3.4 - TOP), GREEN, d=1)
    s.box('housingBox', (PX - .12, 0, 3.85), (.5, 2 * PY - .5, .12), GREEN, d=1)
    # shutter: separate joint, slats + bottom bar (single material), default half-open
    shutter = s.joint('shutter', (PX - .12, 0, 1.2))
    shutter['ss_door'] = json.dumps({'kind': 'slide', 'axis': 'Z', 'closedOffset': 0, 'openOffset': 1.9, 'defaultOffset': 1.2, 'initialState': 'open',
                                     'note': 'joint z=0 is fully closed (bottom bar on platform), z=1.9 fully rolled into the housing'})
    width = 2 * PY - .6 - .1
    count = 15
    for i in range(count):
        z = TOP + .22 + i * .145
        s.box('shutterSlat', (0, 0, z), (.05, width, .125), WHITE, parent=shutter, bevel=0)
        if i % 2 == 0:
            s.box('shutterRib', (.035, 0, z), (.02, width - .05, .035), WHITE, parent=shutter, d=0)
    s.box('shutterBar', (0, 0, TOP + .08), (.1, width + .06, .16), WHITE, parent=shutter, bevel=.02)
    s.box('shutterHandle', (.07, 0, TOP + .1), (.05, .4, .06), WHITE, parent=shutter, d=1)


def recipe(s):
    plinth(s)
    posts(s)
    roof(s)
    rails(s)
    sign_and_shutter(s)
    s.light('canopyFront', (1.4, 0, EAVE - .3), 'point', 'light_window_warm', 2.0, 6, 'metro-entrance')
    s.light('stairWell', (-.2, 0, .9), 'point', 'light_window_warm', 1.4, 4.5, 'metro-main')
    sockets.empty('stairTopSocket', (2.0, 0, TOP), s.root)
    sockets.empty('stairBottomSocket', (-1.9, 0, BOT), s.root)
    sockets.empty('entranceSocket', (4.6, 0, 0), s.root)
    sockets.empty('shutterSocket', (PX - .12, 0, TOP), s.root)
    for name, size, pos in [('wallLeft', (6.4, 1.2, TOP), (0, -1.8, TOP / 2)), ('wallRight', (6.4, 1.2, TOP), (0, 1.8, TOP / 2)),
                            ('wallRear', (1.0, 2.4, TOP), (-2.7, 0, TOP / 2)), ('platform', (1.0, 2.4, TOP), (2.7, 0, TOP / 2)),
                            ('stepOne', (.5, 4.0, .8), (3.45, 0, .4)), ('stepTwo', (.5, 4.0, .4), (3.95, 0, .2))]:
        colliders.cuboid(name, size, pos, s.root)
    s.physics('fixed', 0, False)
