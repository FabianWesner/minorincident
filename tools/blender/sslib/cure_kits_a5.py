"""L10 'The Cure' military-zone and research-campus kit modules (epic 32, row L10-A5).

Only what the existing stock lacks (army checkpoint, T-walls, sandbag pallets, guard tower, jersey barriers, evac tent,
light towers and military trucks are reused): a sandbagged guard post, a vehicle shelter and a perimeter fence for R4;
two low laboratory buildings, an isolation tent, an emergency generator and a quarantine fence panel for R5.
Same recipe machinery as `cure_kits` (closed solids at every tier, <= 4 palette tokens per module, forward +X).
"""
import math
from . import colliders
from . import cure_kits

ASSETS = (
    'bld.cure-guard-post', 'bld.cure-motor-shelter', 'prop.cure-mil-fence',
    'bld.cure-lab-main', 'bld.cure-lab-annex', 'prop.cure-iso-tent', 'prop.cure-generator', 'prop.cure-quarantine-fence',
)
X, Y = (0, math.pi / 2, 0), (math.pi / 2, 0, 0)  # tube rotations: axis along world x / world y


def sandbag_run(s, cx, cy, length, along, rows, thickness=.55, z0=.0):
    """A stacked sandbag wall of `length` metres along 'x' or 'y'. LOD0 = individual bags in staggered rows,
    LOD1 = one slab per row, LOD2 = one block."""
    h = .22
    def put(u, z, lu, name):
        pos = (cx + u, cy, z) if along == 'x' else (cx, cy + u, z)
        size = (lu, thickness, h) if along == 'x' else (thickness, lu, h)
        return s.plain(name, pos, size, 'khaki', bevel=False)
    if s.lod == 2:
        pos = (cx, cy, z0 + rows * h / 2)
        size = (length, thickness, rows * h) if along == 'x' else (thickness, length, rows * h)
        s.plain('sandbags', pos, size, 'khaki', bevel=False)
        return
    for r in range(rows):
        z = z0 + h / 2 + r * (h + .005)
        if s.lod == 1:
            put(0, z, length - (.3 if r % 2 else 0), 'sandRow')
            continue
        n = max(2, round(length / .66))
        bag = (length - .03 * (n - 1) - (.3 if r % 2 else 0)) / n
        start = -length / 2 + (.15 if r % 2 else 0)
        for i in range(n):
            put(start + bag / 2 + i * (bag + .03), z, bag, 'bag')


# ---------------------------------------------------------------- military zone

def guard_post(s):
    L = s.lod
    s.plain('slab', (0, 0, .1), (9.0, 9.0, .2), 'sidewalk')
    s.plain('block', (-1.6, 0, 1.7), (5.2, 5.2, 3.2), 'olive')
    s.plain('roofSlab', (-1.6, 0, 3.28), (5.6, 5.6, .16), 'uiDark')
    for x in (-1, 1):
        s.plain('parapetX', (-1.6 + x * 2.7, 0, 3.58), (.3, 5.8, .5), 'olive')
    for y in (-1, 1):
        s.plain('parapetY', (-1.6, y * 2.7, 3.58), (5.1, .3, .5), 'olive')
    # steel door and gun slits (+X face of the block is at x = 1.0)
    s.on_wall((1, 0), 1.0, .02, 0, 1.3, .12, 1.1, 2.1, 'uiDark', 'door')
    s.on_wall((1, 0), 1.0, .06, -1.6, 2.2, .08, .9, .26, 'uiDark', 'slit')
    s.on_wall((1, 0), 1.0, .06, 1.6, 2.2, .08, .9, .26, 'uiDark', 'slit')
    for ny in (-1, 1):
        s.on_wall((0, ny), 2.6, .02, -1.6, 2.2, .08, 1.4, .26, 'uiDark', 'slit')
    s.on_wall((-1, 0), 4.2, .02, 0, 2.2, .08, 1.2, .26, 'uiDark', 'slit')
    if L < 2:
        s.on_wall((1, 0), 1.0, .05, 0, 2.45, .1, 1.5, .12, 'khaki', 'doorHead')
        s.plain('step', (1.45, 0, .3), (.9, 1.8, .24), 'khaki')
    # sandbag enclosure in front: two front runs with a gap for the door lane, two returns
    rows = 4
    sandbag_run(s, 3.9, -2.9, 3.4, 'y', rows, z0=.18)
    sandbag_run(s, 3.9, 2.9, 3.4, 'y', rows, z0=.18)
    for y in (-4.4, 4.4):
        sandbag_run(s, 2.3, y, 2.6, 'x', rows, z0=.18)
    # camouflage net over the roof on four poles, radio mast, floodlight
    for x in (-3.8, .6):
        for y in (-2.4, 2.4):
            s.plain('netPole', (x, y, 4.5), (.1, .1, 2.4), 'uiDark')
    s.plain('net', (-1.6, 0, 5.8), (5.2, 5.8, .1), 'olive')
    s.tube('mast', (-3.6, 2.3, 5.2), .05, 4.0, 'uiDark')  # tallest point, kept at every tier
    if L < 2:
        s.plain('netEdge', (-1.6, 0, 5.76), (5.4, 6.0, .05), 'uiDark')
        s.plain('mastArm', (-3.6, 2.3, 6.9), (.1, 1.2, .08), 'uiDark')
        s.plain('floodlight', (1.05, 2.3, 3.0), (.36, .5, .3), 'khaki')
    if L == 0:
        s.plain('crate', (-1.2, -3.9, .53), (1.0, .7, .7), 'khaki')
    colliders.cuboid('block', (5.4, 5.4, 3.3), (-1.6, 0, 1.65), s.root)
    for y in (-2.9, 2.9):
        colliders.cuboid(f'sand{y}', (.7, 3.4, 1.1), (3.9, y, .75), s.root)


def motor_shelter(s):
    L = s.lod
    s.plain('pad', (0, 0, .08), (8.6, 11.6, .16), 'khaki')
    s.plain('roof', (0, 0, 4.4), (8.6, 11.8, .2), 'olive')
    s.plain('fascia', (4.36, 0, 4.3), (.16, 11.9, .5), 'schoolBusYellow')
    for x in (-3.7, 3.7):
        for y in (-5.4, -1.8, 1.8, 5.4):
            s.plain('post', (x, y, 2.25), (.3, .3, 4.2), 'uiDark')
    s.plain('backWall', (-4.0, 0, 1.9), (.3, 11.0, 3.4), 'olive')
    if L < 2:
        for y in (-5.4, -2.7, 0, 2.7, 5.4):
            s.plain('beam', (0, y, 4.1), (8.0, .22, .3), 'uiDark')
        for y in (-2.75, 2.75):
            s.plain('wheelStop', (-2.7, y, .3), (.3, 2.6, .28), 'schoolBusYellow')
    if L == 0:
        for y in (-1.2, 1.2):
            s.plain('lamp', (0, y, 3.93), (2.2, .16, .08), 'khaki')
        s.plain('locker', (-3.7, -4.6, 1.15), (.7, 1.4, 1.9), 'uiDark')
        for y in (3.6, 4.5):
            s.tube('drum', (-3.3, y, .55), .27, .78, 'schoolBusYellow')
    colliders.cuboid('wall', (.4, 11.2, 3.5), (-4.0, 0, 1.75), s.root)
    for x in (-3.7, 3.7):
        for y in (-5.4, -1.8, 1.8, 5.4):
            colliders.cuboid(f'post{x}{y}', (.4, .4, 4.3), (x, y, 2.15), s.root)


def mil_fence(s):
    L = s.lod
    # chain-link panel, 3.0 m long, runs along x; razor coil on top
    for x in (-1.5, 1.5):
        s.plain('post', (x, 0, 1.0), (.12, .12, 2.0), 'olive')
        s.plain('postBase', (x, 0, .12), (.34, .34, .24), 'khaki')
    s.plain('mesh', (0, 0, 1.0), (2.9, .03, 1.7), 'uiDark')
    s.plain('topRail', (0, 0, 1.97), (3.0, .07, .07), 'olive')
    if L < 2:
        s.plain('lowRail', (0, 0, .2), (2.9, .06, .06), 'olive')
        s.plain('midRail', (0, 0, 1.0), (2.9, .07, .05), 'olive')
    s.tube('coil', (0, 0, 2.28), .2, 2.9, 'khaki', X)
    if L == 0:
        for i in range(6):
            s.tube('wireRing', (-1.25 + i * .5, 0, 2.28), .21, .04, 'uiDark', X)
    colliders.cuboid('body', (3.2, .35, 2.5), (0, 0, 1.25), s.root)
    s.physics()


# ---------------------------------------------------------------- research campus

def lab_main(s):
    L = s.lod
    s.plain('plinth', (0, 0, .15), (20.6, 14.6, .3), 'sidewalk')
    s.plain('walls', (0, 0, 2.5), (20, 14, 4.6), 'picketWhite')
    s.plain('roofSlab', (0, 0, 4.82), (20.6, 14.6, .24), 'sidewalk')
    for x in (-1, 1):
        s.plain('parapetX', (x * 10.2, 0, 5.18), (.3, 14.7, .55), 'picketWhite')
    for y in (-1, 1):
        s.plain('parapetY', (0, y * 7.2, 5.18), (20.1, .3, .55), 'picketWhite')
    # entry vestibule: glazed, flat roof, canopy on two posts
    s.plain('entry', (11.6, 0, 2.29), (4.2, 6.2, 4.18), 'picketWhite')
    s.plain('entryRoof', (11.7, 0, 4.42), (4.6, 6.6, .2), 'sidewalk')
    s.on_wall((1, 0), 13.7, .02, 0, 1.9, .08, 4.6, 2.9, 'backpackTeal', 'entryGlass')
    s.on_wall((1, 0), 13.7, .05, 0, 1.9, .08, .14, 2.9, 'uiDark', 'entryMullion')
    if L < 2:
        for u in (-2.6, 2.6):
            s.on_wall((1, 0), 13.7, .045, u, 1.9, .1, .16, 3.0, 'picketWhite', 'entryJamb')
        s.on_wall((1, 0), 13.7, .065, 0, 3.5, .14, 5.4, .2, 'picketWhite', 'entryHead')
        for y in (-3.2, 3.2):
            s.plain('canopyPost', (15.2, y, 1.9), (.16, .16, 3.8), 'uiDark')
    s.plain('canopy', (14.9, 0, 3.8), (2.6, 7.2, .18), 'sidewalk')
    s.plain('step', (14.0, 0, .15), (1.4, 5.2, .3), 'sidewalk')
    # ribbon windows on the front wings and long sides
    for y in (-5.0, 5.0):
        s.window((1, 0), 10.0, y, 2.6, 2.4, 1.7, 'backpackTeal', 'picketWhite')
    for ny in (-1, 1):
        count = 5 if L < 2 else 3
        for i in range(count):
            x = -8.0 + i * (16.0 / (count - 1))
            s.window((0, ny), 7.0, x, 2.6, 2.4, 1.7, 'backpackTeal', 'picketWhite')
    s.door((0, -1), 7.0, 9.0, .3, 1.4, 2.4, 'uiDark', 'picketWhite')
    s.door((-1, 0), 10.0, 4.0, .3, 1.6, 2.4, 'uiDark', 'picketWhite')
    # roof plant: condensers, exhaust stacks, a satellite dish
    for y in (-3.5, 3.5):
        s.plain('hvac', (-4.5, y, 5.5), (2.8, 2.2, 1.2), 'picketWhite')
        s.tube('hvacFan', (-4.5, y, 6.15), .8, .1, 'uiDark')
    s.tube('dishMast', (7.6, 1.5, 5.9), .1, 2.0, 'uiDark')  # tallest point, kept at every tier
    if L < 2:
        s.plain('hvac', (2.5, -3.0, 5.4), (2.2, 2.0, 1.0), 'picketWhite')
        s.tube('hvacFan', (2.5, -3.0, 5.95), .65, .1, 'uiDark')
        for y in (-5.2, 5.2):
            s.tube('stack', (5.5, y, 5.9), .3, 2.0, 'uiDark')
            s.tube('stackCap', (5.5, y, 6.9), .42, .16, 'sidewalk')
        s.tube('dish', (7.6, 1.5, 6.8), .8, .1, 'picketWhite', (0, math.radians(55), 0))
    colliders.cuboid('body', (20.6, 14.6, 5.5), (0, 0, 2.75), s.root)
    colliders.cuboid('entry', (4.6, 6.4, 4.5), (11.7, 0, 2.25), s.root)


def lab_annex(s):
    L = s.lod
    s.plain('plinth', (0, 0, .15), (10.6, 9.6, .3), 'sidewalk')
    s.plain('walls', (0, 0, 2.38), (10, 9, 4.36), 'picketWhite')
    s.plain('roofSlab', (0, 0, 4.6), (10.5, 9.5, .22), 'sidewalk')
    for x in (-1, 1):
        s.plain('parapetX', (x * 5.15, 0, 4.98), (.3, 9.6, .54), 'picketWhite')
    for y in (-1, 1):
        s.plain('parapetY', (0, y * 4.65, 4.98), (9.9, .3, .54), 'picketWhite')
    # airlock vestibule on the +X face with hazard-striped double door and a biohazard disc
    s.plain('airlock', (6.0, 0, 1.78), (2.4, 3.6, 3.56), 'picketWhite')
    s.plain('airlockRoof', (6.1, 0, 3.6), (2.8, 4.0, .2), 'schoolBusYellow')
    for u in (-.55, .55):
        s.on_wall((1, 0), 7.2, .02, u, 1.4, .08, 1.0, 2.4, 'uiDark', 'airlockLeaf')
    if L < 2:
        for k in range(6):
            s.on_wall((1, 0), 7.2, .05, -1.25 + k * .5, 2.82, .08, .25, .3, 'schoolBusYellow' if k % 2 == 0 else 'uiDark', 'chevron')
        for u in (-1.28, 1.28):
            s.on_wall((1, 0), 7.2, .045, u, 1.5, .1, .12, 2.6, 'schoolBusYellow', 'airlockJamb')
    s.plain('signPlate', (5.07, 3.7, 3.0), (.1, 1.0, 1.0), 'schoolBusYellow')
    s.tube('signDisc', (5.14, 3.7, 3.0), .3, .05, 'uiDark', X)
    # plant wing on the -Y side: louvres, scrubber tank, exhaust stacks
    for u in (-2.8, .2, 3.2):
        s.on_wall((0, 1), 4.5, .03, u, 2.2, .08, 2.2, 1.6, 'uiDark', 'louvreBack')
        if L < 2:
            for z in ([1.7, 1.95, 2.2, 2.45, 2.7] if L == 0 else [2.2]):
                s.on_wall((0, 1), 4.5, .07, u, z, .06, 2.1, .08, 'picketWhite', 'louvre')
    s.tube('scrubber', (-2.6, -6.0, 3.15), 1.1, 5.7, 'sidewalk')
    s.tube('scrubberCap', (-2.6, -6.0, 6.0), 1.2, .22, 'uiDark')
    s.plain('scrubberBase', (-2.6, -6.0, .25), (2.8, 2.8, .5), 'sidewalk')
    s.tube('duct', (-2.6, -4.2, 5.0), .4, 2.0, 'uiDark', Y)
    for x in (1.5, 3.0):  # tallest points, kept at every tier
        s.tube('stack', (x, -3.6, 5.95), .26, 2.3, 'uiDark')
    if L < 2:
        for z in (1.2, 3.0, 4.8):
            s.tube('scrubberBand', (-2.6, -6.0, z), 1.14, .12, 'uiDark')
        for x in (1.5, 3.0):
            s.tube('stackCap', (x, -3.6, 7.08), .36, .14, 'sidewalk')
        s.plain('hvac', (-1.5, 2.0, 5.18), (2.4, 2.0, 1.0), 'picketWhite')  # stacks/hvac reach above the parapet
        s.tube('hvacFan', (-1.5, 2.0, 5.74), .7, .1, 'uiDark')
    for u in (-3.0, 3.0):
        s.window((-1, 0), 5.0, u, 2.6, 2.0, 1.5, 'uiDark', 'picketWhite')
    colliders.cuboid('body', (10.6, 9.6, 5.4), (0, 0, 2.7), s.root)
    colliders.cuboid('airlock', (2.8, 4.0, 3.8), (6.1, 0, 1.9), s.root)
    colliders.cuboid('scrubber', (2.8, 2.8, 6.2), (-2.6, -6.0, 3.1), s.root)


def iso_tent(s):
    L = s.lod
    s.plain('floor', (0, 0, .06), (4.4, 7.2, .12), 'sidewalk')
    s.plain('walls', (0, 0, .82), (4.0, 6.6, 1.5), 'picketWhite')
    s.prism('roof', [(-2.25, 1.4), (2.25, 1.4), (0, 3.1)], 'y', -3.7, 3.7, 'picketWhite')
    for ny in (-1, 1):  # gable ends
        a0, a1 = (3.7, 3.78) if ny > 0 else (-3.78, -3.7)
        s.prism('gable', [(-1.95, 1.55), (1.95, 1.55), (0, 2.95)], 'y', a0, a1, 'picketWhite')
    for nx in (-1, 1):  # hazard-yellow eave band
        s.on_wall((nx, 0), 2.0, .03, 0, 1.15, .06, 6.4, .22, 'schoolBusYellow', 'eaveBand')
    # airlock annex on the +X face
    s.plain('annex', (2.9, 0, .92), (1.8, 2.6, 1.7), 'picketWhite')
    s.plain('annexRoof', (2.95, 0, 1.86), (2.2, 3.0, .12), 'schoolBusYellow')
    s.on_wall((1, 0), 3.8, .02, 0, .85, .08, 1.0, 1.55, 'uiDark', 'door')
    if L < 2:
        s.on_wall((1, 0), 3.8, .05, 0, 1.68, .1, 1.3, .12, 'schoolBusYellow', 'doorHead')
    for nx in (-1, 1):  # clear panels in the long walls (below the eave band)
        for u in (-1.8, 1.8):
            s.on_wall((nx, 0), 2.0, .02, u, .62, .08, 1.1, .45, 'uiDark', 'window')
    if L < 2:  # guy ropes and stakes, kept inside the footprint
        for sx in (-1, 1):
            for sy in (-1, 1):
                s.beam('rope', (sx * 2.0, sy * 2.9, 1.5), (sx * 2.2, sy * 3.5, .12), .03, 'uiDark')
                s.plain('stake', (sx * 2.2, sy * 3.5, .1), (.1, .1, .2), 'schoolBusYellow')
    colliders.cuboid('body', (4.6, 7.4, 3.2), (0, 0, 1.6), s.root)
    colliders.cuboid('annex', (2.2, 3.0, 2.0), (2.95, 0, 1.0), s.root)
    s.physics()


def generator(s):
    L = s.lod
    for y in (-.5, .5):
        s.plain('skidRail', (0, y, .1), (2.8, .14, .14), 'uiDark')
    for x in (-1.2, 0, 1.2):
        s.plain('skidCross', (x, 0, .09), (.14, 1.1, .1), 'uiDark')
    s.plain('enclosure', (0, 0, .85), (2.4, 1.05, 1.3), 'orange')
    s.plain('lid', (0, 0, 1.53), (2.5, 1.15, .1), 'uiDark')
    # louvre bays on both long sides
    for ny in (-1, 1):
        for u in (-.55, .55):
            s.on_wall((0, ny), .525, .01, u, .85, .06, .8, .62, 'uiDark', 'louvreBack')
            if L < 2:
                for z in ([.68, .82, .96] if L == 0 else [.82]):
                    s.on_wall((0, ny), .525, .03, u, z, .06, .74, .05, 'orange', 'louvre')
    # control panel at the +X end
    s.on_wall((1, 0), 1.2, .02, 0, .9, .08, .8, .62, 'uiDark', 'panel')
    if L < 2:
        s.on_wall((1, 0), 1.2, .05, -.2, .98, .06, .26, .18, 'sidewalk', 'gauge')
    s.on_wall((1, 0), 1.2, .05, .22, .85, .06, .2, .2, 'survivorRed', 'estop')
    # exhaust stack with rain cap, lifting eye and a cable coil on the ground
    s.tube('exhaust', (-.8, -.3, 1.95), .08, .8, 'uiDark')
    s.tube('exhaustCap', (-.8, -.3, 2.38), .13, .06, 'sidewalk')
    if L < 2:
        s.plain('lift', (.8, .3, 1.66), (.3, .06, .14), 'uiDark')
        s.tube('cable', (.6, -.1, 1.64), .26, .14, 'uiDark')
    if L == 0:
        s.plain('fuelTank', (-.7, .3, 1.8), (.9, .5, .3), 'sidewalk')
    colliders.cuboid('body', (2.9, 1.2, 1.7), (0, 0, .85), s.root)
    s.physics('heavy', 600)


def quarantine_fence(s):
    L = s.lod
    # barrier panel along x: steel posts on feet, white sheeting, hazard bands, biohazard sign on the +Y face
    for x in (-1.5, 1.5):
        s.plain('post', (x, 0, 1.05), (.09, .09, 2.1), 'uiDark')
        s.plain('foot', (x, 0, .06), (.18, .9, .12), 'uiDark')
    s.plain('sheet', (0, 0, 1.2), (2.95, .03, 1.5), 'picketWhite')
    s.plain('topBand', (0, 0, 1.86), (3.0, .05, .24), 'schoolBusYellow')
    s.plain('lowBand', (0, 0, .55), (3.0, .05, .16), 'schoolBusYellow')
    if L < 2:
        s.plain('topRail', (0, 0, 2.06), (3.02, .08, .08), 'uiDark')
        s.plain('sign', (0, .035, 1.15), (.5, .03, .5), 'schoolBusYellow')
        s.tube('signDisc', (0, .06, 1.15), .15, .03, 'uiDark', Y)
    if L == 0:
        for k in range(5):
            s.plain('stripe', (-1.2 + k * .6, 0, 1.86), (.2, .06, .24), 'uiDark')
    colliders.cuboid('body', (3.2, .9, 2.2), (0, 0, 1.1), s.root)
    s.physics()


cure_kits.RECIPES.update({
    'bld.cure-guard-post': guard_post, 'bld.cure-motor-shelter': motor_shelter, 'prop.cure-mil-fence': mil_fence,
    'bld.cure-lab-main': lab_main, 'bld.cure-lab-annex': lab_annex, 'prop.cure-iso-tent': iso_tent,
    'prop.cure-generator': generator, 'prop.cure-quarantine-fence': quarantine_fence,
})
cure_kits.REFINE.update({
    'bld.cure-guard-post': (2.0, 3.0, 0), 'bld.cure-motor-shelter': (2.5, 5.0, 0),
    'bld.cure-lab-main': (2.5, 5.0, 0), 'bld.cure-lab-annex': (2.0, 4.0, 0), 'prop.cure-iso-tent': (1.5, 3.0, 0),
})
build_set = cure_kits.build_set
