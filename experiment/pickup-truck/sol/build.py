"""Reference measurements: image 1536x1024. Front bumper at (50,600),
front near wheel (735,716), rear wheel (1310,582). Roof (560,145)..(1100,175).
Hood occupies 60..900 px, cab 430..1170, open bed 1130..1480.
World: nose X=2.35, tail=-2.35; axles +1.43/-1.42; tyre R=.47;
belt at Z=1.20; white side Z=.69..1.24; roof Z=2.18.
Front +X, visible -Y. Two-tone red/ivory single cab, rectangular lamps,
three black grille slats, steel perforated rims and chunky all-terrain tyres.
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
W = 0.87                      # half width of the body skin
REAR_AXLE, FRONT_AXLE = -1.75, 2.89
WHEEL_R, ARCH_R = 0.5, 0.66
FONT = '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf'


def px(x_img):
    return -4.25 + (x_img - 105) / 1425 * 8.3


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TRUCK = bpy.data.collections.new('PickupTruck')
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


SIDES = [(-1, 'near'), (1, 'far')]

M['red']=material('Vermilion enamel','#da3028',.24,coat=.85)
M['white']=material('Warm ivory enamel','#eee4d2',.3,coat=.65)
M['chrome']=material('Satin polished chrome','#d9dce0',.23,.85)
M['rim']=material('Gunmetal steel wheels','#64666a',.28,.78)
M['glass']=material('Smoky blue glazing','#263641',.12,coat=1)
M['head']=material('Warm headlamp glass','#fff2b0',.19,emit='#ffe79a',strength=1.6)
M['rubber']=material('Tyre charcoal','#242321',.87)
group('pickup')
for g in ['chassis','body','bed','cab','hood','front','tailgate']:
    group(g,parent='pickup')
box('ladder_frame',(0,0,.48),(4.35,1.30,.16),'black','chassis',.035)
for x in [-1.42,1.43]:
    cylinder('axle',(x,0,.47),.07,1.64,'y','black','chassis')
    lathe('differential',[(.01,-.15),(.14,-.12),(.17,0),(.14,.12),(.01,.15)],(x,0,.47),'y','black','chassis')
for side,sn in SIDES:
    box('frame_rail_'+sn,(0,side*.52,.42),(4.1,.09,.14),'black','chassis')
    for x in [-1.42,1.43]:
        box('leaf_spring_'+sn+str(x),(x,side*.55,.35),(.95,.07,.035),'rim','chassis',.008)
# lower continuous shell divided at door and bed
for name,xa,xb in [('front_fenders',.73,2.27),('cab_lower',-.63,.73),('bed_sides',-2.28,-.67)]:
    ob=box(name,((xa+xb)/2,0,.93),(xb-xa,1.74,.78),'white','body',.055,4)
    for x in [-1.42,1.43]:
        if xa-.5<x<xb+.5: cut(ob,raw_cyl('wheel_opening',(x,0,.47),.565,2.2))
    red=box(name+'_red_rocker',((xa+xb)/2,0,.62),(xb-xa,1.75,.27),'red','body',.035)
    for x in [-1.42,1.43]:
        if xa-.5<x<xb+.5: cut(red,raw_cyl('rocker_arch',(x,0,.47),.567,2.2))
# actual hollow bed: remove upper central volume from the side shell
ob=bpy.data.objects['bed_sides'];cut(ob,raw_box('bed_void',(-1.48,0,1.30),(1.48,1.43,.8)))
box('bed_floor',(-1.47,0,.90),(1.58,1.48,.075),'red_dark','bed')
for i in range(11): box('bed_floor_rib_'+str(i),(-1.47,-.65+i*.13,.951),(1.48,.027,.025),'red','bed',.012)
for side,sn in SIDES:
    box('bed_red_rail_'+sn,(-1.49,side*.805,1.29),(1.64,.145,.19),'red','bed',.045)
    box('bed_top_lip_'+sn,(-1.49,side*.82,1.396),(1.70,.16,.045),'red','bed',.02)
    for i in range(5):
        box('bed_inner_rib_'+sn+str(i),(-2.1+i*.29,side*.713,1.15),(.045,.035,.34),'red_dark','bed',.01)
    for i in range(3):
        frame('stake_pocket_'+sn+str(i),-2.13+i*.50,1.275,-2.09+i*.50,1.34,side,'white','bed',bar=.005,r=.008,depth=.003,y_skin=.884)
box('bed_bulkhead',(-.70,0,1.17),(.09,1.55,.44),'red','bed',.025)
box('tailgate',(-2.29,0,1.12),(.09,1.65,.52),'white','tailgate',.03)
box('tailgate_red_cap',(-2.29,0,1.35),(.105,1.7,.15),'red','tailgate',.03)
box('tailgate_handle',(-2.35,0,1.28),(.035,.22,.055),'black','tailgate',.015)
text('tailgate_badge','P I O N E E R',.11,(-2.35,0,1.06),'-x','chrome','tailgate',depth=.002)
# cab silhouette rear upright and windshield rake
cabpts=[(-.67,1.15),(.76,1.15),(.72,1.34),(.31,2.10),(.18,2.18),(-.57,2.18),(-.69,2.06)]
cab=prism('cab_shell',cabpts,-.85,.85,'red','cab',.065,5)
# side windows and rear pane cut from real shell
window=[(-.56,1.38),(.62,1.38),(.24,2.06),(-.51,2.06)]
for side,sn in SIDES:
    cut(cab,prism('window_cutter',window,side*.70-.22,side*.70+.22,None,bevel=0))
    plate('side_glass_'+sn,window,side,.016,'glass','cab',y_skin=.812,bevel=.012)
    outer=[(-.59,1.35),(.65,1.35),(.27,2.09),(-.54,2.09)]
    ring('window_gasket_'+sn,outer,window,side,.025,'black','cab',y_skin=.843,bevel=.008)
    plate('vent_pillar_'+sn,[(.35,1.39),(.39,1.39),(.10,2.055),(.06,2.055)],side,.02,'black','cab',y_skin=.848)
    plate('rear_cab_trim_'+sn,[(-.63,1.30),(-.55,1.31),(-.48,2.08),(-.57,2.08)],side,.015,'red','cab',y_skin=.854)
    ring('door_seam_'+sn,[(-.57,.64),(.72,.64),(.75,1.33),(.30,2.1),(-.54,2.1)], [(-.56,.65),(.71,.65),(.74,1.33),(.29,2.09),(-.53,2.09)],side,.005,'red_dark','cab',y_skin=.877,bevel=0)
    group('door_'+sn,(-.54,side*.87,1.0),parent='cab')
    box('door_red_belt_'+sn,(.06,side*.876,1.30),(1.26,.025,.16),'red','door_'+sn,.012)
    box('door_handle_recess_'+sn,(-.36,side*.903,1.24),(.21,.024,.09),'black','door_'+sn,.014)
    box('door_chrome_handle_'+sn,(-.36,side*.928,1.26),(.185,.03,.033),'chrome','door_'+sn,.009)
    cylinder('door_lock_'+sn,(-.41,side*.91,1.13),.017,.012,'y','chrome','door_'+sn,16)
    box('mirror_stalk_'+sn,(.55,side*1.01,1.46),(.055,.27,.05),'black','cab',.018)
    box('mirror_elbow_'+sn,(.55,side*1.14,1.54),(.055,.045,.18),'black','cab',.014)
    box('mirror_housing_'+sn,(.56,side*1.16,1.66),(.11,.23,.23),'black','cab',.04,4)
    box('mirror_surface_'+sn,(.495,side*1.16,1.66),(.014,.18,.18),'chrome','cab',.006)
# windshield plane with thick perimeter and real recess
rake=math.atan2(.42,.73)
cut(cab,raw_box('windshield_cut',(.55,0,1.74),(.60,1.48,.58)))
box('windshield_gasket',(.52,0,1.735),(.034,1.55,.82),'black','cab',.04,4,rot=(0,-rake,0))
box('windshield',(.542,0,1.737),(.018,1.45,.73),'glass','cab',.035,4,rot=(0,-rake,0))
box('roof',(-.16,0,2.155),(.92,1.72,.13),'red','cab',.07,5)
for y in [-.60,-.22,.22,.60]:box('roof_pressing_'+str(y),(-.18,y,2.224),(.71,.03,.018),'red','cab',.012)
box('rear_cab_glass',(-.705,0,1.75),(.016,1.36,.52),'glass','cab',.02)
for y in [-.38,.38]:
    box('seat',(-.30,y,1.10),(.47,.53,.14),'black','cab',.06)
    box('seat_back',(-.50,y,1.45),(.14,.53,.61),'black','cab',.07,rot=(0,.12,0))
box('dashboard',(.55,0,1.36),(.24,1.43,.12),'black','cab',.03)
lathe('steering_wheel',[(.16,-.012),(.18,-.012),(.18,.012),(.16,.012),(.16,-.012)],(.31,-.40,1.49),'x','black','cab',32)
# hood gently tapered profile, separate enamel wings
hoodpts=[(.71,1.19),(2.26,1.19),(2.26,1.37),(2.08,1.43),(.74,1.45)]
prism('hood',hoodpts,-.84,.84,'red','hood',.055,4)
for side,sn in SIDES:
    box('hood_edge_'+sn,(1.46,side*.835,1.38),(1.50,.075,.09),'red','hood',.025)
    box('hood_seam_'+sn,(1.46,side*.67,1.463),(1.43,.011,.007),'red_dark','hood',.002)
    box('fender_red_belt_'+sn,(1.50,side*.875,1.29),(1.48,.028,.14),'red','hood',.014)
    box('fender_marker_'+sn,(2.04,side*.90,1.16),(.115,.024,.055),'amber','front',.013)
    box('fender_badge_'+sn,(.94,side*.90,1.30),(.13,.01,.018),'chrome','front',.003)
    for ax in [-1.42,1.43]:
        outer=arc(ax,.47,.61,0,PI,24);inner=arc(ax,.47,.563,PI,0,24)
        plate('fender_flare_'+sn+str(ax),outer+inner,side,.085,'white','body',y_skin=.859,bevel=.016)
    box('rocker_trim_'+sn,(.07,side*.90,.75),(1.21,.018,.022),'white','body',.006)
for y in [-.50,.50]:
    box('wiper_arm_'+str(y),(.76,y,1.415),(.028,.40,.02),'black','cab',.007,rot=(0,0,.2))
    box('wiper_blade_'+str(y),(.72,y,1.448),(.03,.44,.025),'black','cab',.009)
for i in range(15):box('cowl_vent_'+str(i),(.79,-.57+i*.082,1.46),(.10,.012,.009),'black','hood',.002)
# nose and grille with inset slats
box('front_face',(2.24,0,1.09),(.12,1.71,.46),'red','front',.025)
box('grille_bezel',(2.312,0,1.13),(.07,1.05,.40),'chrome','front',.045,4)
box('grille_recess',(2.354,0,1.13),(.02,.95,.32),'black','front',.025)
for z in [.995,1.105,1.215]:box('grille_slat_'+str(z),(2.373,0,z),(.03,.93,.022),'chrome','front',.006)
for y in [-.35,-.17,.17,.35]:box('grille_vertical_'+str(y),(2.365,y,1.13),(.014,.022,.29),'rim','front',.004)
badge=box('diamond_badge',(2.401,0,1.13),(.026,.13,.13),'chrome','front',.006,rot=(PI/4,0,0))
box('diamond_red',(2.421,0,1.13),(.018,.09,.09),'red','front',.004,rot=(PI/4,0,0))
for side,sn in SIDES:
    y=side*.67
    box('headlamp_bezel_'+sn,(2.32,y,1.14),(.065,.29,.36),'chrome','front',.035,4)
    box('headlamp_black_'+sn,(2.362,y,1.14),(.025,.255,.315),'black','front',.03)
    box('headlamp_lens_'+sn,(2.382,y,1.15),(.026,.225,.26),'head','front',.055,5)
    for i in range(7):box('lens_flute_'+sn+str(i),(2.399,y-.09+i*.03,1.15),(.008,.004,.19),'head','front',.002)
    box('corner_indicator_'+sn,(2.34,side*.852,1.12),(.075,.057,.32),'amber','front',.015)
    for z in [1.04,1.15]:box('indicator_divider_'+sn+str(z),(2.385,side*.852,z),(.01,.06,.009),'chrome','front',.002)
bumper=box('front_bumper',(2.40,0,.73),(.28,1.91,.25),'chrome','front',.06,4)
for y in [-.43,.43]:
    cut(bumper,raw_box('bumper_slot',(2.54,y,.73),(.12,.32,.09)))
    box('bumper_slot_back_'+str(y),(2.485,y,.73),(.01,.29,.075),'black','front',.01)
for y in [-.74,.74]:box('bumper_turn_'+str(y),(2.551,y,.74),(.016,.16,.065),'amber','front',.009)
box('plate_back',(2.566,0,.69),(.035,.40,.25),'black','front',.015)
box('number_plate',(2.588,0,.69),(.01,.36,.215),'white','front',.01)
text('registration','F. 77-70',.118,(2.601,0,.69),'+x','black','front',font='/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf',depth=.001)
for y in [-.15,.15]:cylinder('plate_screw'+str(y),(2.603,y,.774),.006,.006,'x','chrome','front',12)
box('rear_bumper',(-2.40,0,.64),(.23,1.91,.18),'chrome','chassis',.045)
for side,sn in SIDES:
    box('rear_lamp_gasket_'+sn,(-2.34,side*.80,1.04),(.035,.10,.37),'black','bed',.012)
    box('rear_lamp_'+sn,(-2.365,side*.80,1.09),(.025,.085,.24),'lamp','bed',.012)
    box('rear_indicator_'+sn,(-2.37,side*.80,.92),(.024,.085,.08),'amber','bed',.008)
    box('mudflap_'+sn,(-1.98,side*.74,.44),(.045,.32,.34),'black','chassis',.01)
# off-road tyres and steel rims: 4 pivoted assemblies
TY=[(.26,-.15),(.37,-.16),(.43,-.14),(.466,-.10),(.474,0),(.466,.10),(.43,.14),(.37,.16),(.26,.15)]
RIM=[(.001,-.12),(.26,-.12),(.285,-.10),(.285,.12),(.27,.16),(.245,.165),(.225,.115),(.11,.105),(.001,.10)]
for x,ax in [(1.43,'front'),(-1.42,'rear')]:
 for side,sn in SIDES:
    g='wheel_'+ax+'_'+sn;c=(x,side*.79,.474);out='-y' if side<0 else 'y';group(g,c,parent='chassis')
    lathe(g+'_tyre',TY,c,out,'rubber',g,64)
    rim=lathe(g+'_steel_rim',RIM,c,out,'rim',g,64)
    for k in range(8):
        t=2*PI*k/8
        cut(rim,raw_cyl('rim_hole',(x+.178*math.cos(t),side*.94,.474+.178*math.sin(t)),.035,.30,'y',16))
    lathe(g+'_rim_lip',[(.264,.16),(.279,.165),(.289,.14),(.286,.125)],c,out,'chrome',g,64)
    lathe(g+'_hub',[(.001,.20),(.064,.20),(.079,.17),(.075,.10),(.001,.10)],c,out,'rim',g,40)
    for k in range(6):
        t=2*PI*k/6
        cylinder(g+'_lug'+str(k),(x+.098*math.cos(t),side*.918,.474+.098*math.sin(t)),.014,.028,'y','chrome',g,6)
    for k in range(36):
        t=2*PI*k/36
        for j in [-1,0,1]:
            tt=t+j*.033
            box(g+'_tread_'+str(k)+'_'+str(j),(x+.469*math.cos(tt),side*.79+j*.10,.474+.469*math.sin(tt)),(.072,.085,.037),'rubber',g,.007,2,rot=(0,PI/2-tt,0))
    lathe(g+'_sidewall_ridge',[(.359,.154),(.367,.159),(.377,.154)],c,out,'rubber',g,64)
# Round 2: red bed lining and fuller shoulder lugs.
for side,sn in SIDES:
    box('bed_inner_red_skin_'+sn,(-1.49,side*.717,1.13),(1.47,.018,.38),'red','bed',.01)
box('bed_tail_inner',(-2.235,0,1.16),(.018,1.43,.36),'red','bed',.01)
for ob in TRUCK.objects:
    if ob.type=='MESH' and '_tyre' in ob.name:
        ob.scale.y=1.12
# Round 3: subtler stamped roof, translucent glazing, stronger lamp colour.
for ob in list(TRUCK.objects):
    if ob.name.startswith('roof_pressing_'): bpy.data.objects.remove(ob,do_unlink=True)
roof=bpy.data.objects['roof']
for y in [-.49,0,.49]:
    cut(roof,raw_box('roof_stamped_channel',(-.16,y,2.23),(.65,.065,.043)))
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.58
M['glass'].surface_render_method='DITHERED'
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.22
M['head'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=3.8
# Hood central pressed panel and latch.
prism('hood_center_press',[(.83,1.449),(2.07,1.432),(2.07,1.438),(.83,1.455)],-.48,.48,'red','hood',.008)
box('hood_latch',(2.22,0,1.432),(.065,.12,.013),'red_dark','hood',.006)
box('hood_latch_trim',(2.266,0,1.39),(.018,.023,.055),'chrome','hood',.005)
for ob in TRUCK.objects:
    if '_tread_' in ob.name:
        ob.scale.x=1.15; ob.scale.z=1.18
# Round 4: open windscreen surround, independent door skins, rugged shoulders.
bpy.data.objects.remove(bpy.data.objects['windshield_gasket'],do_unlink=True)
for z,xx in [(1.405,.71),(2.075,.326)]:
    box('windscreen_edge_'+str(z),(xx,0,z),(.028,1.52,.028),'black','cab',.01,rot=(0,-rake,0))
for y in [-.759,.759]:
    box('windscreen_side_'+str(y),(.52,y,1.735),(.034,.031,.80),'black','cab',.008,rot=(0,-rake,0))
for side,sn in SIDES:
    # inset body support behind independently parented exterior door plates
    cut(bpy.data.objects['cab_lower'],raw_box('door_recess',(.05,side*.866,.99),(1.23,.09,.48)))
    box('door_ivory_skin_'+sn,(.05,side*.875,.998),(1.22,.035,.46),'white','door_'+sn,.028,4)
    box('door_lower_red_skin_'+sn,(.05,side*.884,.674),(1.22,.025,.16),'red','door_'+sn,.02)
    box('door_lower_molding_'+sn,(.05,side*.905,.78),(1.19,.018,.024),'white','door_'+sn,.007)
    for nm in ['side_glass_','window_gasket_','vent_pillar_','door_seam_']:
        ob=bpy.data.objects.get(nm+sn)
        if ob:
            ob.parent=GROUPS['door_'+sn]
            ob.matrix_parent_inverse=GROUPS['door_'+sn].matrix_world.inverted()
for x,ax in [(1.43,'front'),(-1.42,'rear')]:
    for side,sn in SIDES:
        g='wheel_'+ax+'_'+sn
        for k in range(36):
            t=2*PI*k/36
            for edge in [-1,1]:
                box(g+'_shoulder_'+str(k)+'_'+str(edge),(x+.446*math.cos(t),side*.79+edge*.155,.474+.446*math.sin(t)),(.073,.047,.045),'rubber',g,.008,2,rot=(0,PI/2-t,0))
# Bright red remains readable under neutral realtime lighting.
M['red'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=srgb('#ef342e')
# Fourth comparison fixes: hollow the cabin rather than leaving solid core;
# soften roof corner channels and consolidate tyre lugs for realtime draw calls.
cut(cab,prism('cab_interior_void',[(-.59,1.24),(.65,1.24),(.60,1.38),(.24,2.05),(-.49,2.05),(-.60,1.98)],-.75,.75,None,bevel=0))
cut(cab,raw_box('rear_window_opening',(-.69,0,1.75),(.25,1.30,.46)))
roof.modifiers['bevel'].width=.022
roof.modifiers['bevel'].use_clamp_overlap=False
M['red'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.32
M['red'].node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=.55
# All tread blocks remain within their wheel's pivoted assembly.
for ax in ['front','rear']:
    for sn in ['near','far']:
        prefix='wheel_'+ax+'_'+sn
        obs=[o for o in TRUCK.objects if o.name.startswith(prefix) and ('_tread_' in o.name or '_shoulder_' in o.name)]
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            bpy.context.view_layer.objects.active=o
            o.select_set(True)
            for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.context.view_layer.objects.active=obs[0]
        bpy.ops.object.join()
        obs[0].name=prefix+'_tread_and_shoulders'
# Lamp optics: warm rectangular lens around a circular reflector/bulb.
M['lamp_optic']=material('Amber tinted headlight optic','#ffc958',.22,coat=.7,emit='#ffbc3d',strength=.55)
for side,sn in SIDES:
    ob=bpy.data.objects['headlamp_lens_'+sn]
    ob.data.materials.clear(); ob.data.materials.append(M['lamp_optic'])
    lathe('headlamp_reflector_'+sn,[(.001,0),(.065,.005),(.09,0),(.097,-.005)],(2.404,side*.67,1.15),'x','head','front',32)
    box('lamp_bottom_chrome_'+sn,(2.406,side*.67,.997),(.015,.255,.012),'chrome','front',.004)
box('cabin_rearview_mirror',(.40,0,1.96),(.045,.20,.09),'black','cab',.016)
box('rearview_mount',(.38,0,2.035),(.026,.03,.08),'black','cab',.005)
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
    flat.inputs['Color'].default_value = (0.86, 0.86, 0.86, 1)
    flat.inputs['Strength'].default_value=1.65
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
    light('key', 'AREA', (8, 9, 10), 1800, 7, (1.0, 0.93, 0.84))
    light('fill', 'AREA', (-9, 6, 5), 700, 8, (0.8, 0.88, 1.0))
    light('rim', 'AREA', (-4, -9, 8), 750, 6, (1.0, 0.85, 0.75))

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
        'ref': ((10.0, 9.0, 3.8), (0, 0, 1.05), 68),
        'front': ((13, -3.5, 3.2), (0.6, 0, 1.4), 50),
        'side': ((0.0, -15.5, 2.0), (0.0, 0, 1.6), 45),
        'rear': ((-11, -7, 4.5), (-0.5, 0, 1.4), 45),
        'far': ((5, 13, 4.0), (0.2, 0, 1.45), 45),
        'top': ((6, -9, 11), (0, 0, 1.4), 45),
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

if arg('--blend'):
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(arg('--blend')).resolve()))
if arg('--glb'):
    for o in bpy.context.view_layer.objects:
        o.select_set(o.name in TRUCK.objects)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_lights=False, export_cameras=False)
    print('GLB OK', arg('--glb'))
if arg('--render'):
    stage(arg('--view', 'ref'))
    scene.render.filepath = str(Path(arg('--render')).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK', arg('--render'))
