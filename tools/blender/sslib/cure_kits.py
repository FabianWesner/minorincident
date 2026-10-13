"""L10 'The Cure' residential-fringe and industrial-area kit modules (epic 32, row L10-A4).

Only the modules that the existing stock lacks: low duplex, security post, masonry garden wall (R2) and
low warehouse, service building, container stack, drum/pallet stack (R3). Everything is built from closed
solids (boxes, prisms, cylinders) at every tier; LOD1/LOD2 drop fittings and radial sides, they never
collapse panels. At most four palette materials per module. Forward is +X (`front` is added by finish()).
"""
import json
import math
import bmesh
import bpy
from . import palette, sockets, colliders
from . import export, ao
from .rescue_assets import Scene

ASSETS = (
    'bld.cure-duplex', 'bld.cure-security-post', 'prop.cure-garden-wall',
    'bld.cure-warehouse', 'bld.cure-service-building', 'prop.cure-container-stack', 'prop.cure-drum-stack',
)


class K(Scene):
    def plain(self, name, pos, size, token, parent=None, angle=0, bevel=None):
        """Closed box. LOD0 keeps a one-segment bevel on parts >= 12 cm (light catch); small fittings stay flat."""
        obj = self.box(name, pos, size, token, parent, angle)
        if bevel is None:
            bevel = self.lod == 0 and min(size) >= .12
        if not bevel and 'bevel' in obj.modifiers:
            obj.modifiers.remove(obj.modifiers['bevel'])
        return obj

    def prism(self, name, pts, axis, a0, a1, token, parent=None):
        """Closed prism: polygon `pts` (x,z for axis 'y'; y,z for axis 'x') extruded from a0 to a1 along `axis`."""
        count = len(pts)
        def vert(p, a):
            return (p[0], a, p[1]) if axis == 'y' else (a, p[0], p[1])
        vs = [vert(p, a0) for p in pts] + [vert(p, a1) for p in pts]
        fs = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
        fs += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
        data = bpy.data.meshes.new(name)
        data.from_pydata(vs, [], fs)
        data.materials.append(palette.mat(token))
        bm = bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent or self.body
        return obj

    def on_wall(self, n, f, d, u, z, depth, width, height, token, name='part'):
        """Box on a wall whose outward normal is n=(nx,ny) at distance f: d out of the wall plane, u along it, z centre."""
        nx, ny = n
        tx, ty = -ny, nx
        pos = (nx * (f + d) + tx * u, ny * (f + d) + ty * u, z)
        size = (depth, width, height) if nx else (width, depth, height)
        return self.plain(name, pos, size, token)

    def window(self, n, f, u, z, w, h, glass='backpackTeal', frame='picketWhite'):
        """Recessed pane plus (tier-dependent) frame bars whose faces all sit in different planes."""
        self.on_wall(n, f, .01, u, z, .06, w, h, glass, 'pane')
        if self.lod == 0:
            self.on_wall(n, f, .03, u - w / 2 - .06, z, .10, .12, h + .02, frame, 'frameSide')
            self.on_wall(n, f, .03, u + w / 2 + .06, z, .10, .12, h + .02, frame, 'frameSide')
            self.on_wall(n, f, .035, u, z + h / 2 + .06, .12, w + .36, .12, frame, 'lintel')
            self.on_wall(n, f, .06, u, z - h / 2 - .06, .16, w + .46, .12, frame, 'sill')
        elif self.lod == 1:
            self.on_wall(n, f, .04, u, z + h / 2 + .06, .10, w + .3, .12, frame, 'lintel')
            self.on_wall(n, f, .07, u, z - h / 2 - .06, .16, w + .4, .12, frame, 'sill')

    def door(self, n, f, u, z0, w, h, leaf='backpackTeal', frame='picketWhite'):
        self.on_wall(n, f, .02, u, z0 + h / 2, .08, w, h, leaf, 'door')
        if self.lod < 2:
            self.on_wall(n, f, .045, u - w / 2 - .07, z0 + h / 2 + .06, .10, .14, h + .12, frame, 'doorJamb')
            self.on_wall(n, f, .045, u + w / 2 + .07, z0 + h / 2 + .06, .10, .14, h + .12, frame, 'doorJamb')
            self.on_wall(n, f, .065, u, z0 + h + .13, .14, w + .42, .16, frame, 'doorHead')
            self.on_wall(n, f, .08, u + w * .32, z0 + h * .48, .06, .08, .24, frame, 'handle')


def duplex(s):
    L = s.lod
    s.plain('slab', (0, 0, .175), (8.8, 13.8, .35), 'picketWhite')
    s.plain('walls', (0, 0, 3.0), (8, 13, 5.4), 'brick')
    s.plain('partyStrip', (3.95, 0, 3.0), (.2, .28, 5.4), 'picketWhite')
    # Roof: ridge along y, real overhang; brick gable infill stands proud of the roof end.
    s.prism('roof', [(-4.5, 5.55), (4.5, 5.55), (0, 8.15)], 'y', -7.0, 7.0, 'asphalt')
    for side in (-1, 1):
        a0, a1 = (7.0, 7.08) if side > 0 else (-7.08, -7.0)
        s.prism('gable', [(-3.9, 5.75), (3.9, 5.75), (0, 7.85)], 'y', a0, a1, 'brick')
    s.plain('chimney', (-1.5, 3.2, 7.4), (.9, .9, 3.0), 'brick')
    s.plain('chimneyCap', (-1.5, 3.2, 8.95), (1.12, 1.12, .16), 'picketWhite')
    for y in (-1, 1):  # two units, doors at the outside
        yc = y * 4.7
        s.door((1, 0), 4.0, yc, .45, 1.1, 2.2)
        s.window((1, 0), 4.0, y * 2.0, 1.95, 1.7, 1.5)
        s.window((1, 0), 4.0, y * 2.0, 4.35, 1.5, 1.5)
        s.window((1, 0), 4.0, y * 4.7, 4.35, 1.2, 1.5)
        # porch canopy on two posts, one step
        s.plain('canopy', (4.7, yc, 3.0), (1.6, 2.4, .16), 'picketWhite')
        s.plain('step', (4.85, yc, .27), (1.3, 1.7, .54), 'picketWhite')
        if L < 2:
            for dy in (-1.0, 1.0):
                s.plain('porchPost', (5.35, yc + dy, 1.7), (.14, .14, 2.6), 'picketWhite')
        # rear
        s.door((-1, 0), 4.0, yc, .45, 1.1, 2.2)
        s.window((-1, 0), 4.0, y * 2.0, 1.95, 1.5, 1.4)
        s.window((-1, 0), 4.0, y * 2.0, 4.35, 1.5, 1.5)
        s.window((-1, 0), 4.0, y * 4.7, 4.35, 1.2, 1.5)
    # gable ends: one tall window per floor
    for ny in (-1, 1):
        s.window((0, ny), 6.5, 0, 1.95, 1.4, 1.5)
        s.window((0, ny), 6.5, 0, 4.35, 1.4, 1.5)
        s.window((0, ny), 6.5, 2.4, 4.35, 1.0, 1.4) if L < 2 else None
    if L < 2:  # utility fittings
        s.plain('acUnit', (4.45, 0, .45), (.8, 1.1, .9), 'picketWhite')
        s.plain('downpipe', (4.1, -6.4, 2.9), (.14, .14, 5.2), 'picketWhite')
        s.plain('downpipe', (4.1, 6.4, 2.9), (.14, .14, 5.2), 'picketWhite')
    colliders.cuboid('body', (8.8, 13.8, 8.15), (0, 0, 4.075), s.root)


def security_post(s):
    L = s.lod
    s.plain('plinth', (-1.2, -2.9, .15), (3.8, 3.4, .3), 'picketWhite')
    s.plain('booth', (-1.2, -2.9, 1.62), (3.2, 2.8, 2.7), 'picketWhite')
    s.plain('stripe', (-1.2, -2.9, 1.15), (3.3, 2.9, .5), 'policeBlue')
    s.plain('boothRoof', (-1.2, -2.9, 3.05), (3.9, 3.5, .2), 'uiDark')
    # glazing: lane side (+y), front (+x), rear door (-x)
    s.window((0, 1), -1.5, 1.2, 1.95, 2.3, 1.0, 'uiDark', 'picketWhite')
    s.window((1, 0), 0.4, -2.9, 1.95, 1.7, 1.0, 'uiDark', 'picketWhite')
    s.window((0, -1), 4.3, -1.2, 1.95, 1.4, 1.0, 'uiDark', 'picketWhite')
    s.door((-1, 0), 2.8, 2.9, .3, .95, 2.0, 'uiDark', 'picketWhite')
    # canopy over the lane
    s.plain('canopy', (0, -.25, 4.75), (9.2, 7.6, .25), 'picketWhite')
    s.plain('canopyBeam', (4.47, -.25, 4.45), (.3, 7.4, .5), 'policeBlue')
    for x in (-3.8, 3.8):
        for y in (-3.4, 2.9):
            s.plain('post', (x, y, 2.4), (.34, .34, 4.8), 'picketWhite')
            s.plain('postBase', (x, y, .17), (.6, .6, .34), 'policeBlue')
    if L < 2:
        # light bar, lane stripes and bollards
        s.plain('beaconBar', (-1.2, -2.9, 3.28), (.9, 2.0, .16), 'uiDark')
        for y in (-3.6, -2.2):
            s.plain('beacon', (-1.2, y, 3.43), (.5, .5, .24), 'survivorRed')
        s.plain('signBoard', (4.62, -.25, 4.38), (.12, 5.0, .26), 'picketWhite')
    for y in (-.4, 1.4):
        s.tube('bollard', (5.2, y, .5), .12, .9, 'survivorRed')
    if L == 0:
        for i in range(5):
            s.plain('laneStripe', (-3.3 + i * 1.6, 1.1, .02), (.8, .14, .04), 'picketWhite')
    colliders.cuboid('booth', (3.8, 3.4, 3.15), (-1.2, -2.9, 1.575), s.root)
    for x in (-3.8, 3.8):
        for y in (-3.4, 2.9):
            colliders.cuboid(f'post{x}{y}', (.4, .4, 4.8), (x, y, 2.4), s.root)


def garden_wall(s):
    L = s.lod
    s.plain('wall', (0, 0, .5), (3.0, .34, 1.0), 'brick')
    s.plain('coping', (0, 0, 1.05), (3.16, .46, .12), 'picketWhite')
    for x in (-1.5, 1.5):
        s.plain('pillar', (x, 0, .72), (.42, .42, 1.44), 'brick')
        s.plain('pillarCap', (x, 0, 1.5), (.54, .54, .12), 'picketWhite')
    s.plain('rail', (0, 0, 1.88), (2.6, .06, .06), 'uiDark')
    if L < 2:
        for x in ([-1.0 + i * .4 for i in range(6)] if L == 0 else [-.9, 0, .9]):
            s.plain('bar', (x, 0, 1.5), (.045, .045, .86), 'uiDark')
        if L == 0:
            s.plain('railLow', (0, 0, 1.3), (2.6, .06, .06), 'uiDark')
    colliders.cuboid('body', (3.2, .5, 1.6), (0, 0, .8), s.root)
    s.physics()


def warehouse(s):
    L = s.lod
    W, D, H = 30, 18, 7.2
    s.plain('base', (0, 0, .5), (D + .3, W + .3, 1.0), 'asphalt')
    s.plain('walls', (0, 0, 3.875), (D, W, 6.75), 'sidewalk')
    s.prism('roof', [(-9.45, H), (9.45, H), (0, H + 1.9)], 'y', -15.45, 15.45, 'asphalt')
    for side in (-1, 1):
        a0, a1 = (15.45, 15.53) if side > 0 else (-15.53, -15.45)
        s.prism('gable', [(-8.9, H + .25), (8.9, H + .25), (0, H + 1.65)], 'y', a0, a1, 'sidewalk')
    # dock platform, canopy and doors on the +X front
    s.plain('dock', (10.6, 0, .66), (3.3, 25, 1.32), 'sidewalk')
    s.plain('dockEdge', (12.3, 0, .55), (.36, 25.2, .5), 'schoolBusYellow')
    door_ys = (-10, -5, 0, 5, 10)
    for y in door_ys:
        s.on_wall((1, 0), D / 2, .03, y, 1.32 + 1.9, .06, 3.3, 3.8, 'uiDark', 'dockDoor')
        for z in ([1.32 + .4 + i * .5 for i in range(7)] if L == 0 else [3.2] if L == 1 else []):
            s.on_wall((1, 0), D / 2, .08, y, z, .06, 3.2, .1, 'uiDark', 'dockRib')
        if L < 2:
            for dy in (-1.8, 1.8):
                s.on_wall((1, 0), D / 2, .07, y + dy, 1.32 + 1.95, .12, .2, 4.0, 'schoolBusYellow', 'dockPost')
            s.on_wall((1, 0), D / 2, .075, y, 1.32 + 4.0, .13, 3.7, .2, 'schoolBusYellow', 'dockHead')
    s.plain('canopy', (10.75, 0, 5.75), (3.7, 25.4, .25), 'asphalt')
    for y in door_ys:
        s.plain('bumper', (12.5, y, .75), (.3, .5, .5), 'uiDark')
    for y in (-12.9, 12.9):
        s.tube('bollard', (13.6, y, .6), .13, 1.2, 'schoolBusYellow')
    if L < 2:
        for y in (-12, -6, 0, 6, 12):
            s.plain('canopyPost', (12.4, y, 3.55), (.2, .2, 4.4), 'uiDark')
    # clerestory band
    for i in range(10 if L == 0 else 5 if L == 1 else 3):
        count = 10 if L == 0 else 5 if L == 1 else 3
        y = -13.5 + (i + .5) * 27 / count
        s.on_wall((1, 0), D / 2, .03, y, 6.65, .08, 27 / count * (.62 if L == 0 else .8), .8, 'uiDark', 'clerestory')
    # pilasters on the long walls and the back wall
    if L < 2:
        for y in (-12.5, -7.5, -2.5, 2.5, 7.5, 12.5):
            s.on_wall((-1, 0), D / 2, .15, y, 3.7, .3, .5, 6.4, 'sidewalk', 'pilaster')
        for x in (-6, 0, 6):
            s.on_wall((0, 1), W / 2, .15, x, 3.7, .3, .5, 6.4, 'sidewalk', 'pilaster')
            s.on_wall((0, -1), W / 2, .15, x, 3.7, .3, .5, 6.4, 'sidewalk', 'pilaster')
    # side man doors with a stoop, high windows
    for ny in (-1, 1):
        s.door((0, ny), W / 2, -5, 1.0, 1.1, 2.2, 'uiDark', 'schoolBusYellow')
        s.plain('stoop', (ny * 5, ny * (W / 2 + .5), .5), (2.0, 1.0, 1.0), 'sidewalk')
        for x in (-1, 3, 6):
            s.on_wall((0, ny), W / 2, .03, x, 5.8, .08, 1.5, .8, 'uiDark', 'sideWindow')
    # roof: ridge vents and two condensers, standing in the roof plane
    for y in ((-8, 0, 8) if L < 2 else (0,)):
        s.tube('ridgeVent', (0, y, H + 2.2), .5, 1.0, 'uiDark')
        s.tube('ridgeCap', (0, y, H + 2.7), .7, .16, 'asphalt')
    if L < 2:
        for y in (-11, 11):
            s.plain('hvac', (-5.3, y, H + .75), (2.2, 2.6, 1.3), 'sidewalk')
            s.tube('hvacFan', (-5.3, y, H + 1.45), .8, .12, 'uiDark')
        for y in (-15.12, 15.12):
            for x in (-8.5, 8.5):
                s.tube('downpipe', (x, y, 3.7), .1, 6.4, 'uiDark')
    colliders.cuboid('body', (D + .3, W + .3, 9.1), (0, 0, 4.55), s.root)
    colliders.cuboid('dock', (3.3, 25, 1.32), (10.6, 0, .66), s.root)


def service_building(s):
    L = s.lod
    s.plain('base', (0, 0, .35), (10.2, 8.2, .7), 'asphalt')
    s.plain('walls', (0, 0, 2.5), (10, 8, 4.1), 'sidewalk')
    s.plain('deck', (0, 0, 4.5), (9.8, 7.8, .2), 'asphalt')
    for x in (-1, 1):
        s.plain('parapetX', (x * 4.9, 0, 4.85), (.4, 7.4, .7), 'asphalt')
    for y in (-1, 1):
        s.plain('parapetY', (0, y * 3.9, 4.85), (10.2, .4, .7), 'asphalt')
    # double door + yellow frame on the +X face, louvres on the sides
    for u in (-.6, .6):
        s.on_wall((1, 0), 5.0, .03, u, 1.7, .06, 1.1, 2.4, 'uiDark', 'doorLeaf')
    if L < 2:
        s.on_wall((1, 0), 5.0, .07, -1.28, 1.76, .12, .16, 2.6, 'schoolBusYellow', 'doorPost')
        s.on_wall((1, 0), 5.0, .07, 1.28, 1.76, .12, .16, 2.6, 'schoolBusYellow', 'doorPost')
        s.on_wall((1, 0), 5.0, .075, 0, 3.12, .13, 2.72, .18, 'schoolBusYellow', 'doorHead')
        s.on_wall((1, 0), 5.0, .09, 0, 1.7, .06, .07, 2.3, 'sidewalk', 'doorSplit')
    for ny in (-1, 1):
        for u in (-2.6, 2.6):
            s.on_wall((0, ny), 4.0, .03, u, 2.9, .08, 1.5, 1.1, 'uiDark', 'louvreBack')
            if L < 2:
                for z in ([2.5, 2.75, 3.0, 3.25] if L == 0 else [2.9]):
                    s.on_wall((0, ny), 4.0, .07, u, z, .06, 1.38, .07, 'sidewalk', 'louvre')
    # pipe run on the rear wall with a vertical riser, rooftop condensers and a stack
    s.tube('pipeRiser', (-5.07, -2.0, 2.5), .1, 4.4, 'uiDark')
    s.tube('pipeRun', (-5.1, 0, 4.0), .13, 4.0, 'uiDark', (math.pi / 2, 0, 0))
    s.tube('pipeRiserB', (-5.07, 2.0, 2.5), .1, 4.4, 'uiDark')
    s.plain('meterBox', (5.1, 3.0, 1.4), (.2, .8, 1.0), 'uiDark')
    s.tube('stack', (-3.2, 2.2, 5.8), .28, 2.4, 'uiDark')
    s.plain('hvac', (-1.5, -1.5, 5.08), (2.0, 1.8, 1.0), 'sidewalk')
    s.tube('hvacFan', (-1.5, -1.5, 5.63), .7, .1, 'uiDark')
    if L < 2:
        s.plain('hvac', (1.8, 1.4, 4.98), (1.6, 1.6, .8), 'sidewalk')
        s.tube('hvacFan', (1.8, 1.4, 5.43), .55, .1, 'uiDark')
        s.tube('stackBand', (-3.2, 2.2, 6.6), .32, .2, 'schoolBusYellow')
    for y in (-3.9, 3.9):
        s.tube('bollard', (5.9, y, .6), .13, 1.2, 'schoolBusYellow')
    colliders.cuboid('body', (10.2, 8.2, 5.2), (0, 0, 2.6), s.root)


def container(s, cx, cy, z0, yaw, token):
    """One 6.06 x 2.44 x 2.59 shipping container (long axis local x), corrugation as proud ribs. Rotated by yaw."""
    L = s.lod
    c, sn = math.cos(yaw), math.sin(yaw)
    def at(dx, dy, dz, size, tok, name):
        o = s.plain(name, (cx + dx * c - dy * sn, cy + dx * sn + dy * c, z0 + dz), size, tok, angle=yaw)
        return o
    at(0, 0, 1.295, (6.0, 2.36, 2.5), token, 'container')
    ribs = 14 if L == 0 else 5 if L == 1 else 0
    for i in range(ribs):
        x = -2.7 + i * 5.4 / max(ribs - 1, 1)
        for side in (-1, 1):
            at(x, side * 1.2, 1.3, (.16, .09, 2.2), token, 'rib')
    if L < 2:
        for sx in (-1, 1):
            for sy in (-1, 1):
                at(sx * 2.95, sy * 1.14, 2.45, (.18, .18, .18), 'uiDark', 'casting')
                at(sx * 2.95, sy * 1.14, .14, (.18, .18, .18), 'uiDark', 'casting')
    # door end (+local x): two leaves, locking rods and a dark seam
    at(3.015, -.57, 1.3, (.03, 1.1, 2.3), token, 'doorLeaf')
    at(3.015, .57, 1.3, (.03, 1.1, 2.3), token, 'doorLeaf')
    at(3.04, 0, 1.3, (.03, .05, 2.3), 'uiDark', 'doorSeam')
    if L < 2:
        for y in (-.9, -.35, .35, .9):
            at(3.05, y, 1.3, (.03, .05, 2.2), 'uiDark', 'lockRod')
    if L == 0:
        at(3.05, 0, 1.0, (.04, .1, .18), 'uiDark', 'handle')


def container_stack(s):
    container(s, 0, -1.35, 0, 0, 'survivorRed')
    container(s, 0, 1.35, 0, 0, 'backpackTeal')
    container(s, 0, 0, 2.49, math.pi / 2, 'survivorRed')
    colliders.cuboid('body', (6.1, 6.1, 5.2), (0, 0, 2.6), s.root)
    s.physics()


def drum_stack(s):
    L = s.lod
    def pallet(z0):
        if L == 2:  # distant tier: one slab stands for stringers and deck boards
            s.plain('pallet', (0, 0, z0 + .08), (1.28, 1.0, .16), 'woodWarm')
            return
        for y in (-.42, 0, .42):
            s.plain('stringer', (0, y, z0 + .06), (1.18, .1, .12), 'woodWarm')
        for x in [-.54, -.27, 0, .27, .54]:
            s.plain('deck', (x, 0, z0 + .14), (.2, 1.0, .05), 'woodWarm')
    pallet(0)
    pallet(1.05)
    for tier, z0 in enumerate((.17, 1.22)):
        for i, (x, y) in enumerate(((-.3, -.25), (.3, -.25), (-.3, .25), (.3, .25))):
            s.tube('drum', (x, y, z0 + .45), .27, .9, 'survivorRed' if (i + tier) % 2 else 'backpackTeal')
            if L < 2:
                for z in ((.2, .7) if L == 0 else (.45,)):
                    s.tube('drumBand', (x, y, z0 + z), .285, .07, 'uiDark')
            elif tier == 1:  # distant tier keeps the dark hoop on the top row only (token stays visible)
                s.tube('drumBand', (x, y, z0 + .45), .285, .07, 'uiDark')
    colliders.cuboid('body', (1.3, 1.1, 2.2), (0, 0, 1.1), s.root)
    s.physics('heavy', 300)


RECIPES = {
    'bld.cure-duplex': duplex, 'bld.cure-security-post': security_post, 'prop.cure-garden-wall': garden_wall,
    'bld.cure-warehouse': warehouse, 'bld.cure-service-building': service_building,
    'prop.cure-container-stack': container_stack, 'prop.cure-drum-stack': drum_stack,
}


def refine(obj, step):
    """Cut the mesh with axis-aligned planes every `step` metres so the per-vertex AO bake resolves big walls
    and roofs instead of interpolating four corner values (regular grid, no slivers)."""
    if not step:
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for axis in range(3):
        values = [v.co[axis] for v in bm.verts]
        c = math.ceil(min(values) / step) * step
        while c < max(values):
            normal = [0, 0, 0]
            normal[axis] = 1
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=[c * (k == axis) for k in range(3)], plane_no=normal)
            c += step
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


# Longest triangle edge per tier before the AO bake (metres) and the AO floor that keeps the palette readable.
REFINE = {'bld.cure-duplex': (2.0, 3.0, 0), 'bld.cure-security-post': (2.0, 3.0, 0), 'bld.cure-warehouse': (2.5, 5.0, 0),
          'bld.cure-service-building': (2.0, 3.0, 0)}  # small props keep their authored faces (AO floor only)
AO_FLOOR = .7


def finish(s, path):
    export.merge_by_material(s.root, s.protected)
    bpy.context.view_layer.update()
    meshes = [o for o in s.root.children_recursive if o.type == 'MESH']
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    low = [min(p[k] for p in points) for k in range(3)]
    high = [max(p[k] for p in points) for k in range(3)]
    sockets.empty('front', (high[0], 0, 0), s.root)
    if 'ss_physics' in s.root:
        physics = json.loads(s.root['ss_physics'])
        physics['centerOfMass'] = [(low[0] + high[0]) / 2, (low[2] + high[2]) / 2, -(low[1] + high[1]) / 2]
        s.root['ss_physics'] = json.dumps(physics)
    for o in meshes:
        refine(o, REFINE.get(s.asset, (0, 0, 0))[s.lod])
    ao.bake_all(meshes, 16)
    for o in meshes:  # bounded AO contrast, like the evac bus: contact shading without black walls
        for value in o.data.color_attributes['ao'].data:
            value.color = tuple(AO_FLOOR + (1 - AO_FLOOR) * c for c in value.color[:3]) + (1,)
    export.glb(s.root, path)
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    return {'triangles': tris, 'dimensions': {'x': high[0] - low[0], 'y': high[2] - low[2], 'z': high[1] - low[1], 'tolerance': .1}}


def build_set(asset, directory):
    from pathlib import Path
    directory = Path(directory)
    stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s = K(asset, lod)
        RECIPES[asset](s)
        stats['lod' + str(lod)] = finish(s, directory / ('model' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb'))
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    return stats
