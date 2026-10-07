"""Fizz vending machine, entirely scripted geometry.
Reference measured at 1024x1536: cabinet front x=195..741, z(image)=125..1320;
red inset 250..700, y=193..1057; logo 310..639,y=260..540;
can bay 300..674,y=607..1014; selector shelf y=785..839;
delivery hatch 326..604,y=1098..1227. Cabinet H=2.15m, W=.96m,
D=.67m, feet=.11m. Front +X, up +Z, near side -Y.
Image vertical mapping z=.11+(1320-py)/1195*2.04.
Four compare/fix rounds recorded in renders and report.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


PI = math.pi
W = 1.25                      # half width of the body skin
REAR_AXLE, FRONT_AXLE = -1.75, 2.89
WHEEL_R, ARCH_R = 0.5, 0.66
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'


def px(x_img):
    return -4.25 + (x_img - 105) / 1425 * 8.3


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TRUCK = bpy.data.collections.new('FizzVendingMachine')
STAGE = bpy.data.collections.new('Stage')
scene.collection.children.link(TRUCK)
scene.collection.children.link(STAGE)

# --------------------------------------------------------------------------- materials
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def material(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.03, emit=None, strength=0.0, aniso=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    if aniso:
        b.inputs['Anisotropic'].default_value = aniso
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.diffuse_color = srgb(color)
    return m


M = {
    'red': material('paint_red', '#c3160e', 0.28, coat=1.0, coat_rough=0.04),
    'red_dark': material('paint_red_dark', '#6a0d08', 0.45),
    'chrome': material('chrome', '#f1f3f6', 0.07, 1.0),
    'alu': material('aluminium', '#c9cdd4', 0.3, 0.55),
    'alu_dark': material('aluminium_dark', '#9aa0a8', 0.38, 0.55),
    'tread': material('tread_plate', '#b3b8bf', 0.36, 0.6),
    'rim': material('rim_silver', '#cfd3d9', 0.18, 1.0),
    'rubber': material('tyre_rubber', '#141416', 0.82),
    'black': material('black_plastic', '#1c1c20', 0.42, coat=0.3),
    'glass': material('glass_tint', '#0b1016', 0.02, 0.0, coat=1.0, coat_rough=0.0),
    'white': material('paint_white', '#f5f4ef', 0.32, coat=0.8),
    'flame': material('flame_orange', '#f7a21b', 0.3, coat=0.8),
    'amber': material('lamp_amber', '#ff9a1a', 0.15, emit='#ff8a00', strength=2.2),
    'lamp': material('lamp_red', '#e0140a', 0.15, emit='#ff1200', strength=2.5),
    'blue': material('lamp_blue', '#2d4bff', 0.15, emit='#1f3dff', strength=4.0),
    'head': material('lamp_head', '#fff4d8', 0.08, emit='#ffe9b8', strength=3.0),
    'glow': material('lamp_strip', '#ffcc40', 0.2, emit='#ffb81a', strength=2.5),
    'gauge': material('gauge_face', '#f4f1e8', 0.4),
}

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


def finish(obj, mat, parent, bevel=0.0, segs=3, smooth=True, harden=True, angle=40):
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


def box(name, center, size, mat, parent=None, bevel=0.02, segs=3, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = from_bm(name, bm)
    o.location = center
    o.rotation_euler = rot
    return finish(o, mat, parent, bevel=min(bevel, min(size) * 0.45), segs=segs)


def prism(name, pts_xz, y0, y1, mat, parent=None, bevel=0.03, segs=3):
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


def lathe(name, profile, center, axis, mat, parent=None, segs=48, smooth=True):
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


def cylinder(name, center, r, depth, axis, mat, parent=None, segs=40, bevel=0.0):
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


def raw_cyl(name, center, r, depth, axis='y', segs=64):
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
    o = box(name, ((x0 + x1) / 2, y, z0 + h / 2), (x1 - x0, 0.024, h * 0.94), mat, parent, bevel=h * 0.45, segs=3)
    arr = o.modifiers.new('slats', 'ARRAY')
    arr.use_relative_offset = False
    arr.use_constant_offset = True
    arr.constant_offset_displace = (0, 0, h)
    arr.count = n
    o.modifiers.move(len(o.modifiers) - 1, 0)
    return o


# Cabinet and product materials
import random
random.seed(51)
M.update({
 'blue':material('indigo enamel','#383381',.49,coat=.15),
 'sideblue':material('side violet enamel','#302451',.52,coat=.10),
 'topblue':material('lid violet enamel','#503367',.63,coat=.05),
 'blue_dark':material('recess indigo','#211e4d',.49),
 'red':material('fizz crimson enamel','#d91c36',.38,coat=.4),
 'red_dark':material('crimson interior','#790e21',.55),
 'cream':material('warm ivory branding','#fff1b5',.55,emit='#fff0c0',strength=.20),
 'canblue':material('blue soda ink','#1557bf',.31,coat=.7),
 'canred':material('cherry soda ink','#e61c49',.31,coat=.7),
 'cyan':material('cyan bubbles','#4dc2e9',.38),
 'pink':material('pink bubbles','#ff739b',.38),
 'gold':material('citrus gold','#ffd152',.38),
 'rust':material('exposed oxidized steel','#91543c',.8),
 'scuff':material('paint abrasion','#6a6487',.72),
 'black':material('delivery rubber','#202027',.73),
 'steel':material('aged steel','#51515b',.38,.7),
})
M['blue'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.25
M['topblue'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.2
FONT='/System/Library/Fonts/Supplemental/Brush Script.ttf'
group('vending_machine')
group('cabinet',parent='vending_machine')
group('front_door',(.35,.48,1.1),parent='vending_machine')
group('products',parent='front_door')
group('delivery_flap',(.39,0,.42),parent='front_door')
# Front frames reuse the fire engine side-profile helper, rotated onto +X.
def frontframe(name,y0,z0,y1,z1,x,mat,parent,bar=.02,r=.015,depth=.02):
    o=ring(name,rrect(y0-bar,z0-bar,y1+bar,z1+bar,r+bar*.6),rrect(y0,z0,y1,z1,r),-1,depth,mat,parent,y_skin=x,bevel=.004)
    # rotate geometry rather than object so parenting remains stable
    o.data.transform(Matrix.Rotation(PI/2,4,'Z'))
    return o
shell=box('rounded_cabinet_shell',(0,0,1.13),(.67,1.0,2.04),'blue','cabinet',.045,6)
# Real front recess cut into main shell
cut(shell,raw_box('front_recess',(.33,0,1.25),(.20,.82,1.56)))
box('red_inset_panel',(.256,0,1.26),(.045,.815,1.53),'red','front_door',.018,4)
frontframe('dark_inset_gasket',-.416,.49,.416,2.025,.32,'blue_dark','front_door',bar=.012)
# Product window open through red panel region, backed by cavity
panel=bpy.data.objects['red_inset_panel']
cut(panel,raw_box('product_window_cut',(.26,0,.91),(.16,.69,.70)))
box('product_cavity_back',(.161,0,.91),(.025,.69,.70),'red_dark','products',.012)
for y in [-.352,.352]:
    box('display_sidewall',(.218,y,.91),(.12,.016,.70),'red','products',.007)
box('display_floor',(.235,0,.561),(.16,.71,.02),'red','products',.009)
box('display_roof',(.235,0,1.262),(.16,.71,.021),'red','products',.008)

LOGO_LOOPS=[[(161, 8), (164, 9), (168, 14), (168, 24), (165, 30), (161, 34), (145, 42), (131, 46), (121, 51), (120, 60), (119, 60), (117, 73), (115, 77), (115, 82), (114, 82), (114, 86), (112, 90), (112, 96), (110, 100), (108, 115), (107, 115), (106, 124), (104, 128), (104, 132), (108, 131), (112, 127), (128, 120), (133, 115), (133, 113), (136, 111), (138, 113), (138, 124), (137, 124), (136, 131), (132, 139), (128, 143), (100, 154), (96, 176), (94, 180), (94, 185), (93, 185), (93, 190), (91, 194), (91, 199), (89, 203), (88, 213), (87, 213), (84, 229), (82, 232), (82, 236), (81, 236), (78, 248), (76, 250), (76, 253), (68, 269), (64, 273), (64, 275), (60, 278), (60, 280), (57, 283), (55, 283), (50, 288), (47, 288), (42, 291), (28, 290), (17, 282), (17, 280), (15, 279), (13, 275), (12, 269), (11, 269), (10, 253), (11, 253), (11, 247), (12, 247), (14, 238), (17, 232), (23, 226), (28, 225), (29, 231), (28, 231), (27, 245), (26, 245), (28, 258), (30, 262), (35, 266), (42, 266), (45, 263), (47, 263), (47, 261), (51, 258), (57, 246), (59, 238), (60, 238), (60, 234), (62, 231), (62, 227), (63, 227), (63, 223), (64, 223), (64, 219), (66, 215), (66, 209), (67, 209), (68, 200), (70, 196), (75, 168), (76, 168), (76, 165), (75, 165), (63, 171), (62, 173), (52, 177), (51, 179), (42, 183), (35, 191), (32, 190), (32, 186), (31, 186), (32, 174), (33, 174), (35, 167), (41, 161), (61, 151), (65, 152), (64, 151), (65, 149), (81, 141), (83, 128), (84, 128), (84, 124), (85, 124), (85, 120), (86, 120), (86, 116), (88, 112), (88, 107), (89, 107), (89, 103), (91, 99), (92, 89), (94, 85), (95, 75), (97, 71), (97, 66), (98, 66), (98, 62), (100, 59), (100, 57), (96, 58), (94, 60), (91, 60), (89, 62), (86, 62), (82, 65), (79, 65), (71, 69), (70, 71), (65, 73), (54, 84), (53, 88), (51, 89), (48, 95), (48, 99), (46, 103), (46, 113), (47, 113), (48, 121), (54, 128), (57, 129), (57, 132), (54, 134), (48, 134), (48, 133), (45, 133), (39, 130), (34, 125), (34, 123), (32, 122), (30, 118), (29, 111), (28, 111), (28, 94), (29, 94), (29, 89), (30, 89), (32, 80), (36, 72), (40, 68), (40, 66), (50, 56), (52, 56), (55, 52), (57, 52), (64, 46), (72, 42), (75, 42), (77, 40), (83, 39), (85, 37), (94, 35), (96, 33), (103, 32), (113, 27), (137, 20)], [(329, 28), (333, 28), (336, 31), (336, 35), (337, 35), (336, 43), (332, 51), (332, 54), (330, 56), (330, 59), (326, 65), (324, 73), (320, 79), (318, 87), (312, 97), (312, 100), (308, 106), (308, 109), (296, 132), (296, 135), (298, 133), (311, 129), (321, 124), (323, 121), (325, 121), (334, 111), (337, 104), (340, 104), (341, 106), (341, 115), (340, 115), (338, 124), (335, 127), (332, 134), (319, 146), (309, 151), (305, 151), (302, 153), (298, 153), (298, 154), (283, 158), (268, 166), (267, 160), (271, 152), (271, 149), (273, 147), (273, 144), (275, 142), (275, 139), (279, 133), (279, 130), (284, 122), (284, 119), (288, 113), (288, 110), (292, 104), (292, 101), (296, 95), (296, 92), (299, 88), (299, 85), (302, 81), (302, 78), (311, 60), (309, 59), (289, 69), (288, 71), (286, 71), (279, 78), (277, 83), (274, 85), (275, 62), (276, 62), (277, 55), (279, 52), (283, 50), (294, 47), (298, 44), (301, 44), (303, 42), (306, 42), (310, 39), (313, 39), (321, 35)], [(181, 33), (188, 33), (192, 38), (193, 45), (192, 45), (192, 51), (191, 51), (189, 60), (185, 68), (183, 69), (183, 71), (180, 73), (178, 77), (162, 85), (161, 84), (162, 74), (166, 66), (170, 64), (175, 57), (176, 49), (177, 49), (176, 36)], [(253, 62), (256, 63), (259, 67), (258, 77), (230, 133), (230, 136), (225, 144), (225, 147), (220, 155), (220, 158), (216, 164), (216, 166), (218, 166), (228, 161), (231, 161), (235, 158), (238, 158), (239, 156), (241, 156), (248, 150), (248, 148), (251, 146), (253, 141), (257, 142), (257, 146), (256, 146), (256, 151), (255, 151), (255, 155), (253, 157), (252, 163), (249, 169), (246, 171), (246, 173), (239, 179), (233, 182), (229, 182), (229, 183), (222, 184), (216, 187), (212, 187), (210, 189), (197, 193), (193, 188), (193, 177), (201, 161), (201, 158), (204, 154), (204, 151), (208, 145), (208, 142), (213, 134), (213, 131), (219, 121), (219, 118), (233, 92), (233, 90), (231, 90), (227, 93), (224, 93), (222, 95), (219, 95), (217, 97), (214, 97), (208, 100), (200, 107), (198, 112), (196, 112), (195, 98), (196, 98), (197, 87), (202, 82), (205, 82), (207, 80), (227, 74), (229, 72), (237, 70)], [(168, 97), (174, 97), (176, 99), (177, 109), (176, 109), (173, 125), (171, 128), (171, 132), (169, 135), (169, 139), (167, 142), (167, 146), (165, 149), (163, 161), (162, 161), (160, 172), (159, 172), (158, 186), (160, 188), (163, 188), (173, 179), (173, 177), (176, 175), (177, 171), (179, 170), (187, 153), (189, 153), (190, 159), (189, 159), (189, 164), (188, 164), (186, 174), (178, 190), (176, 191), (174, 196), (171, 198), (171, 200), (160, 210), (153, 212), (153, 213), (145, 213), (142, 210), (140, 210), (140, 208), (138, 207), (137, 189), (138, 189), (139, 179), (140, 179), (147, 147), (149, 144), (149, 140), (150, 140), (150, 136), (152, 133), (155, 116), (156, 116), (156, 111), (152, 105)], [(319, 154), (320, 154), (320, 159), (319, 159), (318, 170), (317, 170), (316, 178), (315, 178), (310, 196), (308, 198), (308, 201), (304, 209), (302, 210), (301, 214), (288, 228), (286, 228), (282, 232), (276, 235), (273, 235), (271, 237), (260, 239), (255, 242), (249, 243), (235, 250), (234, 252), (230, 253), (229, 255), (225, 256), (224, 258), (220, 259), (219, 261), (211, 265), (204, 266), (204, 267), (197, 267), (197, 266), (194, 266), (190, 262), (191, 259), (190, 260), (188, 259), (187, 253), (186, 253), (187, 241), (190, 235), (192, 234), (192, 232), (200, 224), (202, 224), (208, 218), (212, 217), (213, 215), (215, 215), (216, 213), (218, 213), (225, 207), (247, 196), (248, 194), (281, 179), (284, 176), (285, 176), (285, 179), (279, 185), (279, 187), (275, 190), (275, 192), (272, 194), (272, 196), (267, 201), (267, 203), (262, 208), (262, 210), (260, 211), (260, 213), (258, 214), (257, 218), (254, 221), (254, 223), (256, 223), (258, 221), (261, 221), (275, 214), (277, 211), (279, 211), (282, 208), (282, 206), (287, 201), (293, 189), (294, 183), (296, 181), (298, 169), (302, 167), (303, 165), (305, 165), (306, 163), (308, 163), (309, 161), (311, 161), (312, 159), (314, 159)], [(259, 198), (252, 201), (248, 205), (246, 205), (244, 208), (242, 208), (237, 213), (235, 213), (233, 216), (231, 216), (228, 220), (226, 220), (220, 227), (218, 227), (208, 239), (208, 243), (211, 243), (217, 240), (218, 238), (228, 233), (231, 229), (233, 229), (249, 213), (249, 211), (253, 208), (253, 206), (258, 202), (258, 200), (260, 199)]]
def fizz_logo(name,center,width,height,parent,can_radius=None):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='2D';cu.fill_mode='BOTH';cu.extrude=.00045;cu.resolution_u=1
    for loop in LOGO_LOOPS:
        sp=cu.splines.new('POLY');sp.points.add(len(loop)-1)
        for pt,(u,v) in zip(sp.points,loop):pt.co=((u-175)/350*width,(150-v)/300*height,0,1)
        sp.use_cyclic_u=True
    ob=bpy.data.objects.new(name,cu);TRUCK.objects.link(ob);ob.location=center;ob.rotation_euler=(PI/2,0,PI/2);cu.materials.append(M['cream'])
    bpy.context.view_layer.objects.active=ob
    for o in bpy.context.selected_objects:o.select_set(False)
    ob.select_set(True);bpy.ops.object.convert(target='MESH');TRUCK.objects.unlink(ob)
    if can_radius:
        for v in ob.data.vertices:
            v.co.z += math.sqrt(max(.00001,can_radius**2-v.co.x**2))+.001
        ob.data.update()
    return finish(ob,None,parent,smooth=False)

# Branding main logo, separate mesh lettering
logo=fizz_logo('Fizz_main_logo',(.284,0,1.67),.65,.58,'front_door')
# cans in two rows with spun aluminium rolled rim and pull tabs
profile=[(.001,-.135),(.046,-.135),(.061,-.13),(.065,-.115),(.065,.092),(.063,.113),(.052,.13),(.049,.137),(.001,.137)]
for row,z in enumerate([1.085,.715]):
 for col,y in enumerate([-.249,-.083,.083,.249]):
    g=f'can_{row}_{col}';group(g,(.233,y,z),parent='products')
    ink='canblue' if row==0 else 'canred'; accent='cyan' if row==0 else 'pink'
    lathe(g+'_body',profile,(.233,y,z),'z',ink,g,segs=48)
    for dz in [-.133,.137]:
      lathe(g+'_rolled_rim'+str(dz),[(.047,-.002),(.050,-.003),(.054,0),(.053,.004),(.049,.005),(.047,.002)],(.233,y,z+dz),'z','alu',g,segs=48)
    cylinder(g+'_lid',(.233,y,z+.138),.048,.003,'z','steel',g,segs=40)
    cylinder(g+'_lid_inner',(.233,y,z+.14),.042,.001,'z','alu',g,segs=40)
    box(g+'_pull_tab',(.24,y,z+.143),(.026,.013,.0025),'chrome',g,bevel=.005)
    cylinder(g+'_tab_hole',(.247,y,z+.145),.005,.001,'z','steel',g,segs=16)
    fizz_logo(g+'_label',(.233,y,z+.003),.102,.110,g,can_radius=.065)
    # label bubble artwork hugs curved cylinder surface
    for j in range(15):
      theta=random.uniform(-.85,.85); zz=random.uniform(-.108,.10)
      if abs(zz)<.052: continue
      rr=random.uniform(.0025,.006)
      xx=.233+.0654*math.cos(theta); yy=y+.0654*math.sin(theta)
      cylinder(g+f'_bubble{j}',(xx,yy,z+zz),rr,.0009,'x',accent,g,segs=12)
    if row==0:
      lathe(g+'_gold_shoulder',[(.064,.090),(.063,.112),(.053,.13)],(.233,y,z),'z','gold',g,segs=48)
    for j in range(4):
      theta=-.8+j*.5
      lathe(g+f'_splash{j}',[(.001,0),(.009,.006),(.011,.018),(.006,.035),(.001,.047)],(.233+.064*math.cos(theta),y+.064*math.sin(theta),z-.122),'z',accent,g,segs=12)
# Shelf and mechanical selection buttons
box('blue_selector_shelf',(.307,0,.925),(.067,.704,.081),'blue','front_door',.009)
for i,y in enumerate([-.249,-.083,.083,.249]):
 box(f'button_socket_{i}',(.346,y,.926),(.013,.097,.047),'steel','front_door',.008)
 group(f'select_button_{i}',(.36,y,.926),parent='front_door')
 box(f'select_button_{i}_cap',(.36,y,.926),(.026,.082,.038),'alu',f'select_button_{i}',.006)
# Bottom blue plate with true delivery opening
lower=box('lower_service_door',(.348,0,.309),(.038,.947,.385),'blue','front_door',.013)
cut(lower,raw_box('delivery_cut',(.35,0,.355),(.20,.47,.16)))
cut(shell,raw_box('cabinet_delivery_cut',(.30,0,.355),(.32,.47,.16)))
box('delivery_cavity',(.228,0,.355),(.025,.47,.16),'black','front_door',.012)
frontframe('delivery_black_bezel',-.245,.264,.245,.449,.371,'steel','front_door',bar=.023,depth=.018)
frontframe('delivery_inner_lip',-.225,.282,.225,.431,.361,'black','front_door',bar=.009,depth=.018)
for j in range(2):
 box(f'delivery_flap_slat_{j}',(.296,0,.306+j*.06),(.024,.433,.053),'black','delivery_flap',.008)
box('delivery_tray',(.311,0,.279),(.11,.44,.012),'steel','front_door',.004)
for y,z in [(-.414,.469),(.414,.469),(-.414,.153),(.414,.153),(-.19,.145),(.19,.145)]:
 cylinder('service_screw_socket',(.373,y,z),.016,.006,'x','blue_dark','front_door',segs=24)
 cylinder('service_screw',(.378,y,z),.011,.005,'x','alu_dark','front_door',segs=24)
 box('screw_slot',(.382,y,z),(.001,.012,.002),'black','front_door',bevel=0)
# four feet and top screwed lid
for x in [-.23,.23]:
 for y in [-.38,.38]:
  box('support_foot',(x,y,.06),(.19,.17,.12),'black','cabinet',.012)
box('top_panel_seam',(0,0,2.151),(.55,.85,.008),'blue_dark','cabinet',.012)
box('top_removable_panel',(0,0,2.156),(.53,.83,.012),'topblue','cabinet',.012)
for x in [-.23,.23]:
 for y in [-.365,.365]:
  cylinder('lid_fastener',(x,y,2.164),.009,.004,'z','steel','cabinet',segs=20)
# Back and hidden side equally finished
box('rear_panel',(-.342,0,1.1),(.018,.86,1.86),'blue_dark','cabinet',.012)
box('rear_panel_inner',(-.355,0,1.1),(.012,.82,1.82),'blue','cabinet',.01)
for z in [.34,.375,.41,.445,.48,.515]:
 box('rear_vent_slot',(-.366,0,z),(.012,.57,.012),'black','cabinet',.004)
box('rear_serial_plate',(-.367,0,.75),(.009,.19,.09),'alu_dark','cabinet',.003)
text('serial','FIZZ / 008',.022,(-.375,0,.75),'-x','black','cabinet',depth=.0005,font='/System/Library/Fonts/Supplemental/Arial.ttf')
for side in [-1,1]:
 box('side_panel_seam',(0,side*.499,1.13),(.56,.004,1.89),'blue_dark','cabinet',.016)
 box('side_panel',(0,side*.503,1.13),(.548,.005,1.87),'sideblue','cabinet',.014)
# Localised chipped edges and scratches, no procedural material dependencies.
def fleck(name,verts,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(0,1,2)]);me.update()
 return finish(bpy.data.objects.new(name,me),mat,'cabinet',smooth=False)
def front_skin(y,z):
    dy=max(0,abs(y)-.455);dz=max(0,z-2.105,.155-z)
    return .290+math.sqrt(max(0,.045**2-dy**2-dz**2))+.0004
def side_skin(x,z):
    dx=max(0,abs(x)-.290);dz=max(0,z-2.105,.155-z)
    return .455+math.sqrt(max(0,.045**2-dx**2-dz**2))+.0004
for i in range(210):
 z=random.uniform(.15,2.13);y=random.choice([-1,1])*random.uniform(.466,.491)
 a=random.uniform(.001,.006); b=random.uniform(.004,.018)
 fleck(f'front_edge_chip_{i}',[(front_skin(y,z) if z>.51 else .369,y,z),(front_skin(y,z) if z>.51 else .369,y+a,z+b),(front_skin(y,z) if z>.51 else .369,y-a*.5,z+b*.8)],'rust' if i%3 else 'scuff')
for side in [-1,1]:
 for i in range(95):
  x=random.choice([-.31,.30])+random.uniform(-.01,.01); z=random.uniform(.15,2.12)
  a=random.uniform(.002,.006); b=random.uniform(.008,.036)
  fleck(f'side_wear_{side}_{i}',[(x,side*side_skin(x,z),z),(x+a,side*side_skin(x+a,z+b),z+b),(x-a*.6,side*side_skin(x-a*.6,z+b*.75),z+b*.75)],'rust')

# Fine surface wear and edge oxidation. Static flecks are consolidated below.
M['red_scuff']=material('crimson paint scars','#ac2638',.82)
M['blue_scuff']=material('indigo paint scars','#4d4771',.8)
for i in range(130):
    y=random.uniform(-.394,.394);z=random.uniform(1.29,2.005)
    if abs(y)<.33 and 1.405<z<1.977:continue
    a=random.uniform(.001,.009);b=random.uniform(.002,.012)
    fleck('red_paint_scar_'+str(i),[(.279,y,z),(.279,y+a,z+b),(.279,y+a*.5,z+b*1.4)],'red_scuff' if i%3 else 'rust')
for side in [-1,1]:
 for i in range(160):
    x=random.uniform(-.265,.265);z=random.uniform(.20,2.07)
    a=random.uniform(.001,.005);b=random.uniform(.002,.021)
    fleck(f'side_surface_scar_{side}_{i}',[(x,side*.507,z),(x+a,side*.507,z+b),(x-a*.4,side*.507,z+b*.7)],'blue_scuff' if i%5 else 'rust')
for i in range(100):
 x=random.uniform(-.253,.253);y=random.uniform(-.392,.392);a=random.uniform(.001,.009);b=random.uniform(.002,.013)
 fleck('top_wear_'+str(i),[(x,y,2.163),(x+a,y+b,2.163),(x-a*.3,y+b,2.163)],'rust' if i%3 else 'scuff')
# Join purely static decoration by material to avoid hundreds of draw calls.
def join_named_parts(obs,name):
    if not obs:return
    for ob in bpy.context.selected_objects:ob.select_set(False)
    for ob in obs:ob.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
for mat in ['rust','scuff','red_scuff','blue_scuff']:
 obs=[o for o in list(TRUCK.objects) if o.type=='MESH' and o.name.startswith(('front_edge_chip','side_wear','red_paint_scar','side_surface_scar','top_wear')) and o.data.materials[0]==M[mat]]
 join_named_parts(obs,'weathering_'+mat)
for row in range(2):
 for col in range(4):
  prefix=f'can_{row}_{col}'
  obs=[o for o in list(TRUCK.objects) if o.type=='MESH' and o.name.startswith(prefix) and ('_bubble' in o.name or '_splash' in o.name)]
  join_named_parts(obs,prefix+'_label_artwork')

def stage(view):
    world = bpy.data.worlds.new('studio')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(str(Path(bpy.utils.resource_path('LOCAL')) / 'datafiles/studiolights/world/studio.exr'))
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.6
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    # light-grey backdrop like the reference
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    flat = nt.nodes.new('ShaderNodeBackground')
    flat.inputs['Color'].default_value = (1.6, 1.6, 1.6, 1)
    out = nt.nodes['World Output']
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs[0])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(flat.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])

    def light(name, kind, loc, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        if kind == 'AREA':
            ld.size = size
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        STAGE.objects.link(o)
        d = Vector((0, 0, 1.4)) - Vector(loc)
        o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return o
    light('key', 'AREA', (8, -9, 10), 2600, 7, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-9, -6, 5), 900, 8, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, 9, 8), 1600, 6, (1.0, 0.85, 0.75))

    ground = bpy.data.objects.new('ground', bpy.data.meshes.new('ground'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(ground.data)
    bm.free()
    STAGE.objects.link(ground)
    ground.is_shadow_catcher = True

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    STAGE.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    views = {
        'ref': ((7.0, 2.32, 2.95), (0, 0, 1.10), 58),
        'front': ((6, 0, 2.2), (0, 0, 1.1), 58),
        'side': ((0, -6, 2.2), (0, 0, 1.1), 58),
        'rear': ((-5.5, -2.1, 3), (0, 0, 1.1), 58),
        'far': ((5.5, 2.1, 3), (0, 0, 1.1), 58),
        'top': ((3, -2, 6), (0, 0, 1.1), 58),
    }
    loc, tgt, lens = views[view]
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    scene.cycles.samples = int(arg('--samples', 96))
    scene.cycles.use_denoising = True
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.render.resolution_x = int(arg('--width', 1837))
    scene.render.resolution_y = int(arg('--height', 856))


bpy.context.view_layer.update()
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in TRUCK.objects:
    if o.type == 'MESH':
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        ev.to_mesh_clear()
print(f'BUILD OK: {sum(1 for o in TRUCK.objects if o.type == "MESH")} meshes, {tris} triangles')

if arg('--render'):
    stage(arg('--view', 'ref'))
if arg('--blend'):
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(arg('--blend')).resolve()))
if arg('--glb'):
    for o in bpy.context.view_layer.objects:
        o.select_set(o.name in TRUCK.objects)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_lights=False, export_cameras=False)
    print('GLB OK', arg('--glb'))
if arg('--render'):
    scene.render.filepath = str(Path(arg('--render')).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK', arg('--render'))
