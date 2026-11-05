"""Burned timber house wall and generic burned brick wall section, explicit 1500/600/200 tiers.

Same approach as burned_facades.py (brick/diner): real prisms with jagged collapsed tops, open
window holes onto a dark interior, charred frames, soot gradients and debris at the base.
Blender axes: +X outward (front), Y along the wall, Z up.
"""
import random
import bpy
import bmesh
from . import sockets, colliders
from .burned_facades import prism, cube, stair


def under(obj, parent):
    obj.parent = parent
    return obj


def beam(s, name, a, b, w, token, parent=None):
    o = s.beam(name, a, b, w, token)
    for m in list(o.modifiers): o.modifiers.remove(m)
    if parent is not None: o.parent = parent
    return o


def lod_pick(L, hi, mid, lo):
    return (hi, mid, lo)[L]


def house(s):
    """Burned clapboard wall: broken gable, collapsed roof edge with rafters, charred window
    frames with real holes, chimney stub, soot and debris. 3.6 wide, 2.9 high, x -.21..+.22."""
    L = s.lod
    rnd = random.Random(23)
    roof = s.joint('roof')
    W0, W1 = -1.8, 1.8
    BACK, FRONT = -.20, 0.0
    # stone foundation course and a ragged sill band
    prism(s, 'foundation', [(W0, 0), (W0, .30), (W1, .30), (W1, 0)], -.21, .04, 'sidewalk')
    prism(s, 'sillBand', [(W0, .30), (W0, .75), (W1, .75), (W1, .30)], BACK, FRONT, 'mustardLight')
    wins = [(-1.30, -.50), (.30, 1.20)]
    zl, zh = .75, 1.85
    piers = [(W0, wins[0][0]), (wins[0][1], wins[1][0]), (wins[1][1], W1)]
    for i, (a, b) in enumerate(piers):
        if L == 2 and i == 1: continue
        prism(s, 'pier', [(a, zl), (a, zh), (b, zh), (b, zl)], BACK, FRONT, 'mustardLight')
    # header band under the collapsed roof, topped by a standing gable remnant on the right
    top = [(-1.8, 2.30), (-1.5, 2.18), (-1.2, 2.34), (-.9, 2.10), (-.55, 2.18), (-.2, 2.0), (.15, 2.12),
           (.45, 2.30), (.7, 2.55), (.95, 2.78), (1.15, 2.90), (1.45, 2.62), (1.8, 2.35)]
    if L == 1: top = [top[0], top[2], top[3], top[5], top[7], top[9], top[10], top[12]]
    if L == 2: top = [top[0], top[3], top[5], top[9], top[10], top[12]]
    pts = [(W0, zh)] + top + [(W1, zh)]
    prism(s, 'header', pts, BACK, FRONT, 'mustardLight')
    # fire-blackened crown: the soot band follows the broken top edge and fades into the clapboard
    if L < 2:
        char = [(y, z) for y, z in top] + [(y, z - (.30 if i % 2 else .18)) for i, (y, z) in reversed(list(enumerate(top)))]
        prism(s, 'charCrown', char, FRONT, FRONT + .012, 'uiDark')
    if L == 0:
        halo = [(y, z - .30 - (.12 if i % 2 else .04)) for i, (y, z) in enumerate(top)] + [(y, z - .18) for y, z in reversed(top)]
        prism(s, 'charHalo', halo, FRONT, FRONT + .008, 'leather')
    # dark interior seen through the window holes, soot-black reveals
    for a, b in wins:
        cube(s, 'interior', (BACK + .015, (a + b) / 2, (zl + zh) / 2), (.03, b - a, zh - zl), 'uiDark')
        if L < 2: cube(s, 'revealTop', (-.10, (a + b) / 2, zh - .06), (.2, b - a, .12), 'uiDark')
    # clapboard courses (LOD0 only): every other board tone-shifted, scorched near the openings
    if L == 0:
        for k in range(9):
            z = .38 + k * .17
            if z < .75:
                cube(s, 'board', (FRONT + .010, 0, z), (.02, W1 - W0, .075), 'woodWarm')
            elif z < zh:
                for a, b in piers:
                    cube(s, 'board', (FRONT + .010, (a + b) / 2, z), (.02, b - a, .075), 'woodWarm')
        for k in range(3):
            z = 1.95 + k * .17
            cube(s, 'board', (FRONT + .010, -.55 + (k % 2) * .1, z), (.02, 2.4 - k * .3, .07), 'woodWarm')
    # charred window frames: posts, lintel, projecting sill, broken sash and mullion
    for n, (a, b) in enumerate(wins):
        c = (a + b) / 2
        cube(s, 'lintel', (.05, c, zh + .05), (.10, b - a + .16, .10), 'uiDark')
        if L == 2: continue
        cube(s, 'jambL', (.045, a + .04, (zl + zh) / 2), (.09, .08, zh - zl), 'uiDark' if n else 'leather')
        if n == 0:
            cube(s, 'jambR', (.045, b - .04, 1.08), (.09, .08, .62), 'woodWarm')
            if L < 2: cube(s, 'jambRBroken', (.05, b - .10, 1.62), (.08, .07, .34), 'leather', rot=(.5, 0, 0))
        else:
            cube(s, 'jambR', (.045, b - .04, (zl + zh) / 2), (.09, .08, zh - zl), 'leather')
        cube(s, 'sill', (.07, c, zl - .03), (.14, b - a + .16, .07), 'leather' if n == 0 else 'woodWarm')
        if L < 2:
            cube(s, 'sashBar', (.03, c - (.1 if n else -.1), 1.30), (.05, (b - a) * .55, .05), 'woodWarm')
    if L < 2:
        cube(s, 'mullion', (.03, 0.75, 1.62), (.05, .06, .78), 'leather')
        cube(s, 'sashBar', (.03, -.9, 1.50), (.05, .06, .60), 'woodWarm')
    # soot gradient: dark tongue over each window, brown halo behind
    def tongue(name, y, w, h, token, inset=0.0):
        prism(s, name, [(y - w, zh + .05), (y - w * .6, zh + h * .6), (y - w * .1, zh + h), (y + w * .4, zh + h * .55), (y + w, zh + .05)],
              FRONT, FRONT + .016 + inset, token)
    for y, w, h in [(-.9, .45, .36), (.75, .5, .44)][:2 if L < 2 else 1]:
        tongue('sootTongue', y, w, h, 'uiDark')
        if L == 0: tongue('sootHalo', y + .03, w * 1.35, h * 1.15, 'leather', inset=-.006)
    if L == 0:
        for y in (-1.3, -.5, .3, 1.2):
            prism(s, 'sootEdge', [(y - .06, zl), (y - .08, zh), (y + .08, zh), (y + .06, zl + .2)], FRONT, FRONT + .014, 'leather')
        cube(s, 'sillSoot', (FRONT + .007, -.9, zl - .2), (.014, 1.0, .20), 'leather')
        cube(s, 'sillSoot', (FRONT + .007, .75, zl - .2), (.014, 1.1, .20), 'leather')
    # chimney stub with a broken top, scorched cap
    ch = [(-1.72, 1.80), (-1.72, 2.62), (-1.58, 2.74), (-1.47, 2.60), (-1.30, 2.84), (-1.30, 1.80)]
    if L == 2: ch = [ch[0], ch[1], ch[4], ch[5]]
    prism(s, 'chimney', ch, -.21, .12, 'brick')
    if L < 2: cube(s, 'chimneyChar', (.0, -1.5, 2.66), (.3, .34, .10), 'uiDark')
    if L == 0:
        for z in (2.05, 2.30, 2.55):
            cube(s, 'chimneyCourse', (.125, -1.51, z), (.012, .42, .02), 'leather')
        cube(s, 'chimneyBlock', (.06, -1.51, 2.30), (.1, .14, .10), 'sidewalk')
    # collapsed roof edge on the left: shingle slab sliding off, loose tiles, charred rafters
    e1 = cube(s, 'shingleSlab', (.0, -1.30, 2.42), (.40, .96, .07), 'asphalt', rot=(.34, 0, 0)); under(e1, roof)
    if L < 2:
        e2 = cube(s, 'shingleLoose', (.04, -.55, 2.14), (.30, .5, .05), 'asphalt', rot=(-.5, .1, 0)); under(e2, roof)
    if L == 0:
        for y, z, r in ((-1.55, 2.25, .5), (-1.0, 2.55, .3), (-.3, 2.12, -.2)):
            under(cube(s, 'shingleTile', (.07, y, z), (.2, .28, .04), 'asphalt', rot=(r, 0, .2)), roof)
    # rafters and rake board: charred timbers poking through the missing roof
    beam(s, 'rafter', (-.05, -1.70, 2.22), (.00, -.35, 2.86), .09, 'leather', roof)
    beam(s, 'rafter', (-.10, -1.15, 2.12), (-.04, .25, 2.78), .08, 'leather', roof)
    if L < 2:
        beam(s, 'rafterBroken', (.08, .95, 2.80), (.10, .25, 2.34), .07, 'leather', roof)
        beam(s, 'rake', (.05, 1.15, 2.88), (.03, 1.76, 2.42), .08, 'leather', roof)
    if L == 0:
        beam(s, 'rafter', (-.14, -.80, 2.20), (-.10, .55, 2.84), .06, 'leather', roof)
        beam(s, 'rafterSplinter', (.06, -.20, 2.62), (.06, .20, 2.82), .05, 'leather', roof)
        cube(s, 'stud', (.0, .50, 2.20), (.07, .07, .40), 'woodWarm')
        cube(s, 'stud', (.0, .85, 2.32), (.07, .07, .52), 'leather')
    # debris at the base: fallen boards, brick lumps, a stair of charred planks
    deb = [((.11, -.2, .33), (.07, 1.0, .05), 'leather', (0, 0, .1)),
           ((.05, .95, .33), (.06, .8, .05), 'woodWarm', (0, 0, -.12)),
           ((.07, -1.40, .32), (.16, .4, .18), 'brick', (0, 0, .3)),
           ((.08, 1.50, .32), (.18, .4, .16), 'brick', (0, 0, -.2)),
           ((.10, .35, .36), (.16, .7, .07), 'uiDark', (0, .15, .1)),
           ((.04, -.9, .36), (.07, .7, .06), 'leather', (.1, 0, -.2)),
           ((.10, .1, .34), (.10, .3, .07), 'sidewalk', (0, 0, .6)),
           ((.12, 1.2, .38), (.1, .4, .09), 'woodWarm', (0, .2, .3))]
    for p, sz, tok, rot in deb[:lod_pick(L, 8, 4, 0)]:
        cube(s, 'debris', p, sz, tok, rot=rot)
    # unrolled loose boards leaning on the foundation, sootier toward the right
    if L == 0:
        for k, y in enumerate((-.35, 0.0, .35)):
            cube(s, 'step', (.12, y + 0.1, .33 + k * .015), (.12, .32, .04), 'leather' if k % 2 else 'woodWarm')
    s.physics(wood=True)
    sockets.empty('mountSocket', (-.10, 0, 0), s.root)
    sockets.empty('windowSocket', (.03, -.9, 1.30), s.root)
    return s


def generic(s):
    """Generic broken charred brick wall section: tall left pier, window hole under a collapsed
    lintel, a deep breach on the right, charcoal awning remnants, rubble on the threshold.
    4.8 wide, 3.8 high, 1.6 deep (threshold), wall .40 thick."""
    L = s.lod
    rnd = random.Random(5)
    BACK, FRONT = -.20, .20
    Y0, Y1 = -2.4, 2.4
    s.box('threshold', (.16, 0, .10), (1.60, 4.8, .20), 'sidewalk')
    zl, zh = .90, 2.55          # window sill / lintel underside
    wa, wb = -1.45, .55         # window opening
    prism(s, 'base', [(Y0, .2), (Y0, zl), (Y1, zl), (Y1, .2)], BACK, FRONT, 'brick')
    left = [3.8, (3.8, 3.35)] if L < 2 else [3.8]
    prism(s, 'pierL', stair(Y0, wa, left, zl), BACK, FRONT, 'brick')
    lint = [(3.05, 3.25), 3.1, (3.3, 2.95)] if L == 0 else [(3.1, 3.2), 3.0] if L == 1 else [3.1]
    prism(s, 'lintelWall', stair(wa, wb, lint, zh), BACK, FRONT, 'brick')
    right = [3.35, (3.45, 2.6), 2.3, (2.5, 3.05)] if L == 0 else [3.35, 2.4, (2.5, 3.05)] if L == 1 else [3.2, 2.5]
    prism(s, 'pierR', stair(wb, Y1, right, zl), BACK, FRONT, 'brick')
    # window hole: dark interior, soot reveal
    cube(s, 'interior', (BACK + .015, (wa + wb) / 2, (zl + zh) / 2), (.03, wb - wa, zh - zl), 'uiDark')
    if L < 2: cube(s, 'revealSoot', (-.0, (wa + wb) / 2, zh - .07), (.4, wb - wa, .14), 'uiDark')
    # charred frame: posts, thick lintel beam, broken sill, burnt mullion stub
    cube(s, 'charredLintel', (FRONT + .05, (wa + wb) / 2, zh + .10), (.14, wb - wa + .2, .20), 'uiDark')
    cube(s, 'jambL', (FRONT + .02, wa + .05, (zl + zh) / 2), (.10, .10, zh - zl), 'leather')
    cube(s, 'jambR', (FRONT + .02, wb - .05, (zl + zh) / 2 - .25), (.10, .10, zh - zl - .5), 'uiDark')
    cube(s, 'charredSill', (FRONT + .06, -.95, zl - .06), (.14, 1.1, .12), 'uiDark')
    if L < 2:
        cube(s, 'mullion', (FRONT - .04, -.45, 1.55), (.08, .08, 1.2), 'leather')
        cube(s, 'mullionStub', (FRONT - .04, -.43, 2.30), (.08, .08, .26), 'leather', rot=(0, .5, .35))
        cube(s, 'lintelHang', (FRONT + .08, -1.1, zh - .12), (.10, .7, .10), 'leather', rot=(.35, 0, 0))
    # soot tongues up the wall, darkest at the openings
    def tongue(name, y, z0, w, h, token, inset=0.0):
        prism(s, name, [(y - w, z0), (y - w * .55, z0 + h * .55), (y - w * .1, z0 + h), (y + w * .35, z0 + h * .62), (y + w, z0)],
              FRONT, FRONT + .018 + inset, token)
    for y, z0, w, h in [(-1.0, zh + .2, .34, .5), (-.1, zh + .2, .26, .4), (1.6, 2.6, .4, .55), (-1.85, 1.6, .22, 1.2)][:4 if L < 2 else 1]:
        tongue('sootTongue', y, z0, w, h, 'uiDark')
        if L == 0: tongue('sootHalo', y + .03, z0 - .03, w * 1.45, h * 1.2, 'leather', inset=-.006)
    if L == 0:
        for yy in (wa, wb):
            prism(s, 'sootEdge', [(yy - .09, zl), (yy - .11, zh), (yy + .11, zh), (yy + .09, zl + .2)], FRONT, FRONT + .016, 'leather')
        cube(s, 'sillSoot', (FRONT + .006, -.45, zl - .15), (.02, 2.2, .28), 'leather')
        cube(s, 'sootBand', (FRONT + .007, 1.5, zl + 0.5), (.02, 1.6, .9), 'leather')
    # burnt awning remnants: charcoal slats, some gone, one hanging
    n = 7 if L == 0 else 4 if L == 1 else 2
    span = 3.9
    cols = ['uiDark', 'leather', 'uiDark', 'woodWarm', 'leather', 'uiDark', 'leather']
    for i in range(n):
        if L < 2 and i in ({2, 5} if L == 0 else {2}): continue
        yc = -1.1 + (i + .5) * span / n * .8
        hang = i == n - 2
        cube(s, 'slat', (.46, yc, 2.95 - (.15 if hang else 0)), (.62, span / n * .78, .06), cols[i % len(cols)], rot=(0, .47 + (.3 if hang else 0), 0))
    if L == 0:
        cube(s, 'awningBeam', (.17, -.5, 3.02), (.1, 3.3, .12), 'leather')
    # brick face detail (LOD0): mortar courses and tone patches
    if L == 0:
        for i in range(1, 9):
            z = zl + .27 * i
            for a, b, t in ((Y0, wa, 3.7), (wa, wb, 3.0), (wb, Y1, 3.2)):
                if zh < z < t or (a == Y0 and z < t) or (a == wb and z < 2.3):
                    cube(s, 'course', (FRONT + .006, (a + b) / 2, z), (.012, (b - a) * .96, .02), 'redDark')
        for z in (.35, .55, .75):
            cube(s, 'course', (FRONT + .006, 0, z), (.012, 4.7, .02), 'redDark')
        for i in range(10):
            y = rnd.choice([-2.2, -1.9, -1.7, 1.0, 1.4, 1.9, 2.2, -.2, .9, 2.0])
            z = rnd.uniform(.35, 3.4) if y < -1.6 else rnd.uniform(1.0, 2.2) if y > .6 else rnd.uniform(.3, .8)
            cube(s, 'brickTone', (FRONT + .01, y, z), (.02, rnd.uniform(.18, .32), rnd.uniform(.1, .17)), rnd.choice(['redDark', 'brick', 'leather']))
        cube(s, 'coping', (FRONT - .15, -2.1, 3.80 - .06), (.5, .4, .12), 'sidewalk')
        cube(s, 'coping', (FRONT - .20, 2.1, 3.05), (.4, .36, .12), 'sidewalk', rot=(0, 0, .2))
    elif L == 1:
        cube(s, 'coping', (FRONT - .15, -2.1, 3.80 - .06), (.5, .4, .12), 'sidewalk')
    # rubble, loose bricks and fallen timbers on the threshold (front), some behind the wall
    rub = [(.45, 1.35, .30, .16, 'brick'), (.58, 1.75, .34, .20, 'redDark'), (.35, 0.9, .26, .14, 'sidewalk'),
           (.68, 1.1, .22, .14, 'brick'), (.55, -1.9, .26, .15, 'redDark'), (.40, -1.95, .30, .18, 'brick'),
           (.72, 1.6, .20, .12, 'leather'), (-.35, 1.4, .30, .18, 'brick'), (-.35, -1.0, .26, .14, 'redDark'), (.55, 1.95, .28, .14, 'sidewalk')]
    for i, (x, y, w, h, tok) in enumerate(rub[:lod_pick(L, 10, 6, 2)]):
        cube(s, 'rubble', (x, y, .2 + h / 2), (w, w * .85, h), tok, rot=(rnd.uniform(-.2, .2), rnd.uniform(-.2, .2), rnd.uniform(0, 1.5)))
    if L < 2:
        cube(s, 'fallenBeam', (.58, -.1, .27), (.10, 1.6, .10), 'leather', rot=(0, 0, .3))
    if L == 0:
        cube(s, 'fallenBeam', (.65, 1.3, .26), (.09, 1.0, .09), 'uiDark', rot=(0, .12, -.3))
        cube(s, 'fallenBeam', (-.45, .1, .27), (.10, .9, .10), 'leather', rot=(0, 0, -.2))
    s.physics()
    sockets.empty('attachSocket', (-.21, 0, 0), s.root)
    colliders.cuboid('wall', (.44, 4.8, 3.8), (0, 0, 1.9), s.root)
    return s
