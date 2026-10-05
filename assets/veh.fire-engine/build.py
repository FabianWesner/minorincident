"""Fire-engine pilot: adapted from the hand-built Blender study.
Palette materials, legacy dimensions, rigid part origins and deterministic export.
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector
from sslib import palette, pivots, sockets, colliders, export
ASSET = {'id': 'veh.fire-engine', 'category': 'vehicle'}

def build(ctx):
    PI = math.pi
    W = 1.25
    REAR_AXLE, FRONT_AXLE = -1.75, 2.89
    WHEEL_R, ARCH_R = .5, .66
    FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'
    def px(x_img):
        return -4.25 + (x_img - 105) / 1425 * 8.3
    TRUCK = bpy.data.collections.new('FireEngine')
    bpy.context.scene.collection.children.link(TRUCK)
    M = {key: palette.mat(token, emissive) for key, token, emissive in [
        ('red','survivorRed',False),('red_dark','blood',False),
        ('chrome','picketWhite',False),('alu','sidewalk',False),('alu_dark','asphalt',False),
        ('tread','sidewalk',False),('rim','picketWhite',False),('rubber','uiDark',False),
        ('black','uiDark',False),('glass','asphalt',False),('white','picketWhite',False),
        ('flame','schoolBusYellow',False),('amber','schoolBusYellow',True),
        ('lamp','sirenRed',True),('blue','policeBlue',True),('head','windowGlow',True),
        ('glow','windowGlow',True),('gauge','picketWhite',False)]}
    # --------------------------------------------------------------------------- object helpers
    GROUPS = {}


    def group(name, location=(0, 0, 0), parent=None):
        e = bpy.data.objects.new(name, None)
        e.empty_display_size = 0.3
        e.location = location
        TRUCK.objects.link(e)
        if parent:
            e.parent = GROUPS[parent]
            e.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
        bpy.context.view_layer.update()
        GROUPS[name] = e
        return e


    def finish(obj, mat, parent, bevel=0.0, segs=2, smooth=True, harden=True, angle=40):
        TRUCK.objects.link(obj)
        if isinstance(mat, str):
            mat = M[mat]
        if mat is not None and obj.type == 'MESH' and not obj.data.materials:
            obj.data.materials.append(mat)
        if obj.type == 'MESH':
            for p in obj.data.polygons:
                p.use_smooth = smooth
        if bevel > 0:
            b = obj.modifiers.new('bevel', 'BEVEL')
            b.width = bevel
            b.segments = segs
            b.limit_method = 'ANGLE'
            b.angle_limit = math.radians(angle)
            b.harden_normals = harden
            b.miter_outer = 'MITER_ARC'
        if smooth and obj.type == 'MESH':
            wn = obj.modifiers.new('weighted', 'WEIGHTED_NORMAL')
            wn.keep_sharp = True
        if parent:
            bpy.context.view_layer.update()
            obj.parent = GROUPS[parent]
            obj.matrix_parent_inverse = GROUPS[parent].matrix_world.inverted()
        return obj


    def from_bm(name, bm):
        me = bpy.data.meshes.new(name)
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        return bpy.data.objects.new(name, me)


    def box(name, center, size, mat, parent=None, bevel=0.02, segs=1, rot=(0, 0, 0)):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        o = from_bm(name, bm)
        o.location = center
        o.rotation_euler = rot
        return finish(o, mat, parent, bevel=min(bevel, min(size) * 0.45), segs=segs)


    def prism(name, pts_xz, y0, y1, mat, parent=None, bevel=0.03, segs=2):
        """2D side silhouette (x, z) extruded across y0..y1."""
        bm = bmesh.new()
        vs = [bm.verts.new((x, y0, z)) for x, z in pts_xz]
        f = bm.faces.new(vs)
        ext = bmesh.ops.extrude_face_region(bm, geom=[f])
        moved = [v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, y1 - y0, 0), verts=moved)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = from_bm(name, bm)
        return finish(o, mat, parent, bevel=bevel, segs=segs)


    def plate(name, pts_xz, side, depth, mat, parent=None, y_skin=W, bevel=0.006, segs=2, lift=0.0):
        """Flat shape lying on a side skin. side=-1 near (-Y), +1 far (+Y). pts in world (x, z)."""
        y0 = side * (y_skin + lift)
        y1 = side * (y_skin + lift + depth)
        return prism(name, pts_xz, min(y0, y1), max(y0, y1), mat, parent, bevel, segs)


    def ring(name, outer, inner, side, depth, mat, parent=None, y_skin=W, bevel=0.005, lift=0.0):
        """Frame between two loops with equal vertex count, on a side skin."""
        bm = bmesh.new()
        y0 = side * (y_skin + lift)
        y1 = side * (y_skin + lift + depth)
        n = len(outer)
        layers = []
        for y in (y0, y1):
            o = [bm.verts.new((x, y, z)) for x, z in outer]
            i = [bm.verts.new((x, y, z)) for x, z in inner]
            layers.append((o, i))
        for (o, i) in layers:
            for k in range(n):
                bm.faces.new((o[k], o[(k + 1) % n], i[(k + 1) % n], i[k]))
        (o0, i0), (o1, i1) = layers
        for k in range(n):
            bm.faces.new((o0[k], o1[k], o1[(k + 1) % n], o0[(k + 1) % n]))
            bm.faces.new((i0[k], i0[(k + 1) % n], i1[(k + 1) % n], i1[k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return finish(from_bm(name, bm), mat, parent, bevel=bevel, segs=2)


    def lathe(name, profile, center, axis, mat, parent=None, segs=28, smooth=True):
        """Surface of revolution: profile [(radius, along_axis)], revolved about `axis` ('x','y','z' with sign)."""
        bm = bmesh.new()
        rings = []
        for r, a in profile:
            loop = []
            for k in range(segs):
                t = 2 * PI * k / segs
                loop.append(bm.verts.new((r * math.cos(t), r * math.sin(t), a)))
            rings.append(loop)
        for j in range(len(rings) - 1):
            for k in range(segs):
                a0, a1 = rings[j][k], rings[j][(k + 1) % segs]
                b0, b1 = rings[j + 1][k], rings[j + 1][(k + 1) % segs]
                try:
                    bm.faces.new((a0, a1, b1, b0))
                except ValueError:
                    pass
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        sign = -1 if axis.startswith('-') else 1
        ax = axis[-1]
        rot = {'z': Matrix.Identity(4), 'y': Matrix.Rotation(-PI / 2, 4, 'X'), 'x': Matrix.Rotation(PI / 2, 4, 'Y')}[ax]
        if sign < 0:
            rot = rot @ Matrix.Rotation(PI, 4, 'X')
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
        o = from_bm(name, bm)
        o.location = center
        return finish(o, mat, parent, smooth=smooth, harden=False)


    def cylinder(name, center, r, depth, axis, mat, parent=None, segs=20, bevel=0.0):
        prof = [(1e-4, -depth / 2), (r, -depth / 2), (r, depth / 2), (1e-4, depth / 2)]
        o = lathe(name, prof, center, axis, mat, parent, segs)
        if bevel:
            b = o.modifiers.new('bevel', 'BEVEL')
            b.width = bevel
            b.segments = 2
            b.limit_method = 'ANGLE'
            o.modifiers.move(len(o.modifiers) - 1, 0)
        return o


    def text(name, body, size, center, facing, mat, parent=None, depth=0.008, font=FONT, spacing=1.0, stretch=1.0):
        """facing: '-y' near side, '+y' far side, '+x' front face, '-x' rear face."""
        cu = bpy.data.curves.new(name, 'FONT')
        cu.body = body
        cu.font = bpy.data.fonts.load(font, check_existing=True)
        cu.size = size
        cu.extrude = depth / 2
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        cu.space_character = spacing
        cu.resolution_u = 6
        o = bpy.data.objects.new(name, cu)
        o.location = center
        o.scale = (stretch, 1, 1)
        o.rotation_euler = {'-y': (PI / 2, 0, 0), '+y': (PI / 2, 0, PI), '+x': (PI / 2, 0, PI / 2), '-x': (PI / 2, 0, -PI / 2)}[facing]
        TRUCK.objects.link(o)
        o.data.materials.append(M[mat] if isinstance(mat, str) else mat)
        bpy.context.view_layer.objects.active = o
        for ob in bpy.context.view_layer.objects:
            ob.select_set(False)
        o.select_set(True)
        bpy.ops.object.convert(target='MESH')
        o = bpy.context.view_layer.objects.active
        TRUCK.objects.unlink(o)
        if parent:
            o.parent = None
        return finish(o, None, parent, smooth=False)


    def cut(target, cutter_obj, mat=None):
        """Exact boolean difference, applied immediately; the cutter's material lines the cut."""
        if mat is not None:
            cutter_obj.data.materials.clear()
            cutter_obj.data.materials.append(M[mat])
            if M[mat].name not in [m.name for m in target.data.materials]:
                target.data.materials.append(M[mat])
        mod = target.modifiers.new('cut', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = cutter_obj
        mod.material_mode = 'TRANSFER'
        target.modifiers.move(len(target.modifiers) - 1, 0)
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter_obj)


    def raw_cyl(name, center, r, depth, axis='y', segs=24):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)
        rot = {'y': Matrix.Rotation(PI / 2, 4, 'X'), 'x': Matrix.Rotation(PI / 2, 4, 'Y'), 'z': Matrix.Identity(4)}[axis]
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
        o = from_bm(name, bm)
        o.location = center
        bpy.context.scene.collection.objects.link(o)
        return o


    def raw_box(name, center, size):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
        o = from_bm(name, bm)
        o.location = center
        bpy.context.scene.collection.objects.link(o)
        return o


    def arc(cx, cz, r, a0, a1, n):
        return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


    def rrect(x0, z0, x1, z1, r, n=5):
        pts = []
        pts += arc(x1 - r, z0 + r, r, -PI / 2, 0, n)
        pts += arc(x1 - r, z1 - r, r, 0, PI / 2, n)
        pts += arc(x0 + r, z1 - r, r, PI / 2, PI, n)
        pts += arc(x0 + r, z0 + r, r, PI, 1.5 * PI, n)
        return pts


    def frame(name, x0, z0, x1, z1, side, mat, parent, bar=0.04, r=0.04, depth=0.03, lift=0.0, y_skin=W):
        ring(name, rrect(x0 - bar, z0 - bar, x1 + bar, z1 + bar, r + bar * 0.6), rrect(x0, z0, x1, z1, r), side, depth, mat, parent, y_skin, lift=lift)


    def shutter(name, x0, x1, z0, z1, side, parent, y_skin=W, slat=0.072, mat='alu'):
        """Roller shutter: one rounded slat + array modifier (stays a single light mesh)."""
        n = max(2, round((z1 - z0) / slat))
        h = (z1 - z0) / n
        y = side * (y_skin + 0.012)
        o = box(name, ((x0 + x1) / 2, y, z0 + h / 2), (x1 - x0, 0.024, h * 0.94), mat, parent, bevel=h * 0.45, segs=2)
        arr = o.modifiers.new('slats', 'ARRAY')
        arr.use_relative_offset = False
        arr.use_constant_offset = True
        arr.constant_offset_displace = (0, 0, h)
        arr.count = n
        o.modifiers.move(len(o.modifiers) - 1, 0)
        return o


    SIDES = [(-1, 'near'), (1, 'far')]

    # =========================================================================== CHASSIS + BODY SHELLS
    group('fire_engine')
    group('chassis', parent='fire_engine')
    box('chassis_frame', (-0.1, 0, 0.62), (8.0, 1.5, 0.26), 'black', 'chassis', bevel=0.03)
    box('rear_bumper', (px(105) - 0.1, 0, 0.36), (0.26, 2.52, 0.22), 'chrome', 'chassis', bevel=0.05)
    box('rear_step', (px(105) - 0.04, 0, 0.5), (0.3, 1.6, 0.05), 'tread', 'chassis', bevel=0.01)

    # --- rear compartment (tallest block at the tail)
    group('rear_compartment', parent='fire_engine')
    rc = box('rear_compartment_shell', ((px(105) + px(292)) / 2, 0, 1.68), (px(292) - px(105), 2 * W, 2.64), 'red', 'rear_compartment', bevel=0.07, segs=2)

    # --- pump bay: recessed aluminium panel with a black tank above
    group('pump_bay', parent='fire_engine')
    pb_x0, pb_x1 = px(292), px(412)
    box('pump_bay_core', ((pb_x0 + pb_x1) / 2, 0, 1.6), (pb_x1 - pb_x0, 2 * W - 0.24, 2.5), 'alu_dark', 'pump_bay', bevel=0.02)
    box('pump_bay_tank', ((pb_x0 + pb_x1) / 2, 0, 2.5), (pb_x1 - pb_x0 + 0.02, 2 * W - 0.16, 0.9), 'black', 'pump_bay', bevel=0.08, segs=2)

    # --- main equipment body with rear wheel arch
    group('equipment_body', parent='fire_engine')
    mb_x0, mb_x1 = px(412), px(912)
    body = box('equipment_body_shell', ((mb_x0 + mb_x1) / 2, 0, (0.34 + 2.72) / 2), (mb_x1 - mb_x0, 2 * W, 2.38), 'red', 'equipment_body', bevel=0.05, segs=2)
    cut(body, raw_cyl('arch_cut_rear', (REAR_AXLE, 0, WHEEL_R), ARCH_R, 3.0), 'black')

    # --- aluminium shutter housing
    group('shutter_housing', parent='fire_engine')
    sh_x0, sh_x1 = px(912), px(1156)
    box('shutter_housing_shell', ((sh_x0 + sh_x1) / 2, 0, 1.55), (sh_x1 - sh_x0, 2 * W + 0.06, 2.46), 'alu', 'shutter_housing', bevel=0.04, segs=2)

    # --- crew cab: raked windscreen, rounded roof nose, front wheel arch
    group('crew_cab', parent='fire_engine')
    cx0, cx1 = px(1158), 4.05
    cab_pts = [(cx0, 0.42), (cx1, 0.42), (cx1, 1.86), (3.83, 2.62)] + arc(3.63, 2.66, 0.2, -0.2, PI / 2, 8)[1:] + [(cx0, 2.86)]
    cab = prism('crew_cab_shell', cab_pts, -W, W, 'red', 'crew_cab', bevel=0.09, segs=2)
    cut(cab, raw_cyl('arch_cut_front', (FRONT_AXLE, 0, WHEEL_R), ARCH_R, 3.0), 'black')
    # window/door recesses would need booleans per door; seams are raised strips instead.

    # =========================================================================== WHEELS
    TYRE = [(0.30, -0.21), (0.40, -0.215), (0.455, -0.205), (0.49, -0.17), (0.5, -0.11), (0.503, 0.0), (0.5, 0.11), (0.49, 0.17),
            (0.455, 0.205), (0.40, 0.215), (0.30, 0.21)]
    RIM = [(1e-4, 0.13), (0.075, 0.13), (0.11, 0.105), (0.19, 0.095), (0.25, 0.115), (0.29, 0.15), (0.315, 0.19), (0.33, 0.2), (0.34, 0.17), (0.335, -0.19), (1e-4, -0.19)]
    HUB = [(1e-4, 0.235), (0.045, 0.232), (0.07, 0.21), (0.08, 0.17), (0.08, 0.13), (1e-4, 0.13)]
    for ax, axle in [(REAR_AXLE, 'rear'), (FRONT_AXLE, 'front')]:
        for side, sname in SIDES:
            g = f'wheel_{axle}_{sname}'
            group(g, (ax, side * 1.0, WHEEL_R), parent='chassis')
            out = '-y' if side < 0 else 'y'
            c = (ax, side * 1.0, WHEEL_R)
            lathe(f'{g}_tyre', TYRE, c, out, 'rubber', g, segs=24)
            # tread blocks around the crown
            for k in range(40):
                t = 2 * PI * k / 40
                o = box(f'{g}_tread_{k}', (ax + 0.5 * math.cos(t), side * 1.0, WHEEL_R + 0.5 * math.sin(t)), (0.06, 0.34, 0.045), 'rubber', g, bevel=0.01, segs=1, rot=(0, -t, 0))
            lathe(f'{g}_rim', RIM, c, out, 'rim', g, segs=24)
            lathe(f'{g}_hub', HUB, c, out, 'red', g, segs=22)
            for k in range(8):
                t = 2 * PI * k / 8
                lathe(f'{g}_lug_{k}', [(1e-4, 0.15), (0.022, 0.15), (0.022, 0.1)], (ax + 0.155 * math.cos(t), side * 1.0, WHEEL_R + 0.155 * math.sin(t)), out, 'chrome', g, segs=6, smooth=False)
            lathe(f'{g}_hub_ring', [(0.09, 0.115), (0.12, 0.13), (0.135, 0.12), (0.135, 0.1)], c, out, 'chrome', g, segs=20)

    # =========================================================================== SIDE DETAIL (both sides)
    for side, sname in SIDES:
        fy = side * W
        # wheel-arch chrome trims: half-annulus bands proud of the skin
        for ax, nm, par in [(REAR_AXLE, 'rear', 'equipment_body'), (FRONT_AXLE, 'front', 'crew_cab')]:
            outer = arc(ax, WHEEL_R, ARCH_R + 0.08, 0, PI, 32)
            inner = arc(ax, WHEEL_R, ARCH_R, PI, 0, 32)
            plate(f'arch_trim_{nm}_{sname}', outer + inner, side, 0.035, 'chrome', par, bevel=0.012)

        # ---------------- rear compartment door
        x0, x1 = px(130), px(268)
        plate(f'rear_door_{sname}', rrect(x0, 0.6, x1, 2.64, 0.04), side, 0.018, 'red', 'rear_compartment')
        frame(f'rear_door_frame_{sname}', x0, 0.6, x1, 2.64, side, 'chrome', 'rear_compartment', bar=0.035)
        for i, (za, zb) in enumerate([(2.27, 2.45), (0.74, 0.9)]):
            plate(f'rear_door_band_{i}_{sname}', [(x0 + 0.03, za), (x1 - 0.03, za), (x1 - 0.03, zb), (x0 + 0.03, zb)], side, 0.006, 'white', 'rear_compartment', lift=0.018)
        for i, xx in enumerate([x0 + 0.1, x1 - 0.1]):
            box(f'rear_door_handle_{i}_{sname}', (xx, fy + side * 0.05, 1.6), (0.045, 0.04, 0.2), 'chrome', 'rear_compartment', bevel=0.015)
        box(f'rear_top_lamp_{sname}', (px(150), fy + side * 0.02, 2.78), (0.18, 0.04, 0.09), 'lamp', 'rear_compartment', bevel=0.01)
        box(f'rear_side_marker_{sname}', (px(110), fy + side * 0.02, 1.05), (0.06, 0.04, 0.24), 'amber', 'rear_compartment', bevel=0.01)
        box(f'rear_kick_{sname}', ((x0 + x1) / 2, fy + side * 0.01, 0.42), (px(292) - px(105) - 0.06, 0.03, 0.12), 'tread', 'rear_compartment', bevel=0.008)

        # ---------------- pump bay controls
        zp = W - 0.12
        pb_c = (pb_x0 + pb_x1) / 2
        for i, (gx, gz, r) in enumerate([(px(342), 2.0, 0.085), (px(380), 1.72, 0.06), (px(330), 1.32, 0.065), (px(368), 0.98, 0.05)]):
            lathe(f'pump_gauge_{i}_{sname}', [(1e-4, 0.035), (r * 0.82, 0.035), (r, 0.025), (r, 0.0)], (gx, side * zp, gz), '-y' if side < 0 else 'y', 'chrome', 'pump_bay', segs=28)
            lathe(f'pump_gauge_face_{i}_{sname}', [(1e-4, 0.04), (r * 0.74, 0.04)], (gx, side * zp, gz), '-y' if side < 0 else 'y', 'gauge', 'pump_bay', segs=28)
        lathe(f'pump_valve_{sname}', [(1e-4, 0.14), (0.04, 0.14), (0.06, 0.1), (0.1, 0.07), (0.12, 0.03), (0.12, 0.0)], (px(372), side * zp, 1.52), '-y' if side < 0 else 'y', 'red', 'pump_bay', segs=22)
        # hose coil: a torus from a circle profile
        coil = bpy.data.objects.new(f'pump_hose_{sname}', bpy.data.meshes.new(f'pump_hose_{sname}'))
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=False, segments=16, radius=0.035)
        bmesh.ops.translate(bm, vec=(0.15, 0, 0), verts=bm.verts)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(PI / 2, 3, 'X'), verts=bm.verts)
        bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * PI, steps=48, use_duplicate=False)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.to_mesh(coil.data)
        bm.free()
        coil.location = (px(388), side * (zp + 0.06), 1.4)
        coil.rotation_euler = (PI / 2, 0, 0)
        finish(coil, 'black', 'pump_bay', smooth=True, harden=False)
        box(f'pump_bay_step_{sname}', (pb_c, side * (zp + 0.08), 0.44), (pb_x1 - pb_x0, 0.24, 0.07), 'tread', 'pump_bay', bevel=0.01)
        for i, z in enumerate([0.75, 1.15]):
            box(f'pump_bay_rail_{i}_{sname}', (pb_c, side * (zp + 0.05), z), (pb_x1 - pb_x0 - 0.1, 0.03, 0.03), 'chrome', 'pump_bay', bevel=0.01)

        # ---------------- main body: two hinged doors, lower door, FIRE livery
        for i, (x0, x1) in enumerate([(px(425), px(565)), (px(570), px(712))]):
            plate(f'body_door_{i}_{sname}', rrect(x0, 1.42, x1, 2.6, 0.04), side, 0.016, 'red', 'equipment_body')
            frame(f'body_door_frame_{i}_{sname}', x0, 1.42, x1, 2.6, side, 'chrome', 'equipment_body', bar=0.028)
            hx = x1 - 0.12 if i == 0 else x0 + 0.12
            box(f'body_door_handle_{i}_{sname}', (hx, fy + side * 0.045, 1.6), (0.045, 0.035, 0.15), 'chrome', 'equipment_body', bevel=0.012)
        plate(f'lower_door_{sname}', rrect(px(612), 0.5, px(728), 1.34, 0.04), side, 0.016, 'red', 'equipment_body')
        frame(f'lower_door_frame_{sname}', px(612), 0.5, px(728), 1.34, side, 'chrome', 'equipment_body', bar=0.028)
        box(f'lower_door_handle_{sname}', (px(700), fy + side * 0.045, 1.18), (0.045, 0.035, 0.12), 'chrome', 'equipment_body', bevel=0.012)
        sx0, sx1 = px(428), px(708)
        plate(f'livery_stripe_{sname}', [(sx0, 1.5), (sx1, 1.5), (sx1, 1.57), (sx1 - 0.3, 1.66), (sx0, 1.62)], side, 0.005, 'white', 'equipment_body', lift=0.016)
        plate(f'livery_lower_{sname}', [(px(616), 0.62), (px(724), 0.62), (px(724), 0.74), (px(616), 0.74)], side, 0.005, 'white', 'equipment_body', lift=0.016)
        text(f'fire_text_{sname}', 'FIRE', 0.4, ((px(432) + px(600)) / 2, fy + side * 0.022, 1.86), '-y' if side < 0 else '+y', 'white', 'equipment_body', spacing=1.05, stretch=1.45)
        box(f'body_roof_trim_{sname}', ((mb_x0 + mb_x1) / 2, fy + side * 0.01, 2.68), (mb_x1 - mb_x0, 0.04, 0.06), 'chrome', 'equipment_body', bevel=0.012)
        box(f'body_sill_{sname}', ((px(612) + mb_x1) / 2, fy + side * 0.02, 0.38), (mb_x1 - px(612), 0.06, 0.09), 'chrome', 'equipment_body', bevel=0.02)
        box(f'body_sill_rear_{sname}', ((mb_x0 + REAR_AXLE - ARCH_R) / 2, fy + side * 0.02, 0.38), (REAR_AXLE - ARCH_R - mb_x0, 0.06, 0.09), 'chrome', 'equipment_body', bevel=0.02)
        for i, (x, z) in enumerate([(px(437), 1.22), (px(612), 1.0)]):
            lathe(f'body_reflector_{i}_{sname}', [(1e-4, 0.03), (0.04, 0.03), (0.05, 0.0)], (x, fy, z), '-y' if side < 0 else 'y', 'amber', 'equipment_body', segs=20)

        # tall roller-shutter compartment with glowing step strip
        x0, x1 = px(752), px(866)
        shutter(f'tall_shutter_{sname}', x0, x1, 0.86, 2.54, side, 'equipment_body')
        frame(f'tall_shutter_frame_{sname}', x0, 0.62, x1, 2.56, side, 'chrome', 'equipment_body', bar=0.04, r=0.015, depth=0.04)
        plate(f'tall_shutter_glow_{sname}', [(x0, 0.64), (x1, 0.64), (x1, 0.84), (x0, 0.84)], side, 0.02, 'glow', 'equipment_body')
        box(f'tall_shutter_bar_{sname}', ((x0 + x1) / 2, fy + side * 0.05, 0.92), (x1 - x0 - 0.12, 0.035, 0.045), 'chrome', 'equipment_body', bevel=0.015)
        box(f'tall_shutter_post_{sname}', (px(890), fy + side * 0.01, 1.6), (0.05, 0.03, 1.9), 'red_dark', 'equipment_body', bevel=0.01)

        # ---------------- shutter housing: big shutter + pump panel with couplings
        ys = W + 0.03
        x0, x1 = px(932), px(1128)
        shutter(f'main_shutter_{sname}', x0, x1, 1.38, 2.56, side, 'shutter_housing', y_skin=ys)
        for i, gx in enumerate([x0 + 0.07, x1 - 0.07]):
            box(f'main_shutter_rail_{i}_{sname}', (gx, side * (ys + 0.05), 1.95), (0.045, 0.035, 1.3), 'chrome', 'shutter_housing', bevel=0.015)
        box(f'main_shutter_bar_{sname}', ((x0 + x1) / 2, side * (ys + 0.05), 1.45), (x1 - x0 - 0.2, 0.035, 0.05), 'chrome', 'shutter_housing', bevel=0.015)
        box(f'main_shutter_lip_{sname}', ((x0 + x1) / 2, side * (ys + 0.02), 2.64), (x1 - x0 + 0.08, 0.05, 0.1), 'alu_dark', 'shutter_housing', bevel=0.02)
        box(f'pump_panel_{sname}', ((sh_x0 + sh_x1) / 2, side * (ys + 0.005), 0.76), (sh_x1 - sh_x0 - 0.06, 0.03, 0.8), 'tread', 'shutter_housing', bevel=0.02)
        box(f'pump_panel_ledge_{sname}', ((sh_x0 + sh_x1) / 2, side * (ys + 0.03), 1.2), (sh_x1 - sh_x0, 0.08, 0.07), 'chrome', 'shutter_housing', bevel=0.02)
        out = '-y' if side < 0 else 'y'
        COUP = [(1e-4, 0.15), (0.05, 0.15), (0.075, 0.13), (0.12, 0.115), (0.15, 0.085), (0.17, 0.06), (0.18, 0.02), (0.18, 0.0)]
        for i, (cxp, s) in enumerate([(px(1012), 1.0), (px(1090), 0.92)]):
            cc = (cxp, side * (ys + 0.02), 0.75)
            lathe(f'coupling_{i}_{sname}', [(r * s, a) for r, a in COUP], cc, out, 'red', 'shutter_housing', segs=28)
            lathe(f'coupling_cap_{i}_{sname}', [(1e-4, 0.2), (0.04, 0.2), (0.06, 0.18), (0.07, 0.15)], cc, out, 'chrome', 'shutter_housing', segs=6, smooth=False)
            lathe(f'coupling_ring_{i}_{sname}', [(0.17 * s, 0.07), (0.2 * s, 0.065), (0.205 * s, 0.03), (0.19 * s, 0.0)], cc, out, 'chrome', 'shutter_housing', segs=28)
        lathe(f'coupling_small_{sname}', [(r * 0.45, a * 0.8) for r, a in COUP], (px(955), side * (ys + 0.02), 0.62), out, 'red', 'shutter_housing', segs=22)
        lathe(f'pump_fan_{sname}', [(1e-4, 0.05), (0.09, 0.05), (0.105, 0.0)], (px(962), side * (ys + 0.02), 0.98), out, 'chrome', 'shutter_housing', segs=22)
        box(f'housing_kick_{sname}', ((sh_x0 + sh_x1) / 2, side * (ys + 0.02), 0.33), (sh_x1 - sh_x0, 0.05, 0.1), 'tread', 'shutter_housing', bevel=0.012)

        # ---------------- cab sides: windows, door seams, handles, lettering, emblem, mirror, step
        for i, (x0, z0, x1, z1) in enumerate([(px(1215), 1.98, px(1315), 2.62), (px(1378), 1.96, 3.76, 2.62)]):
            plate(f'cab_window_{i}_{sname}', rrect(x0, z0, x1, z1, 0.06), side, 0.012, 'glass', 'crew_cab', bevel=0.004)
            frame(f'cab_window_frame_{i}_{sname}', x0, z0, x1, z1, side, 'black', 'crew_cab', bar=0.03, r=0.06, depth=0.016)
        for i, (x0, x1) in enumerate([(px(1180), px(1352)), (px(1356), px(1525))]):
            ring(f'cab_door_seam_{i}_{sname}', rrect(x0, 0.95, x1, 2.72, 0.07), rrect(x0 + 0.014, 0.964, x1 - 0.014, 2.706, 0.06), side, 0.003, 'red_dark', 'crew_cab', bevel=0.0)
            box(f'cab_door_handle_{i}_{sname}', (x1 - 0.13, fy + side * 0.035, 1.66), (0.17, 0.04, 0.05), 'chrome', 'crew_cab', bevel=0.015)
        text(f'cab_text_{sname}', 'FIRE DEPT.', 0.26, ((px(1195) + px(1330)) / 2, fy + side * 0.006, 1.52), '-y' if side < 0 else '+y', 'white', 'crew_cab', spacing=1.02)
        fx, fz, fs = (px(1408) + px(1482)) / 2, 1.27, 0.22
        flame = [(fx + fs * u, fz + fs * v) for u, v in [(0, -1), (0.55, -0.88), (0.9, -0.45), (0.98, 0.1), (0.75, 0.55), (0.6, 0.32), (0.48, 0.88), (0.18, 0.58), (0.04, 1.18), (-0.22, 0.62), (-0.46, 0.9), (-0.56, 0.36), (-0.78, 0.52), (-0.97, 0.06), (-0.92, -0.46), (-0.56, -0.88)]]
        if side > 0:
            flame = [(2 * fx - x, z) for x, z in flame]
        plate(f'flame_emblem_{sname}', flame, side, 0.008, 'flame', 'crew_cab', bevel=0.003)
        drop = [(fx + fs * u, fz + fs * v) for u, v in [(0, -0.62), (0.32, -0.52), (0.42, -0.2), (0.26, 0.16), (0, 0.55), (-0.26, 0.16), (-0.42, -0.2), (-0.32, -0.52)]]
        plate(f'flame_drop_{sname}', drop, side, 0.006, 'lamp', 'crew_cab', bevel=0.002, lift=0.008)
        box(f'cab_step_{sname}', (px(1180) + 0.28, side * (W + 0.1), 0.42), (0.52, 0.24, 0.06), 'tread', 'crew_cab', bevel=0.012)
        box(f'cab_sill_{sname}', ((cx0 + FRONT_AXLE - ARCH_R) / 2, fy + side * 0.02, 0.5), (FRONT_AXLE - ARCH_R - cx0, 0.05, 0.1), 'chrome', 'crew_cab', bevel=0.02)
        box(f'mirror_arm_{sname}', (3.8, side * (W + 0.17), 2.2), (0.04, 0.34, 0.04), 'chrome', 'crew_cab', bevel=0.012)
        box(f'mirror_arm_low_{sname}', (3.8, side * (W + 0.17), 1.8), (0.04, 0.34, 0.04), 'chrome', 'crew_cab', bevel=0.012)
        box(f'mirror_{sname}', (3.77, side * (W + 0.36), 2.0), (0.1, 0.22, 0.62), 'black', 'crew_cab', bevel=0.04)
        box(f'mirror_glass_{sname}', (3.715, side * (W + 0.36), 2.0), (0.01, 0.17, 0.55), 'glass', 'crew_cab', bevel=0.004)
        box(f'cab_marker_{sname}', (3.97, fy + side * 0.01, 0.95), (0.12, 0.03, 0.1), 'amber', 'crew_cab', bevel=0.01)
        for i, x in enumerate([px(300), px(718), px(1150), px(1535) - 0.12]):
            box(f'side_marker_{i}_{sname}', (x, fy + side * 0.03, 0.44), (0.12, 0.03, 0.08), 'amber', 'chassis', bevel=0.012)

    # =========================================================================== ROOF LADDER
    group('ladder', (0, 0, 2.9), parent='fire_engine')
    LZ = 3.02
    for i, x in enumerate([px(470), px(985)]):
        for side, sname in SIDES:
            box(f'ladder_post_{i}_{sname}', (x, side * 0.74, (2.72 + LZ) / 2), (0.08, 0.08, LZ - 2.72), 'alu', 'ladder', bevel=0.012)
    SECTIONS = [(px(435), px(1005), LZ + 0.05, 0.26, 0.74), (px(620), px(1462), LZ + 0.2, 0.3, 0.6)]
    for s, (xa, xb, zl, h, yw) in enumerate(SECTIONS):
        for side, sname in SIDES:
            for lvl, zz in enumerate([zl, zl + h]):
                box(f'ladder{s}_rail_{lvl}_{sname}', ((xa + xb) / 2, side * yw, zz), (xb - xa, 0.06, 0.075), 'alu', 'ladder', bevel=0.012)
            n = max(4, round((xb - xa) / 0.5))
            for k in range(n + 1):
                x = xa + (xb - xa) * k / n
                box(f'ladder{s}_upright_{k}_{sname}', (x, side * yw, zl + h / 2), (0.05, 0.045, h), 'alu', 'ladder', bevel=0.01)
                box(f'ladder{s}_bolt_{k}_{sname}', (x, side * (yw + 0.03), zl + h), (0.03, 0.02, 0.03), 'alu_dark', 'ladder', bevel=0.006)
        n = max(4, round((xb - xa) / 0.25))
        rung = cylinder(f'ladder{s}_rungs', (xa + (xb - xa) / n, 0, zl), 0.022, 2 * yw, 'y', 'chrome', 'ladder', segs=16)
        arr = rung.modifiers.new('rungs', 'ARRAY')
        arr.use_relative_offset = False
        arr.use_constant_offset = True
        arr.constant_offset_displace = ((xb - xa) / n, 0, 0)
        arr.count = n - 1
        rung.modifiers.move(len(rung.modifiers) - 1, 0)
    # turntable gantry over the shutter housing
    gx0, gx1 = px(1022), px(1268)
    lathe('ladder_turntable', [(1e-4, 0.12), (0.34, 0.12), (0.38, 0.06), (0.38, 0.0), (1e-4, 0.0)], ((gx0 + gx1) / 2, 0, LZ - 0.06), 'z', 'red_dark', 'ladder', segs=28)
    for side, sname in SIDES:
        for i, x in enumerate([gx0, gx1]):
            box(f'gantry_post_{i}_{sname}', (x, side * 0.62, LZ + 0.42), (0.09, 0.09, 0.5), 'alu', 'ladder', bevel=0.015)
        box(f'gantry_top_{sname}', ((gx0 + gx1) / 2, side * 0.62, LZ + 0.68), (gx1 - gx0 + 0.09, 0.09, 0.08), 'alu', 'ladder', bevel=0.015)
        box(f'ladder_nose_support_{sname}', (px(1445), side * 0.6, 3.04), (0.09, 0.08, 0.36), 'alu', 'ladder', bevel=0.012)
    box('gantry_cross', ((gx0 + gx1) / 2, 0, LZ + 0.68), (0.09, 1.33, 0.08), 'alu', 'ladder', bevel=0.015)
    for i, x in enumerate([gx0, gx1]):
        box(f'gantry_base_{i}', (x, 0, LZ + 0.18), (0.12, 1.32, 0.08), 'alu', 'ladder', bevel=0.015)
    box('gantry_motor', ((gx0 + gx1) / 2, 0, LZ + 0.3), (0.6, 0.5, 0.26), 'alu_dark', 'ladder', bevel=0.04)
    box('ladder_tip', (px(1462) + 0.06, 0, LZ + 0.35), (0.1, 1.24, 0.1), 'red', 'ladder', bevel=0.03)
    box('ladder_tip_lamp', (px(1462) + 0.12, 0, LZ + 0.35), (0.04, 0.2, 0.06), 'amber', 'ladder', bevel=0.01)

    # =========================================================================== ROOF EQUIPMENT + LIGHTS
    box('roof_hose_box', (px(205), -0.3, 3.08), (0.7, 0.6, 0.16), 'black', 'rear_compartment', bevel=0.04)
    for i, y in enumerate([0.25, 0.75]):
        box(f'roof_grab_rail_{i}', (px(205), y, 3.16), (0.55, 0.04, 0.04), 'chrome', 'rear_compartment', bevel=0.015)
        for j, dx in enumerate([-0.24, 0.24]):
            box(f'roof_grab_post_{i}_{j}', (px(205) + dx, y, 3.07), (0.04, 0.04, 0.16), 'chrome', 'rear_compartment', bevel=0.012)
    for i, y in enumerate([-0.92, 0.92]):
        lathe(f'rear_beacon_{i}', [(1e-4, 0.15), (0.06, 0.14), (0.085, 0.07), (0.085, 0.0)], (px(135), y, 3.0), 'z', 'lamp', 'rear_compartment', segs=24)
    box('lightbar_base', (3.42, 0, 2.9), (0.42, 2.15, 0.08), 'black', 'crew_cab', bevel=0.03)
    for i, (y, mt) in enumerate([(-0.88, 'lamp'), (-0.53, 'blue'), (-0.18, 'lamp'), (0.18, 'head'), (0.53, 'blue'), (0.88, 'lamp')]):
        box(f'beacon_{i}', (3.42, y, 3.0), (0.34, 0.32, 0.13), mt, 'crew_cab', bevel=0.035)
    for side, sname in SIDES:
        box(f'cab_roof_marker_{sname}', (3.65, side * (W - 0.12), 2.88), (0.12, 0.08, 0.05), 'amber', 'crew_cab', bevel=0.012)
    box('roof_ac', (2.45, 0, 2.9), (0.85, 1.35, 0.1), 'red', 'crew_cab', bevel=0.04)

    # =========================================================================== FRONT FACE
    FX = cx1
    rake = math.atan2(cx1 - 3.83, 2.62 - 1.86)
    wmid = ((cx1 + 3.83) / 2 + 0.012, (1.86 + 2.62) / 2)
    wlen = math.hypot(cx1 - 3.83, 2.62 - 1.86) - 0.1
    for i, y in enumerate([-0.56, 0.56]):
        box(f'windscreen_{i}', (wmid[0], y, wmid[1]), (0.02, 1.0, wlen), 'glass', 'crew_cab', bevel=0.008, rot=(0, -rake, 0))
        box(f'wiper_{i}', (cx1 - 0.015, y - 0.12, 1.98), (0.02, 0.62, 0.025), 'black', 'crew_cab', bevel=0.008, rot=(0.3, -rake, 0))
    box('windscreen_pillar', (wmid[0] + 0.004, 0, wmid[1]), (0.03, 0.1, wlen + 0.05), 'red', 'crew_cab', bevel=0.012, rot=(0, -rake, 0))
    box('windscreen_frame_top', (3.86, 0, 2.6), (0.04, 2.2, 0.05), 'black', 'crew_cab', bevel=0.015, rot=(0, -rake, 0))
    box('grille_frame', (FX + 0.025, 0, 1.22), (0.06, 0.96, 0.74), 'chrome', 'crew_cab', bevel=0.03)
    box('grille_back', (FX + 0.045, 0, 1.22), (0.04, 0.82, 0.6), 'black', 'crew_cab', bevel=0.01)
    for k in range(9):
        box(f'grille_bar_{k}', (FX + 0.075, 0, 0.96 + k * 0.066), (0.03, 0.82, 0.03), 'chrome', 'crew_cab', bevel=0.012)
    text('front_text', 'FIRE DEPT.', 0.2, (FX + 0.004, 0, 1.72), '+x', 'white', 'crew_cab', spacing=1.02)
    for side, sname in SIDES:
        box(f'headlamp_bezel_{sname}', (FX + 0.02, side * 0.74, 1.32), (0.05, 0.32, 0.36), 'chrome', 'crew_cab', bevel=0.03)
        box(f'headlamp_{sname}', (FX + 0.03, side * 0.74, 1.32), (0.03, 0.26, 0.3), 'black', 'crew_cab', bevel=0.02)
        lathe(f'headlamp_lens_{sname}', [(1e-4, 0.05), (0.06, 0.045), (0.1, 0.02), (0.11, 0.0)], (FX + 0.045, side * 0.74, 1.32), 'x', 'head', 'crew_cab', segs=22)
        box(f'front_indicator_{sname}', (FX + 0.03, side * 1.03, 1.12), (0.04, 0.16, 0.24), 'amber', 'crew_cab', bevel=0.02)
        box(f'bumper_lamp_{sname}', (4.39, side * 1.0, 0.52), (0.03, 0.16, 0.1), 'amber', 'chassis', bevel=0.01)
        box(f'tow_hook_{sname}', (4.39, side * 0.45, 0.38), (0.08, 0.1, 0.09), 'black', 'chassis', bevel=0.02)
        box(f'front_mudflap_{sname}', (FRONT_AXLE + 0.69, side * 1.0, 0.42), (0.04, 0.42, 0.24), 'black', 'chassis', bevel=0.01)
    bumper = prism('front_bumper', [(3.98, 0.27), (4.32, 0.27), (4.38, 0.33), (4.38, 0.6), (4.33, 0.66), (3.98, 0.66)], -1.3, 1.3, 'chrome', 'chassis', bevel=0.03)
    box('front_bumper_step', (4.2, 0, 0.67), (0.28, 1.9, 0.02), 'tread', 'chassis', bevel=0.006)
    box('front_plate', (4.385, 0, 0.47), (0.01, 0.44, 0.12), 'white', 'chassis', bevel=0.004)

    # =========================================================================== REAR FACE
    RX = px(105)
    box('rear_door', (RX - 0.01, 0, 1.6), (0.02, 1.8, 2.0), 'red', 'rear_compartment', bevel=0.01)
    frame_pts = None
    for side, sname in SIDES:
        box(f'tail_lamp_{sname}', (RX - 0.03, side * 1.03, 0.85), (0.05, 0.22, 0.34), 'lamp', 'rear_compartment', bevel=0.02)
        box(f'tail_indicator_{sname}', (RX - 0.03, side * 1.03, 1.14), (0.05, 0.22, 0.16), 'amber', 'rear_compartment', bevel=0.02)
        box(f'rear_chevron_{sname}', (RX - 0.025, side * 0.5, 0.52), (0.01, 0.85, 0.14), 'white', 'rear_compartment', bevel=0.004)
    box('rear_ladder_rail', (RX - 0.09, -0.95, 2.2), (0.04, 0.04, 1.4), 'chrome', 'rear_compartment', bevel=0.012)
    for k in range(5):
        box(f'rear_ladder_step_{k}', (RX - 0.09, -0.8, 1.6 + k * 0.3), (0.04, 0.3, 0.035), 'chrome', 'rear_compartment', bevel=0.01)
    box('rear_ladder_rail_2', (RX - 0.09, -0.65, 2.2), (0.04, 0.04, 1.4), 'chrome', 'rear_compartment', bevel=0.012)


    root = GROUPS['fire_engine']
    root.name = 'root'
    GROUPS['chassis'].name = 'body'
    for axle, prefix in [('front','wheelF'),('rear','wheelR')]:
        for side, suffix in [('near','L'),('far','R')]:
            GROUPS[f'wheel_{axle}_{side}'].name = prefix + suffix
    for name, indices in [('sirenL',[0,1,2]),('sirenR',[3,4,5])]:
        node = sockets.empty(name, (3.42, -.53 if name=='sirenL' else .53, 3.0))
        pivots.parent(node, root)
        for index in indices:
            pivots.parent(bpy.data.objects[f'beacon_{index}'], node)
    for name, prefix, position in [('lightsFront','headlamp_lens',(4.1,0,1.32)),('lightsBrake','rear_tail',(-4.2,0,1))]:
        node = sockets.empty(name, position)
        pivots.parent(node, root)
        matches = [o for o in list(root.children_recursive) if o.type=='MESH' and o.name.startswith(prefix)]
        for obj in matches:
            pivots.parent(obj, node)
    for name, position in [('driverSeat',(3.2,.4,1.25)),('exitL',(2.9,-1.8,0)),('exitR',(2.9,1.8,0))]:
        pivots.parent(sockets.empty(name, position), root)
    colliders.cuboid('body', (7.4,2.1,2.5), (0,0,1.5), root)
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    points=[]
    for obj in root.children_recursive:
        if obj.type=='MESH':
            ev=obj.evaluated_get(graph)
            mesh=ev.to_mesh()
            points.extend(obj.matrix_world @ v.co for v in mesh.vertices)
            ev.to_mesh_clear()
    minimum=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maximum=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    size=maximum-minimum
    root.scale=(7.4/size.x, 2.1/size.y, 3.55/size.z)
    root.location.z=-minimum.z*root.scale.z
    root.location.x=-(minimum.x+maximum.x)/2*root.scale.x
    root.location.y=-(minimum.y+maximum.y)/2*root.scale.y
    bpy.context.view_layer.update()
    export.merge_by_material(root, {'body','wheelFL','wheelFR','wheelRL','wheelRR','ladder','sirenL','sirenR','lightsFront','lightsBrake'})
    return root
