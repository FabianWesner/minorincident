"""kit.reception-plaza: orderly evacuation reception. Rows of registration tables,
triage gazebo, two field tents, water station, queue stanchions and a clear
walking aisle (|y| < 1.25) from the +X entrance banner toward the tents.
+X forward, Z up, plate top at z=.08. Authored per tier."""
import math
from .army_small import tent

Z0 = .08


def chair(s, x, y, yaw, token='backpackTeal'):
    L = s.lod
    with s.frame((x, y, Z0), yaw):
        if L == 2:
            s.box('chair', (0, 0, .24), (.42, .42, .48), token, bevel=0)
            return
        s.box('chair seat', (0, 0, .43), (.44, .44, .05), token, bevel=.015)
        s.box('chair back', (-.20, 0, .70), (.04, .44, .46), token, bevel=.015)
        for dx in (-.18, .18):
            for dy in (-.18, .18):
                s.box('chair leg', (dx, dy, .21), (.04, .04, .42), 'uiDark', bevel=0)


def table(s, x, y, yaw, length=1.9, papers=True):
    L = s.lod
    with s.frame((x, y, Z0), yaw):
        s.box('table top', (0, 0, .76), (length, .76, .06), 'woodWarm', bevel=.02)
        if L == 2:
            for sx in (-1, 1):
                s.box('table leg', (sx * (length / 2 - .06), 0, .37), (.08, .70, .74), 'blueTrim', bevel=0)
            return
        for sx in (-1, 1):
            for sy in (-1, 1):
                s.box('table leg', (sx * (length / 2 - .08), sy * .30, .37), (.06, .06, .74), 'blueTrim', bevel=0)
        if L == 0:
            s.box('table rail', (0, 0, .66), (length - .2, .05, .05), 'blueTrim', bevel=0)
        s.box('clipboard', (-.45, .05, .80), (.26, .20, .02), 'picketWhite', rot=(0, 0, .15), bevel=0)
        s.box('clipboard clip', (-.45, .17, .815), (.08, .03, .02), 'uiDark', rot=(0, 0, .15), bevel=0)
        s.box('forms stack', (.05, -.18, .82), (.30, .22, .05), 'picketWhite', bevel=0)
        s.box('forms stack', (.12, -.20, .865), (.26, .18, .04), 'canvasTan', rot=(0, 0, .2), bevel=0)
        s.box('cash box', (.62, .10, .86), (.32, .22, .14), 'packBlue', bevel=.02)
        if L == 0:
            s.box('tablet', (-.05, .12, .795), (.30, .22, .015), 'uiDark', bevel=0)
            s.box('tablet screen', (-.05, .22, .88), (.30, .02, .18), 'tealDark', rot=(-.35, 0, 0), bevel=0)


def crate(s, x, y, yaw, layers=1):
    L = s.lod
    with s.frame((x, y, Z0), yaw):
        for k in range(layers):
            z = .13 + k * .30
            s.box('bottle crate', (0, 0, z), (.62, .42, .26), 'uiDark', bevel=.02)
            if L == 0:
                for i in range(4):
                    for j in range(3):
                        s.cyl('water bottle', (-.21 + i * .14, -.12 + j * .12, z + .22), .045, .20, 'poloLight', seg=6)
                        s.cyl('bottle cap', (-.21 + i * .14, -.12 + j * .12, z + .335), .022, .03, 'picketWhite', seg=5)
            elif L == 1:
                for i in range(2):
                    s.box('water bottles', (-.15 + i * .30, 0, z + .20), (.26, .34, .20), 'poloLight', bevel=0)
            else:
                s.box('water bottles', (0, 0, z + .20), (.52, .34, .18), 'poloLight', bevel=0)


def can(s, x, y, yaw):
    L = s.lod
    with s.frame((x, y, Z0), yaw):
        s.box('water can', (0, 0, .26), (.36, .22, .50), 'packBlue', bevel=.04)
        if L < 2:
            s.cyl('can cap', (.06, 0, .54), .05, .05, 'picketWhite', seg=8)
            s.box('can handle', (-.07, 0, .52), (.14, .06, .05), 'packEdge', bevel=0)


def stanchion(s, x, y):
    L = s.lod
    s.cyl('stanchion base', (x, y, Z0 + .02), .15, .04, 'uiDark', seg=10)
    s.rod('stanchion post', (x, y, Z0), (x, y, Z0 + .92), .035, 'uiDark', seg=6)
    if L == 0:
        s.cyl('stanchion cap', (x, y, Z0 + .94), .055, .06, 'survivorRed', seg=8)


def cone(s, x, y):
    s.frustum('traffic cone', (x, y, Z0), (x, y, Z0 + .52), .17, .04, 'orange', 'body', seg=8)
    if s.lod < 2:
        s.box('cone base', (x, y, Z0 + .02), (.38, .38, .04), 'orange', bevel=0)
        s.cyl('cone band', (x, y, Z0 + .28), .105, .07, 'picketWhite', seg=8, r2=.095)


def recipe(s):
    L = s.lod
    s.owner('body')
    s.ao_floor = .40
    s.box('plaza plate', (0, 0, Z0 / 2), (12.6, 10.6, Z0), 'sidewalk', bevel=.025)

    # ---- walking aisle: yellow edge dashes and chevrons toward the tents (-X)
    if L == 0:
        for sy in (-1, 1):
            for i in range(8):
                s.box('aisle dash', (-3.4 + i * 1.2, sy * 1.25, Z0 + .006), (.8, .07, .012), 'schoolBusYellow', bevel=0)
        for x0 in (4.6, 2.2, -.2):
            for sy in (-1, 1):
                s.box('aisle chevron', (x0 + .24, sy * .24, Z0 + .006), (.8, .10, .012), 'picketWhite',
                      rot=(0, 0, sy * math.pi / 4), bevel=0)
    elif L == 1:
        for sy in (-1, 1):
            for i in range(5):
                s.box('aisle dash', (-3.2 + i * 2.1, sy * 1.25, Z0 + .006), (1.2, .08, .012), 'schoolBusYellow', bevel=0)
    else:
        for sy in (-1, 1):
            s.box('aisle edge', (1.2, sy * 1.25, Z0 + .006), (9.0, .09, .012), 'schoolBusYellow', bevel=0)

    # ---- two field tents at the back, entries toward the aisle
    for y in (-3.3, 3.3):
        with s.frame((-4.1, y, Z0)):
            tent(s, roof='picketWhite', gable='picketWhite', wall='tealLight')

    # ---- registration tables (left of the aisle) with staff chairs
    for x in (-.2, 2.3, 4.8):
        table(s, x, -3.0, 0)
        chair(s, x, -3.85, math.pi / 2)
    # public queue chairs (right of the aisle, facing the aisle)
    rows = (2.1, 2.75) if L < 2 else (2.1,)
    for ry in rows:
        for x in (-1.0, -.3, .4, 1.1, 1.8):
            chair(s, x, ry, -math.pi / 2, 'tealLight')

    # ---- triage gazebo at the front-right corner
    gx, gy = 3.7, 3.5
    for sx in (-1, 1):
        for sy in (-1, 1):
            s.box('gazebo post', (gx + sx * 1.35, gy + sy * 1.35, Z0 + 1.05), (.12, .12, 2.1), 'picketWhite', bevel=.02)
    s.loft('gazebo roof', [[(gx - 1.62, gy - 1.62, Z0 + 2.1), (gx + 1.62, gy - 1.62, Z0 + 2.1),
                            (gx + 1.62, gy + 1.62, Z0 + 2.1), (gx - 1.62, gy + 1.62, Z0 + 2.1)],
                           [(gx - .16, gy - .16, Z0 + 2.95), (gx + .16, gy - .16, Z0 + 2.95),
                            (gx + .16, gy + .16, Z0 + 2.95), (gx - .16, gy + .16, Z0 + 2.95)]], 'picketWhite')
    for sy in (-1, 1):
        s.box('gazebo trim', (gx, gy + sy * 1.62, Z0 + 2.08), (3.30, .10, .16), 'survivorRed', bevel=.02)
        s.box('gazebo trim', (gx + sy * 1.62, gy, Z0 + 2.08), (.10, 3.30, .16), 'survivorRed', bevel=.02)
    # red cross on the +X roof slope (slope normal tilts +X/+Z)
    tilt = -1.069
    base = (gx + .89, gy, Z0 + 2.52)
    nx_, nz_ = .483, .875
    c = (base[0] + nx_ * .03, base[1], base[2] + nz_ * .03)
    s.box('cross bar', c, (.04, .66, .17), 'survivorRed', rot=(0, tilt, 0), bevel=0)
    s.box('cross bar', c, (.04, .17, .66), 'survivorRed', rot=(0, tilt, 0), bevel=0)
    # cot, supply table, medical case
    with s.frame((gx, gy + .35, Z0), math.pi / 2):
        s.box('cot bed', (0, 0, .50), (1.9, .62, .08), 'backpackTeal', bevel=.02)
        if L < 2:
            s.box('cot pillow', (-.75, 0, .58), (.34, .45, .09), 'picketWhite', bevel=.03)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    s.box('cot leg', (sx * .85, sy * .26, .25), (.05, .05, .50), 'uiDark', bevel=0)
    with s.frame((gx - .55, gy - .75, Z0), 0):
        s.box('triage table', (0, 0, .62), (.95, .58, .05), 'woodWarm', bevel=.02)
        if L < 2:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    s.box('triage leg', (sx * .4, sy * .22, .30), (.05, .05, .60), 'blueTrim', bevel=0)
            s.box('medical case', (-.1, 0, .74), (.42, .30, .20), 'survivorRed', bevel=.03)
            s.box('case cross', (-.1, 0, .85), (.20, .06, .015), 'picketWhite', bevel=0)
            s.box('case cross', (-.1, 0, .85), (.06, .20, .015), 'picketWhite', bevel=0)
    chair(s, gx - .55, gy - 1.2, math.pi / 2)

    # ---- water station
    crate(s, -1.5, 4.3, .1, 2)
    crate(s, -.75, 4.3, -.05, 1 if L else 2)
    crate(s, -1.15, 3.6, 1.6, 1)
    for i, (x, y, yaw) in enumerate(((.05, 4.4, .2), (.40, 4.5, -.3), (.15, 3.95, .5), (.55, 4.0, 1.0))):
        can(s, x, y, yaw)

    # ---- entrance banner arch with fictional signage bars, cones, notice boards
    for sy in (-1, 1):
        s.box('arch post', (5.9, sy * 1.7, Z0 + 1.25), (.14, .14, 2.5), 'blueTrim', bevel=.02)
        cone(s, 5.8, sy * 2.2)
    s.box('arch banner', (5.9, 0, Z0 + 2.35), (.10, 3.55, .62), 'packBlue', bevel=.03)
    if L < 2:
        s.box('banner bar', (5.96, 0, Z0 + 2.45), (.03, 2.4, .12), 'picketWhite', bevel=0)
        s.box('banner bar', (5.96, 0, Z0 + 2.26), (.03, 1.5, .08), 'picketWhite', bevel=0)
        s.box('banner stripe', (5.96, 0, Z0 + 2.08), (.03, 3.55, .05), 'survivorRed', bevel=0)
    for y in (-4.5, 4.6):
        s.box('notice post', (5.5, y, Z0 + .9), (.10, .10, 1.8), 'uiDark', bevel=0)
        s.box('notice board', (5.5, y, Z0 + 1.55), (.06, 1.0, .75), 'picketWhite', bevel=.02)
        if L < 2:
            s.box('notice strip', (5.54, y, Z0 + 1.7), (.02, .80, .10), 'packBlue', bevel=0)
            s.box('notice strip', (5.54, y, Z0 + 1.45), (.02, .60, .07), 'survivorRed', bevel=0)

    # ---- queue stanchions with rope runs along both aisle edges
    xs = (-2.5, -.2, 2.1, 4.4) if L else (-2.5, -1.35, -.2, .95, 2.1, 3.25, 4.4)
    if L < 2:
        for sy in (-1, 1):
            for x in xs:
                stanchion(s, x, sy * 1.45)
            for a, b in zip(xs, xs[1:]):
                s.rod('queue rope', (a, sy * 1.45, Z0 + .84), (b, sy * 1.45, Z0 + .84), .018, 'survivorRed', seg=5)

    # ---- physics, colliders (aisle stays clear), sockets
    s.physics('fixed', 0, 'prop.wood-medium', False, (0, 1.0, 0))
    for i, y in enumerate((-3.3, 3.3)):
        s.collider('tent%d' % i, (3.7, 2.9, 2.35), (-4.1, y, Z0 + 1.18))
    for i, x in enumerate((-.2, 2.3, 4.8)):
        s.collider('table%d' % i, (1.9, .76, .8), (x, -3.0, Z0 + .4))
    s.collider('triage', (2.9, 2.9, 2.2), (gx, gy, Z0 + 1.1))
    s.collider('water', (2.4, 1.6, .8), (-.7, 4.1, Z0 + .4))
    s.socket('front', (6.0, 0, 0))
    s.socket('aisleStart', (5.6, 0, Z0))
    s.socket('aisleEnd', (-2.6, 0, Z0))
    s.socket('registration', (2.3, -2.4, Z0))
    s.socket('triageSpot', (gx - .55, gy - .2, Z0))
