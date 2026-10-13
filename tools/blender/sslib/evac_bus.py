"""veh.evac-bus hero build (PO 2026-10-13: "Actually the bus is pretty under-whelming for a major asset").

Cream coach with a blue belt stripe: lofted lower shell with real wheel arches, a stair well and a folding entry door,
open window band with framed transparent glass over a seated interior, rounded roof with a raked windshield header,
destination sign, fittings and four wheel pivots. Blender frame: +X front, +Y door side (doorR), Z up, metres.

Every part is a closed solid. Separate trim sits at least 8 mm off the surface it decorates (no coplanar faces; the
validator in tools/assets/zfight.ts enforces it). LOD1/LOD2 are the same recipe with fewer arc segments and fewer
fittings, not decimation.
"""
import json
import math
import bpy
import bmesh
from mathutils import Matrix, Vector
from . import palette, sockets, colliders
from .rescue_assets import Scene, finish

HW = 1.25                       # half width of the body
X_REAR, X_FRONT = -4.60, 4.50   # lower shell extent
SILL, ROOF0, CROWN = 1.42, 2.34, 2.92
FLOOR = 1.14
WHEELS = [('wheelFL', 2.40, -1.11), ('wheelFR', 2.40, 1.11), ('wheelRL', -2.95, -1.11), ('wheelRR', -2.95, 1.11)]
PILLARS = [-4.25 + i * (3.12 + 4.25) / 6 for i in range(7)]
DOOR_X0, DOOR_X1 = 3.20, 4.02


# ---------------------------------------------------------------- geometry helpers
def link(name, bm, mat, parent):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    for m in (mat if isinstance(mat, (list, tuple)) else [mat]):
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def box_bm(c, size, r=0.0, seg=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    if r > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(r, min(size) * .45), segments=seg, profile=.5, affect='EDGES')
    return bm


def hull_bm(points):
    bm = bmesh.new()
    seen = set()
    for p in points:
        key = tuple(round(float(c), 6) for c in p)
        if key not in seen:
            seen.add(key)
            bm.verts.new(p)
    res = bmesh.ops.convex_hull(bm, input=bm.verts[:])
    junk = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if junk:
        bmesh.ops.delete(bm, geom=junk, context='VERTS')
    return bm


def cyl_bm(c, r, length, axis='y', segs=12, r2=None):
    bm = bmesh.new()
    rot = {'z': Matrix.Identity(4), 'y': Matrix.Rotation(math.pi / 2, 4, 'X'), 'x': Matrix.Rotation(math.pi / 2, 4, 'Y')}[axis]
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2,
                          depth=length, matrix=Matrix.Translation(c) @ rot)
    return bm


def loft_bm(rings, caps=True):
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vr, vr[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if caps:
        bm.faces.new(vr[0][::-1])
        bm.faces.new(vr[-1])
    return bm


def rrect(x0, x1, hw, rr, rf, seg):
    pts = []

    def arc(cx, cy, r, a0, a1):
        for k in range(seg + 1):
            a = a0 + (a1 - a0) * k / seg
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    arc(x1 - rf, -hw + rf, rf, -math.pi / 2, 0)
    arc(x1 - rf, hw - rf, rf, 0, math.pi / 2)
    arc(x0 + rr, hw - rr, rr, math.pi / 2, math.pi)
    arc(x0 + rr, -hw + rr, rr, math.pi, 1.5 * math.pi)
    return pts


def boolean(obj, cutters):
    bpy.context.view_layer.objects.active = obj
    for c in obj.users_collection[0].objects:
        c.select_set(False)
    obj.select_set(True)
    for cutter in cutters:
        m = obj.modifiers.new('cut', 'BOOLEAN')
        m.operation = 'DIFFERENCE'
        m.solver = 'EXACT'
        m.object = cutter
        bpy.ops.object.modifier_apply(modifier=m.name)
        data = cutter.data
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.meshes.remove(data)


class Bus:
    def __init__(self, s):
        self.s, self.L = s, s.lod
        self.M = {}

    def mat(self, token, emissive=False):
        key = (token, emissive)
        if key not in self.M:
            self.M[key] = palette.mat(token, emissive)
        return self.M[key]

    def glass(self):
        if 'glass' not in self.M:
            m = bpy.data.materials.get('pal_backpackTeal') or palette.mat('backpackTeal')
            b = m.node_tree.nodes['Principled BSDF']
            b.inputs['Base Color'].default_value = (.145, .40, .45, 1)
            b.inputs['Alpha'].default_value = .18
            b.inputs['Roughness'].default_value = .28
            m.diffuse_color = (.145, .40, .45, .18)
            m.surface_render_method = 'BLENDED'
            self.M['glass'] = m
        return self.M['glass']

    def add(self, name, bm, token, parent=None, emissive=False, mat=None):
        return link(name, bm, mat or self.mat(token, emissive), parent or self.s.body)

    def box(self, name, c, size, token, r=0.0, seg=1, parent=None, emissive=False):
        return self.add(name, box_bm(c, size, r, seg), token, parent, emissive)

    def mirror_y(self, fn):
        for sy in (-1, 1):
            fn(sy)

    # ------------------------------------------------------------ main shell
    def lower_body(self):
        L = self.L
        seg = [6, 3, 2][L]
        layers = [(.05, .38), (0, .44)] + ([(0, .72), (0, 1.08)] if L < 2 else []) + [(0, SILL - .03), (.03, SILL)]
        rings = []
        for inset, z in layers:
            rings.append([(x, y, z) for x, y in rrect(X_REAR + inset, X_FRONT - inset, HW - inset, max(.3 - inset, .08), max(.45 - inset, .08), seg)])
        obj = self.add('lowerBody', loft_bm(rings), 'picketWhite', mat=[self.mat('picketWhite'), self.mat('sidewalk'), self.mat('asphalt')])
        cut = []
        # interior pocket (floor at FLOOR) and the stair well of the entry door
        cut.append(self._cutter('pocket', (-4.42, 3.95), (-1.10, 1.10), (FLOOR, SILL + .2)))
        cut.append(self._cutter('stairwell', (DOOR_X0, DOOR_X1), (.62, HW + .2), (.58, SILL + .2)))
        for name, x, y in WHEELS:
            cut.append(link('arch', cyl_bm((x, math.copysign(1.15, y), .52), .60, .46, 'y', [28, 16, 10][L]), self.mat('picketWhite'), None))
        boolean(obj, cut)
        # interior surfaces get their own materials (faces that lie inside the pocket box)
        me = obj.data
        for p in me.polygons:
            c = p.center
            inside = -4.43 <= c.x <= 3.96 and abs(c.y) <= 1.105 and c.z >= FLOOR - .005
            stair = DOOR_X0 - .005 <= c.x <= DOOR_X1 + .005 and .615 <= c.y <= HW + .21 and .575 <= c.z <= SILL + .2 and abs(c.y) < HW - .005
            if inside or stair:
                p.material_index = 2 if p.normal.z > .9 else 1
        return obj

    def _cutter(self, name, xr, yr, zr):
        c = ((xr[0] + xr[1]) / 2, (yr[0] + yr[1]) / 2, (zr[0] + zr[1]) / 2)
        return link(name, box_bm(c, (xr[1] - xr[0], yr[1] - yr[0], zr[1] - zr[0])), self.mat('picketWhite'), None)

    def underbody(self):
        self.box('underbody', (-.1, 0, .31), (8.3, 1.9, .26), 'uiDark')
        if self.L < 2:
            for x in (2.40, -2.95):
                self.box('axle', (x, 0, .52), (.14, 2.2, .14), 'uiDark')

    def roof(self):
        L = self.L
        inset_stations = {0: [0, .04, .09, .16, .25], 1: [0, .09, .25], 2: [0, .25]}[L]
        arc = [4, 2, 1][L]

        def profile(e, top):
            w = HW
            pts = [(-w, ROOF0, 0), (w, ROOF0, 0), (w, ROOF0 + .18, 1)]
            rr = .42
            for k in range(1, arc):
                a = math.pi / 2 * k / arc
                pts.append((w - rr + rr * math.cos(a), CROWN - rr + rr * math.sin(a), 1))
            pts += [(w - rr, CROWN, 1), (-(w - rr), CROWN, 1)]
            for k in range(arc - 1, 0, -1):
                a = math.pi / 2 * k / arc
                pts.append((-(w - rr + rr * math.cos(a)), CROWN - rr + rr * math.sin(a), 1))
            pts.append((-w, ROOF0 + .18, 1))
            out = []
            for y, z, upper in pts:
                if upper:
                    y -= math.copysign(e, y) * 1.0
                    z -= e * (1 if z > ROOF0 + .2 else .6)
                out.append((y, z))
            return out

        def end_inset(d, r):
            return 0 if d >= r else r - math.sqrt(max(r * r - (r - d) ** 2, 0))
        x_rear, x_front = X_REAR + .0, 4.28
        rings = []
        for d in inset_stations:
            rings.append([(x_rear + d, y, z) for y, z in profile(end_inset(d, .30), True)])
        for x in (-2.0, 1.2, 3.7):
            rings.append([(x, y, z) for y, z in profile(0, True)]) if L < 2 or x == 1.2 else None
        rings = [r for r in rings if r]
        for d in reversed(inset_stations):
            rings.append([(x_front - d, y, z) for y, z in profile(end_inset(d, .25), True)])
        rings.sort(key=lambda r: r[0][0])
        # raked windshield header: the roof front sweeps back as it rises
        rake = .18
        out = []
        for ring in rings:
            pts = []
            for x, y, z in ring:
                if x > 3.7:
                    x -= rake * max(z - ROOF0, 0) / (CROWN - ROOF0) * min((x - 3.7) / .58, 1)
                pts.append((x, y, z))
            out.append(pts)
        self.add('roof', loft_bm(out), 'picketWhite')
        self.cap_x = lambda z: x_front - rake * (z - ROOF0) / (CROWN - ROOF0)
        self.cap_slope = -rake / (CROWN - ROOF0)

    def pillars(self):
        L = self.L
        for sy in (-1, 1):
            for i, x in enumerate(PILLARS):
                self.box('pillar', (x, sy * 1.172, (SILL + ROOF0) / 2), (.16, .144, ROOF0 - SILL), 'uiDark')
            # windows (panes sit inside the pillar thickness, 2 cm into the sill ledge and the roof)
            for i in range(len(PILLARS) - 1):
                x0, x1 = PILLARS[i] + .06, PILLARS[i + 1] - .06
                self.add('glass', box_bm(((x0 + x1) / 2, sy * 1.172, (SILL + ROOF0) / 2), (x1 - x0, .014, ROOF0 - SILL + .04)), None, mat=self.glass())
            if sy < 0:
                # driver side front window beside the cab
                self.add('glass', box_bm(((PILLARS[-1] + DOOR_X1) / 2 + .03, sy * 1.172, (SILL + ROOF0) / 2), (DOOR_X1 - PILLARS[-1] - .12, .014, ROOF0 - SILL + .04)), None, mat=self.glass())
                self.box('pillar', (DOOR_X1 + .0, sy * 1.172, (SILL + ROOF0) / 2), (.14, .144, ROOF0 - SILL), 'uiDark')
        # rear window: frame posts, sill strip and glass
        for sy in (-1, 1):
            self.box('rearPost', (-4.46, sy * 1.12, (SILL + ROOF0) / 2), (.22, .26, ROOF0 - SILL + .03), 'uiDark')
        self.box('rearSill', (-4.46, 0, SILL + .08), (.19, 2.0, .24), 'picketWhite')
        self.add('glass', box_bm((-4.46, 0, (SILL + .2 + ROOF0) / 2), (.014, 1.98, ROOF0 - SILL - .2 + .04)), None, mat=self.glass())

    def windshield(self):
        L = self.L
        xb, xt = 4.38, 4.17
        zb, zt = SILL - .015, ROOF0 + .015
        for sy in (-1, 1):
            # centre pane, then the wrap-around corner pane
            for y0, y1, xs0, xs1 in ((.04, .80, 0, 0), (.80, 1.17, 0, -.18)):
                pts = []
                for y, xo in ((y0, xs0), (y1, xs1)):
                    for z, x in ((zb, xb), (zt, xt)):
                        for dx in (-.012, .012):
                            pts.append((x + xo + dx, sy * y, z))
                self.add('glass', hull_bm(pts), None, mat=self.glass())
            self.add('postA', hull_bm([(xb + .03 + dx, sy * (.79 + dy), zb - .015) for dx in (-.07, .07) for dy in (-.05, .05)]
                                      + [(xt + .03 + dx, sy * (.79 + dy), zt + .015) for dx in (-.07, .07) for dy in (-.05, .05)]), 'uiDark')
            self.add('postB', hull_bm([(4.19 + dx, sy * (1.165 + dy), zb - .015) for dx in (-.07, .07) for dy in (-.07, .07)]
                                      + [(3.99 + dx, sy * (1.165 + dy), zt + .015) for dx in (-.07, .07) for dy in (-.07, .07)]), 'uiDark')
        self.add('postC', hull_bm([(xb + dx, dy, zb - .015) for dx in (-.035, .035) for dy in (-.05, .05)]
                                  + [(xt + dx, dy, zt + .015) for dx in (-.035, .035) for dy in (-.05, .05)]), 'uiDark')
        if L < 2:
            for sy in (-1, 1):
                self.add('wiper', box_bm((xb + .06, sy * .4, zb + .07), (.02, .5, .02)), 'uiDark')

    def destination_sign(self):
        s, L = self.s, self.L
        z0, z1 = ROOF0 + .05, ROOF0 + .31
        n = Vector((1, 0, -self.cap_slope)).normalized()
        off = n * .010

        def p(y, z, o=0.0):
            return Vector((self.cap_x(z), y, z)) + off + n * o
        pts = [p(y, z) for y in (-.72, .72) for z in (z0, z1)] + [p(y, z, .035) for y in (-.72, .72) for z in (z0, z1)]
        self.add('signPanel', hull_bm(pts), 'uiDark')
        sign = s.joint('signEvac', (0, 0, 0))
        sign['decorativeEmissive'] = True
        if L < 2:
            self._text('EVAC', .20, 'windowGlow', p(0, (z0 + z1) / 2, .05), sign, face='front', emissive=True, extrude=.014)
        else:
            self.add('signBar', hull_bm([tuple(p(y, z, .05)) for y in (-.42, .42) for z in (z0 + .08, z1 - .08)] + [tuple(p(y, z, .035)) for y in (-.42, .42) for z in (z0 + .08, z1 - .08)]), 'windowGlow', sign, emissive=True)

    def _text(self, body, size, token, origin, parent, face='front', emissive=False, extrude=.012, flip=False):
        curve = bpy.data.curves.new('t_' + body, 'FONT')
        curve.body = body
        curve.size = size
        curve.align_x = 'CENTER'
        curve.align_y = 'CENTER'
        curve.extrude = extrude
        curve.resolution_u = 3 if self.L == 0 else 1
        try:
            curve.font = bpy.data.fonts.load('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')
        except Exception:
            pass
        obj = bpy.data.objects.new('t_' + body, curve)
        bpy.context.scene.collection.objects.link(obj)
        if face == 'front':
            up = Vector((self.cap_slope, 0, 1)).normalized()
            right = Vector((0, 1, 0))
            nrm = right.cross(up)
        else:
            sy = 1 if face == 'left' else -1
            right = Vector((-sy, 0, 0))
            up = Vector((0, 0, 1))
            nrm = right.cross(up)
        m = Matrix((right, up, nrm)).transposed().to_4x4()
        m.translation = origin
        obj.matrix_world = m
        bpy.context.view_layer.objects.active = obj
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        obj.data.materials.append(self.mat(token, emissive))
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
        return obj

    def trim(self):
        L = self.L
        # blue belt stripe, 12 mm proud of the wall; separate pieces either side of the door
        for sy in (-1, 1):
            x1 = DOOR_X0 - .03 if sy > 0 else 4.0
            self.box('stripe', ((X_REAR + .35 + x1) / 2, sy * (HW + .012), 1.29), (x1 - X_REAR - .35, .024, .14), 'policeBlue')
            self.box('stripeLow', (-.25, sy * (HW + .012), .52), (5.0 if L < 2 else 5.0, .024, .06), 'policeBlue') if L < 2 else None
        if L < 1:
            for sy, face in ((1, 'left'), (-1, 'right')):
                self._text('EVAC', .46, 'blueTrim', Vector((.3, sy * (HW + .016), .83)), self.s.body, face=face, extrude=.02)
        # wheel arch lips
        if L < 2:
            for name, x, y in WHEELS:
                sy = 1 if y > 0 else -1
                pts = []
                n = [10, 6][L]
                for k in range(n + 1):
                    a = math.radians(-8 + 196 * k / n)
                    for r in (.60, .665):
                        for dy in (.012, .04):
                            pts.append((x + r * math.cos(a), sy * (HW + dy), .52 + r * math.sin(a)))
                self.add('archLip', loft_bm([[pts[k * 4 + 0], pts[k * 4 + 1], pts[k * 4 + 3], pts[k * 4 + 2]] for k in range(n + 1)]), 'uiDark')

    def fittings(self):
        L = self.L
        # bumpers
        self.box('bumperFront', (4.58, 0, .56), (.2, 2.32, .28), 'uiDark', r=.05)
        self.box('bumperRear', (-4.575, 0, .56), (.2, 2.32, .28), 'uiDark', r=.05)
        # grille, plate, headlight bezels and lenses
        self.box('grille', (X_FRONT + .012, 0, .93), (.04, .86, .38), 'uiDark', r=.015)
        if L < 2:
            for k in range(5):
                self.box('slat', (X_FRONT + .048, 0, .79 + k * .075), (.03, .78, .035), 'silver')
            self.box('plateF', (4.69, 0, .5), (.03, .46, .16), 'picketWhite')
        lights = self.s.joint('lightsFront')
        for sy in (-1, 1):
            if L < 2:
                self.box('bezel', (X_FRONT + .02, sy * .83, .93), (.05, .30, .22), 'silver', r=.02, seg=1)
            lens = self.box('lamp', (X_FRONT + .06, sy * .83, .93), (.05, .24, .16), 'windowGlow', r=.015, parent=lights, emissive=True)
        # the old anchor name and the emissive reference are kept
        self._light('lightsFront', (4.69, 0, .93), lights)
        brake = self.s.joint('lightsBrake')
        for sy in (-1, 1):
            if L < 2:
                self.box('tailBezel', (X_REAR - .015, sy * 1.0, .93), (.04, .22, .6), 'uiDark', r=.015)
            self.box('lamp', (X_REAR - .045, sy * 1.0, .93), (.04, .16, .52), 'sirenRed', r=.012, parent=brake, emissive=True)
        self._light('lightsBrake', (-4.65, 0, .93), brake)
        if L < 2:
            self.box('plateR', (X_REAR - .03, 0, .65), (.03, .46, .16), 'picketWhite')
            # engine louvres: dark recess panel with silver slats proud of it
            self.box('louvrePanel', (X_REAR - .012, 0, 1.12), (.024, .84, .46), 'uiDark', r=.01)
            for k in range(5 if L == 0 else 3):
                self.box('louvre', (X_REAR - .036, 0, .94 + k * (.09 if L == 0 else .15)), (.024, .76, .035), 'silver')
        # roof AC pod and vents
        self.box('acPod', (-.9, 0, 2.9825), (2.3, 1.25, .145), 'silver', r=.05, seg=2 if L == 0 else 1)
        if L < 2:
            self.box('ventA', (2.1, 0, 2.95), (.62, .62, .05), 'silver', r=.012)
            self.box('ventB', (-3.5, 0, 2.95), (.62, .62, .05), 'silver', r=.012)
            for k in range(4):
                for sy in (-1, 1):
                    self.box('acFin', (-.9 - .8 + k * .53, sy * .632, 2.9825), (.30, .018, .06), 'uiDark')
        # mirrors with brackets
        for sy in (-1, 1):
            if True:
                self.add('mirrorArm', hull_bm([(4.00 + dx, sy * (HW + dy), 1.88 + dz) for dx in (-.03, .03) for dy in (-.02, .20) for dz in (-.03, .03)]), 'uiDark')
            self.box('mirror', (4.04, sy * 1.43, 1.92), (.12, .09, .32), 'uiDark', r=.02)
            if L < 2:
                self.box('mirrorGlass', (4.108, sy * 1.43, 1.92), (.02, .075, .27), 'silver')
        # side marker lights, emissive-free amber caps stay body colour (no unreferenced emissives)

    def _light(self, name, pos, lamp_parent):
        s = self.s
        front = name == 'lightsFront'
        anchor = sockets.empty('light:' + name, pos, s.root)
        anchor.rotation_euler.y = -math.pi / 2 + .12 if front else math.pi / 2
        mat = 'emi_windowGlow' if front else 'emi_sirenRed'
        anchor['ss_light'] = json.dumps(dict(type='spot' if front else 'point', color='light_led_white' if front else 'light_siren_red',
                                             intensity=3 if front else .7, range=18 if front else 2, angle=48, penumbra=.35, pool=True,
                                             beam='soft' if front else 'none', flare=True, reflect=True, shadow='hero' if front else 'none',
                                             heroPriority=1, flicker='none', animation=None, powerGroup='self', breakable=True,
                                             emissiveNodes=[lamp_parent.children[0].name]))

    def wheels(self):
        L = self.L
        segs = [24, 14, 10][L]
        for name, x, y in WHEELS:
            sy = 1 if y > 0 else -1
            joint = self.s.joint(name, (x, y, .52))
            prof = [(.30, -.15), (.46, -.15), (.51, -.115), (.52, -.08), (.52, .08), (.51, .115), (.46, .15), (.30, .15)]
            if L == 1:
                prof = [(.30, -.15), (.50, -.13), (.52, -.07), (.52, .07), (.50, .13), (.30, .15)]
            if L == 2:
                prof = [(.30, -.15), (.52, -.12), (.52, .12), (.30, .15)]
            rings = []
            for k in range(segs):
                a = 2 * math.pi * k / segs
                rings.append([(r * math.cos(a), w * sy, r * math.sin(a)) for r, w in prof])
            bm = bmesh.new()
            vr = [[bm.verts.new(p) for p in ring] for ring in rings]
            n = len(prof)
            for k in range(segs):
                for i in range(n):
                    bm.faces.new((vr[k][i], vr[(k + 1) % segs][i], vr[(k + 1) % segs][(i + 1) % n], vr[k][(i + 1) % n]))
            self.add('tyre', bm, 'uiDark', joint)
            self.add('rim', cyl_bm((0, sy * .165, 0), .31, .03, 'y', segs), 'silver', joint)
            self.add('hubcap', cyl_bm((0, sy * .19, 0), .11, .02, 'y', max(segs // 2, 8)), 'uiDark', joint) if L < 2 else None
            if L == 0:
                for k in range(8):
                    a = 2 * math.pi * k / 8
                    self.add('lug', cyl_bm((.2 * math.cos(a), sy * .195, .2 * math.sin(a)), .028, .018, 'y', 8), 'silver', joint)

    def door(self):
        L = self.L
        joint = self.s.joint('doorR', (DOOR_X1, HW - .06, .58))
        w = DOOR_X1 - DOOR_X0 - .02
        # two folding leaves behind one hinge; local frame: hinge at origin, leaf extends towards -X
        for k in range(2):
            x0, x1 = -.01 - w * (k + 1) / 2, -.01 - w * k / 2
            xm = (x0 + x1) / 2
            self.add('doorLower', box_bm((xm, 0, .42), (x1 - x0 - .012, .05, .84)), 'picketWhite', joint)
            self.add('doorGlass', box_bm((xm, 0, 1.30), (x1 - x0 - .06, .014, .88)), None, joint, mat=self.glass())
            if L < 2:
                self.add('doorFrameT', box_bm((xm, 0, 2.34 - .58 - .02), (x1 - x0 - .012, .06, .06)), 'uiDark', joint)
                self.add('doorFrameM', box_bm((xm, 0, .87), (x1 - x0 - .012, .06, .05)), 'uiDark', joint)
        self.add('doorSeam', box_bm((-.01 - w / 2, 0, .42), (.025, .075, .80)), 'uiDark', joint)
        self.add('doorEdgeR', box_bm((-.012, 0, .864), (.024, .075, 1.752)), 'uiDark', joint)
        self.add('doorEdgeL', box_bm((-.01 - w + .002, 0, .864), (.024, .075, 1.752)), 'uiDark', joint)
        # steps and handrail inside the stair well
        self.box('step1', (3.62, .90, .56 + .15), (.70, .56, .30), 'asphalt')
        self.box('step2', (3.40, .86, .56 + .28), (.30, .48, .56), 'asphalt')
        if L < 2:
            for xx in (3.30, 4.00):
                self.add('stanchion', cyl_bm((xx, .66, 1.58), .022, 1.7, 'z', 8), 'silver')

    def interior(self):
        L = self.L
        if L == 2:
            return
        navy = 'blueTrim'
        rows = [(PILLARS[i] + PILLARS[i + 1]) / 2 for i in range(6)]
        for x in rows:
            for y in (-.94, -.48, .48, .94):
                self.box('seatCushion', (x, y, FLOOR + .26), (.46, .44, .26), navy, r=.025 if L == 0 else 0)
                self.box('seatBack', (x - .2, y, FLOOR + .66), (.09, .43, .64), navy, r=.025 if L == 0 else 0)
                if L == 0:
                    self.box('seatBase', (x + .03, y, FLOOR + .095), (.36, .30, .19), 'asphalt')
                    self.box('headrest', (x - .2, y, FLOOR + 1.04), (.10, .30, .12), 'silver', r=.02)
        # driver cab: seat, dash with steering wheel
        self.box('driverCushion', (3.50, -.62, FLOOR + .26), (.50, .50, .26), navy, r=.025 if L == 0 else 0)
        self.box('driverBack', (3.28, -.62, FLOOR + .70), (.10, .48, .72), navy, r=.025 if L == 0 else 0)
        self.box('dash', (4.22, 0, SILL + .06), (.30, 2.02, .12), 'asphalt', r=.02 if L == 0 else 0)
        if L == 0:
            self.box('dashPod', (4.1, -.62, SILL + .17), (.22, .56, .12), 'uiDark', r=.02)
            wheel = bmesh.new()
            col = Vector((3.86, -.62, 1.72))
            bmesh.ops.create_cone(wheel, cap_ends=True, segments=14, radius1=.19, radius2=.19, depth=.03,
                                  matrix=Matrix.Translation(col) @ Matrix.Rotation(math.radians(-62), 4, 'Y'))
            self.add('steeringRim', wheel, 'uiDark')
            self.add('steeringColumn', hull_bm([(4.08 + dx, -.62 + dy, SILL + .12 + dz) for dx in (-.02, .02) for dy in (-.02, .02) for dz in (0, .0)] + [(3.86 + dx, -.62 + dy, 1.7) for dx in (-.02, .02) for dy in (-.02, .02)]), 'uiDark')

    def sockets(self):
        s = self.s
        sockets.empty('driverSeat', (3.50, -.62, FLOOR + .52), s.root)
        s.protected.add('driverSeat')
        sockets.empty('steeringWheel', (3.86, -.62, 1.72), s.root)
        sockets.empty('exitL', (3.3, -1.8, .2), s.root)
        sockets.empty('exitR', (3.6, 1.8, .2), s.root)
        rows = [(PILLARS[i] + PILLARS[i + 1]) / 2 for i in range(6)]
        for i in range(12):
            sockets.empty('seat_' + str(i + 1), (rows[i // 2], (-1 if i % 2 else 1) * .48, FLOOR + .5), s.root)


def recipe(s):
    b = Bus(s)
    b.roof()
    b.lower_body()
    b.underbody()
    b.pillars()
    b.windshield()
    b.destination_sign()
    b.trim()
    b.fittings()
    b.wheels()
    b.door()
    b.interior()
    b.sockets()
    s.physics('heavy', 9000)
    colliders.cuboid('body', (9.2, 2.5, 3.05), (0, 0, 1.525), s.root)
    return s


def build_set(asset, directory):
    from pathlib import Path
    directory = Path(directory)
    stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        path = directory / ('model' + ('' if lod == 0 else '.lod' + str(lod)) + '.glb')
        stats['lod' + str(lod)] = finish(recipe(Scene(asset, lod)), path)
    (directory / 'lod-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    return stats
